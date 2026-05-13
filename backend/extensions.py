import uuid
import random
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal, Dict, Any

import jwt
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field



REWARD_WHEEL_PRIZES = [
    {"label": "$0.25", "value": 0.25, "type": "cash_reward"},
    {"label": "$0.50", "value": 0.50, "type": "cash_reward"},
    {"label": "$1.00", "value": 1.00, "type": "cash_reward"},
    {"label": "$2.00", "value": 2.00, "type": "cash_reward"},
    {"label": "$5.00", "value": 5.00, "type": "cash_reward"},
    {"label": "$10.00", "value": 10.00, "type": "cash_reward"},
    {"label": "$15.00", "value": 15.00, "type": "cash_reward"},
    {"label": "$25.00", "value": 25.00, "type": "cash_reward"},
    {"label": "$50.00", "value": 50.00, "type": "cash_reward"},
    {"label": "$75.00", "value": 75.00, "type": "cash_reward"},
    {"label": "$100.00", "value": 100.00, "type": "cash_reward"},
    {"label": "Bonus Task", "value": 0.0, "type": "bonus_task"},
    {"label": "Try Again", "value": 0.0, "type": "no_reward"},
]
DAILY_CHECKIN_MIN = 2.00
DAILY_CHECKIN_MAX = 20.00
DAILY_CHECKIN_STEP = 2.00

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class WebSocketManager:
    def __init__(self):
        self.user_connections: Dict[str, set[WebSocket]] = {}
        self.admin_connections: set[WebSocket] = set()
        self.public_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, user: Optional[dict] = None):
        await websocket.accept()
        if user and user.get("role") == "admin":
            self.admin_connections.add(websocket)
        elif user:
            self.user_connections.setdefault(user["id"], set()).add(websocket)
        else:
            self.public_connections.add(websocket)

    def disconnect(self, websocket: WebSocket, user: Optional[dict] = None):
        if user and user.get("role") == "admin":
            self.admin_connections.discard(websocket)
        elif user:
            conns = self.user_connections.get(user["id"], set())
            conns.discard(websocket)
            if not conns and user["id"] in self.user_connections:
                self.user_connections.pop(user["id"], None)
        else:
            self.public_connections.discard(websocket)

    async def _send_many(self, conns, event: str, payload: dict):
        dead = []
        for ws in list(conns):
            try:
                await ws.send_json({"event": event, "payload": payload, "ts": now_utc().isoformat()})
            except Exception:
                dead.append(ws)
        for ws in dead:
            conns.discard(ws)

    async def emit_user(self, user_id: str, event: str, payload: dict):
        await self._send_many(self.user_connections.get(user_id, set()), event, payload)
        await self._send_many(self.admin_connections, event, {**payload, "user_id": user_id})

    async def emit_admin(self, event: str, payload: dict):
        await self._send_many(self.admin_connections, event, payload)

    async def emit_public(self, event: str, payload: dict):
        await self._send_many(self.public_connections, event, payload)

    async def emit_all(self, event: str, payload: dict):
        await self.emit_admin(event, payload)
        await self._send_many(self.public_connections, event, payload)
        for user_id in list(self.user_connections.keys()):
            await self.emit_user(user_id, event, payload)


class TaskIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)
    description: Optional[str] = None
    reward: float = Field(gt=0)
    type: Literal["daily", "social", "youtube", "vip", "deposit", "referral", "special"] = "youtube"
    vip_level: Optional[str] = None
    cooldown_hours: int = 24
    thumbnail: Optional[str] = None
    active: bool = True

    # YouTube task platform fields
    youtube_url: Optional[str] = None
    channel_name: Optional[str] = None
    instructions: Optional[str] = None
    proof_required: bool = True
    proof_tips: Optional[str] = None


class TaskOut(TaskIn):
    id: str
    status: str = "available"
    created_at: str


class TaskCompleteIn(BaseModel):
    proof: Optional[str] = None


class TaskSubmitIn(BaseModel):
    proof_data_url: str = Field(min_length=20)
    note: Optional[str] = None


class TaskReviewIn(BaseModel):
    status: Literal["approved", "rejected"]
    rejection_reason: Optional[str] = None
    admin_note: Optional[str] = None


class VipLevelIn(BaseModel):
    name: str
    level: int
    required_balance: float = 0
    required_deposit: float = 0
    reward_multiplier: float = 1
    commission_boost_pct: float = 0
    badge_color: str = "gold"
    benefits: List[str] = []


class PaymentMethodIn(BaseModel):
    name: str
    type: Literal["crypto", "binance_pay", "manual"] = "crypto"
    coin: str = "USDT"
    network: str = "TRC20"
    address: Optional[str] = None
    instructions: Optional[str] = None
    active: bool = True


class JackpotIn(BaseModel):
    title: str
    reward_min: float = 1
    reward_max: float = 25
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    active: bool = True


def build_router(db, get_current_user, admin_required, record_tx, JWT_SECRET: str, JWT_ALGO: str):
    router = APIRouter()
    ws_manager = WebSocketManager()

    async def get_ws_user(token: Optional[str]) -> Optional[dict]:
        if not token:
            return None
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
            return await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
        except Exception:
            return None

    async def seed_phase2():
        await db.users.update_many(
            {"locked_balance": {"$exists": False}},
            {"$set": {"locked_balance": 0.0, "bonus_balance": 0.0, "current_streak": 0, "longest_streak": 0, "spin_tokens": 2, "spin_count": 0, "spin_reward_queue": [0.50, 25.00], "daily_checkin_next_reward": DAILY_CHECKIN_MIN, "daily_checkin_direction": 1, "achievement_count": 0}},
        )
        await db.users.update_many({"spin_tokens": {"$exists": False}, "role": "user"}, {"$set": {"spin_tokens": 2}})
        await db.users.update_many({"spin_count": {"$exists": False}}, {"$set": {"spin_count": 0}})
        await db.users.update_many({"spin_reward_queue": {"$exists": False}, "role": "user"}, {"$set": {"spin_reward_queue": [0.50, 25.00]}})
        await db.users.update_many({"daily_checkin_next_reward": {"$exists": False}}, {"$set": {"daily_checkin_next_reward": DAILY_CHECKIN_MIN}})
        await db.users.update_many({"daily_checkin_direction": {"$exists": False}}, {"$set": {"daily_checkin_direction": 1}})
        await db.tasks.create_index([("active", 1), ("type", 1), ("vip_level", 1)])
        await db.tasks.create_index([("youtube_url", 1)])
        await db.task_submissions.create_index([("user_id", 1), ("task_id", 1), ("created_at", -1)])
        await db.task_submissions.create_index([("status", 1), ("created_at", -1)])
        await db.task_completions.create_index([("user_id", 1), ("task_id", 1), ("created_at", -1)])
        await db.balance_logs.create_index([("user_id", 1), ("created_at", -1)])
        await db.bonuses.create_index([("user_id", 1), ("created_at", -1)])
        await db.sessions.create_index([("user_id", 1), ("created_at", -1)])
        await db.admin_logs.create_index([("admin_id", 1), ("created_at", -1)])
        await db.vip_history.create_index([("user_id", 1), ("created_at", -1)])
        await db.deposit_logs.create_index([("deposit_id", 1), ("created_at", -1)])
        await db.withdrawal_logs.create_index([("withdrawal_id", 1), ("created_at", -1)])
        await db.registration_codes.create_index("code", unique=True)
        await db.registration_codes.create_index("status")
        await db.users.create_index("registration_code")
        await db.users.create_index("registration_code_id")
        await db.users.create_index("first_task_reward_claimed")

        if await db.tasks.count_documents({}) == 0:
            defaults = [
                {
                    "title": "Subscribe to the official YouTube channel",
                    "description": "Open the YouTube channel, subscribe, then upload a clear screenshot showing the subscribed state.",
                    "reward": 2.0, "type": "youtube", "vip_level": None, "cooldown_hours": 24,
                    "thumbnail": None, "active": True, "youtube_url": "https://www.youtube.com/",
                    "channel_name": "Official Campaign Channel",
                    "instructions": "1) Open the YouTube link. 2) Subscribe to the channel. 3) Take a screenshot showing the channel name and Subscribed button. 4) Upload the screenshot for admin review.",
                    "proof_required": True, "proof_tips": "Screenshot must show channel name and subscribed state."
                },
                {
                    "title": "Watch and like the campaign video",
                    "description": "Watch the assigned video, like it, and upload a screenshot showing the liked video page.",
                    "reward": 1.5, "type": "youtube", "vip_level": None, "cooldown_hours": 24,
                    "thumbnail": None, "active": True, "youtube_url": "https://www.youtube.com/",
                    "channel_name": "Video Campaign",
                    "instructions": "Open the video, watch as instructed, like the video, then upload a screenshot with the Like button visible.",
                    "proof_required": True, "proof_tips": "Edited, duplicate, or unclear screenshots may be rejected."
                },
                {"title": "Invite a New Member", "description": "Share your referral code and grow your network.", "reward": 5, "type": "referral", "vip_level": None, "cooldown_hours": 48, "thumbnail": None, "active": True, "youtube_url": None, "channel_name": None, "instructions": "Invite a new member using your referral code.", "proof_required": False, "proof_tips": None},
            ]
            for d in defaults:
                await db.tasks.insert_one({"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **d})

        if await db.vip_levels.count_documents({}) == 0:
            levels = [
                {"name": "Free", "level": 0, "required_balance": 0, "required_deposit": 0, "reward_multiplier": 1, "commission_boost_pct": 0, "badge_color": "zinc", "benefits": ["Starter rewards", "Standard withdrawals"]},
                {"name": "Silver", "level": 1, "required_balance": 500, "required_deposit": 500, "reward_multiplier": 1.1, "commission_boost_pct": 5, "badge_color": "slate", "benefits": ["+10% task rewards", "Priority support"]},
                {"name": "Gold", "level": 2, "required_balance": 2000, "required_deposit": 2000, "reward_multiplier": 1.25, "commission_boost_pct": 10, "badge_color": "gold", "benefits": ["Gold badge", "VIP tasks", "Faster withdrawals"]},
                {"name": "Platinum", "level": 3, "required_balance": 5000, "required_deposit": 5000, "reward_multiplier": 1.5, "commission_boost_pct": 15, "badge_color": "purple", "benefits": ["Dedicated manager", "Premium boosts", "Priority queue"]},
                {"name": "Royal VIP", "level": 4, "required_balance": 15000, "required_deposit": 15000, "reward_multiplier": 2, "commission_boost_pct": 25, "badge_color": "gold", "benefits": ["Royal crown", "Concierge support", "Highest multipliers"]},
            ]
            for lvl in levels:
                await db.vip_levels.insert_one({"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **lvl})

        if await db.payment_methods.count_documents({}) == 0:
            await db.payment_methods.insert_one({
                "id": str(uuid.uuid4()), "name": "USDT TRC20", "type": "crypto", "coin": "USDT", "network": "TRC20",
                "address": "TYourRoyalUSDTAddressHere000000000", "instructions": "Send USDT on TRC20 and upload proof.",
                "active": True, "created_at": now_utc().isoformat(),
            })

    def _vip_rank(name: Optional[str]) -> int:
        order = {"Free": 0, "Basic": 0, "Silver": 1, "Gold": 2, "Platinum": 3, "Royal VIP": 4}
        return order.get(name or "Free", 0)

    async def _log_balance(user: dict, balance_type: str, amount: float, reason: str, ref: Optional[str] = None):
        await db.balance_logs.insert_one({
            "id": str(uuid.uuid4()), "user_id": user["id"], "balance_type": balance_type,
            "amount": float(amount), "reason": reason, "reference_id": ref, "created_at": now_utc().isoformat(),
        })

    async def _grant_bonus(user: dict, amount: float, source: str, note: str = ""):
        before = float(user.get("bonus_balance", 0))
        after_bonus = before + float(amount)
        total_before = float(user.get("balance", 0))
        total_after = total_before + float(amount)
        await db.users.update_one({"id": user["id"]}, {"$set": {"bonus_balance": after_bonus, "balance": total_after}})
        bonus = {"id": str(uuid.uuid4()), "user_id": user["id"], "amount": float(amount), "source": source, "note": note, "created_at": now_utc().isoformat()}
        await db.bonuses.insert_one(bonus)
        await _log_balance(user, "bonus_balance", amount, source, bonus["id"])
        await record_tx(user["id"], source, float(amount), user.get("coin_symbol", "USDT"), total_before, total_after, reference_id=bonus["id"], note=note)
        await ws_manager.emit_user(user["id"], "balance.updated", {"balance": total_after, "bonus_balance": after_bonus, "delta": float(amount), "source": source})
        return bonus

    async def _get_referral_config() -> dict:
        doc = await db.platform_settings.find_one({"key": "referral_rewards"}, {"_id": 0})
        value = (doc or {}).get("value") or {}
        return {
            "enabled": bool(value.get("enabled", True)),
            "referrer_reward": float(value.get("referrer_reward", 5.0)),
            "referred_reward": float(value.get("referred_reward", 2.0)),
            "first_deposit_commission_pct": float(value.get("first_deposit_commission_pct", 5.0)),
            "qualification_rule": value.get("qualification_rule", "first_approved_task"),
        }

    async def _ensure_referral_record_for_user(user_doc: dict):
        if not user_doc or not user_doc.get("referred_by"):
            return None
        existing = await db.referrals.find_one({"referred_user_id": user_doc["id"]}, {"_id": 0})
        if existing:
            return existing
        referrer = await db.users.find_one({"id": user_doc.get("referred_by")}, {"_id": 0, "referral_code": 1})
        if not referrer:
            return None
        rec = {
            "id": str(uuid.uuid4()),
            "referrer_user_id": user_doc["referred_by"],
            "referred_user_id": user_doc["id"],
            "referral_code": referrer.get("referral_code"),
            "status": "pending",
            "qualification_rule": "first_approved_task",
            "referrer_reward": 0.0,
            "referred_reward": 0.0,
            "first_deposit_commission_pct": 0.0,
            "first_deposit_commission_amount": 0.0,
            "first_deposit_commission_paid": False,
            "first_deposit_id": None,
            "created_at": now_utc().isoformat(),
            "qualified_at": None,
            "rewarded_at": None,
        }
        await db.referrals.insert_one(rec)
        rec.pop("_id", None)
        return rec

    async def _maybe_award_referral_rewards(referred_user_id: str):
        config = await _get_referral_config()
        if not config["enabled"]:
            return None
        referred_user = await db.users.find_one({"id": referred_user_id}, {"_id": 0})
        if not referred_user:
            return None
        referral = await _ensure_referral_record_for_user(referred_user)
        if not referral or referral.get("status") == "rewarded":
            return None
        referrer = await db.users.find_one({"id": referral.get("referrer_user_id")}, {"_id": 0})
        if not referrer:
            return None
        referrer_reward = round(float(config.get("referrer_reward", 5.0)), 2)
        referred_reward = round(float(config.get("referred_reward", 2.0)), 2)
        qualified_at = now_utc().isoformat()
        payload = {"referrer_reward": referrer_reward, "referred_reward": referred_reward}
        if referrer_reward > 0:
            await _grant_bonus(referrer, referrer_reward, "referral_commission", f"Referral reward for {referred_user.get('email')}")
            await db.users.update_one({"id": referrer["id"]}, {"$inc": {"referral_earnings": referrer_reward}})
            await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": referrer["id"], "title": "Referral Reward Credited", "body": f"You received {referrer_reward:g} {referrer.get('coin_symbol', 'USDT')} after your invited member qualified.", "category": "rewards", "read": False, "created_at": qualified_at})
        if referred_reward > 0:
            await _grant_bonus(referred_user, referred_reward, "referral_join_bonus", "Referral welcome reward unlocked after your first approved task")
            await db.notifications.insert_one({"id": str(uuid.uuid4()), "user_id": referred_user["id"], "title": "Referral Welcome Reward Credited", "body": f"You received {referred_reward:g} {referred_user.get('coin_symbol', 'USDT')} for qualifying through a referral.", "category": "rewards", "read": False, "created_at": qualified_at})
        await db.referrals.update_one(
            {"referred_user_id": referred_user_id},
            {"$set": {"status": "rewarded", "qualified_at": qualified_at, "rewarded_at": qualified_at, "referrer_reward": referrer_reward, "referred_reward": referred_reward, "first_deposit_commission_pct": float(config.get("first_deposit_commission_pct", 5.0)), "updated_at": qualified_at}},
        )
        await ws_manager.emit_user(referrer["id"], "referral.rewarded", payload)
        await ws_manager.emit_user(referred_user["id"], "referral.rewarded", payload)
        return payload

    async def _maybe_award_first_task_reward(user_id: str):
        fresh_user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not fresh_user or fresh_user.get("first_task_reward_claimed"):
            return None

        amount = float(fresh_user.get("first_task_reward_amount", 10.0))
        coin = fresh_user.get("first_task_reward_coin", fresh_user.get("coin_symbol", "USDT"))
        reward_note = "First task completion reward"

        bonus = await _grant_bonus(
            {**fresh_user, "coin_symbol": coin},
            amount,
            "first_task_reward",
            reward_note,
        )
        claimed_at = now_utc().isoformat()
        await db.users.update_one(
            {"id": user_id},
            {
                "$set": {
                    "first_task_reward_claimed": True,
                    "first_task_reward_claimed_at": claimed_at,
                }
            },
        )
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": "First Task Reward Unlocked",
            "body": f"You received {amount:g} {coin} for completing your first task.",
            "category": "rewards",
            "read": False,
            "created_at": claimed_at,
        }
        await db.notifications.insert_one(notification)
        payload = {
            "amount": amount,
            "coin": coin,
            "bonus": bonus,
            "notification": notification,
        }
        await ws_manager.emit_user(user_id, "reward.first_task", payload)
        await _maybe_award_referral_rewards(user_id)
        return payload

    @router.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
        user = await get_ws_user(token)
        await ws_manager.connect(websocket, user)
        try:
            await websocket.send_json({"event": "connected", "payload": {"role": user.get("role") if user else "public"}, "ts": now_utc().isoformat()})
            while True:
                msg = await websocket.receive_text()
                if msg == "ping":
                    await websocket.send_json({"event": "pong", "payload": {}, "ts": now_utc().isoformat()})
        except WebSocketDisconnect:
            ws_manager.disconnect(websocket, user)
        except Exception:
            ws_manager.disconnect(websocket, user)

    @router.get("/phase2/overview")
    async def phase2_overview(user: dict = Depends(get_current_user)):
        recent = await db.transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)
        approved_tasks = await db.task_submissions.count_documents({"user_id": user["id"], "status": "approved"})
        pending_tasks = await db.task_submissions.count_documents({"user_id": user["id"], "status": "pending"})
        rejected_tasks = await db.task_submissions.count_documents({"user_id": user["id"], "status": "rejected"})
        bonuses = await db.bonuses.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(10)
        pending_withdrawals = await db.withdrawals.aggregate([
            {"$match": {"user_id": user["id"], "status": {"$in": ["pending", "reviewing", "approved", "processing"]}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        pending_wd = float(pending_withdrawals[0]["total"]) if pending_withdrawals else 0.0
        withdrawable = max(0.0, float(user.get("balance", 0)) - float(user.get("locked_balance", 0)) - pending_wd)
        return {
            "wallet": {
                "total_balance": float(user.get("balance", 0)),
                "locked_balance": float(user.get("locked_balance", 0)),
                "pending_withdrawal": pending_wd,
                "withdrawable_balance": withdrawable,
                "bonus_balance": float(user.get("bonus_balance", 0)),
                "task_income": float(user.get("task_income", 0)),
                "referral_income": float(user.get("referral_earnings", 0)),
                "deposit_balance": float(user.get("deposit_balance", 0)),
            },
            "streak": {
                "current": int(user.get("current_streak", 0)),
                "longest": int(user.get("longest_streak", 0)),
                "last_checkin_at": user.get("last_checkin_at"),
                "next_reward": float(user.get("daily_checkin_next_reward", DAILY_CHECKIN_MIN)),
                "direction": int(user.get("daily_checkin_direction", 1)),
                "min_reward": DAILY_CHECKIN_MIN,
                "max_reward": DAILY_CHECKIN_MAX,
            },
            "minimum_target": 100.0,
            "spin_count": int(user.get("spin_count", 0)),
            "reward_wheel_prizes": REWARD_WHEEL_PRIZES,
            "tasks_completed": approved_tasks,
            "task_summary": {"approved": approved_tasks, "pending_review": pending_tasks, "rejected": rejected_tasks},
            "recent_transactions": recent,
            "recent_bonuses": bonuses,
            "spin_tokens": int(user.get("spin_tokens", 1)),
            "first_task_reward": {
                "amount": float(user.get("first_task_reward_amount", 10.0)),
                "claimed": bool(user.get("first_task_reward_claimed", False)),
                "claimed_at": user.get("first_task_reward_claimed_at"),
            },
            "referral_rewards": await _get_referral_config(),
        }

    async def _task_status_for_user(task: dict, user: dict) -> dict:
        t = dict(task)
        required = _vip_rank(t.get("vip_level"))
        if required > _vip_rank(user.get("membership_name")):
            t["status"] = "locked"
            t["locked_reason"] = f"Requires {t.get('vip_level')}"
            return t
        pending = await db.task_submissions.find_one({"user_id": user["id"], "task_id": t["id"], "status": "pending"}, {"_id": 0}, sort=[("created_at", -1)])
        if pending:
            t["status"] = "pending_review"
            t["latest_submission"] = pending
            return t
        rejected = await db.task_submissions.find_one({"user_id": user["id"], "task_id": t["id"], "status": "rejected"}, {"_id": 0}, sort=[("created_at", -1)])
        last = await db.task_completions.find_one({"user_id": user["id"], "task_id": t["id"]}, {"_id": 0}, sort=[("created_at", -1)])
        if last:
            next_at = datetime.fromisoformat(last["created_at"]) + timedelta(hours=int(t.get("cooldown_hours", 24)))
            if next_at > now_utc():
                t["status"] = "cooldown"
                t["next_available_at"] = next_at.isoformat()
                return t
        t["status"] = "available"
        if rejected:
            t["last_rejection_reason"] = rejected.get("rejection_reason")
        return t

    @router.get("/tasks-v2")
    async def list_tasks_v2(user: dict = Depends(get_current_user), type_filter: Optional[str] = None):
        q: dict = {"active": True}
        if type_filter:
            q["type"] = type_filter
        raw = await db.tasks.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
        return [await _task_status_for_user(t, user) for t in raw]

    async def _create_task_submission(task_id: str, proof: str, note: Optional[str], user: dict):
        task = await db.tasks.find_one({"id": task_id, "active": True}, {"_id": 0})
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        if _vip_rank(task.get("vip_level")) > _vip_rank(user.get("membership_name")):
            raise HTTPException(status_code=403, detail="VIP level required")
        if task.get("proof_required", True) and not proof:
            raise HTTPException(status_code=400, detail="Screenshot proof is required")
        existing_pending = await db.task_submissions.find_one({"user_id": user["id"], "task_id": task_id, "status": "pending"})
        if existing_pending:
            raise HTTPException(status_code=409, detail="This task already has a pending proof review")
        last = await db.task_completions.find_one({"user_id": user["id"], "task_id": task_id}, {"_id": 0}, sort=[("created_at", -1)])
        if last:
            next_at = datetime.fromisoformat(last["created_at"]) + timedelta(hours=int(task.get("cooldown_hours", 24)))
            if next_at > now_utc():
                raise HTTPException(status_code=429, detail=f"Task is on cooldown until {next_at.isoformat()}")
        multiplier = float((await db.vip_levels.find_one({"name": user.get("membership_name")}, {"_id": 0}) or {}).get("reward_multiplier", 1))
        reward = round(float(task["reward"]) * multiplier, 2)
        rec = {
            "id": str(uuid.uuid4()), "user_id": user["id"], "user_email": user.get("email"), "user_name": user.get("name"),
            "task_id": task_id, "task_title": task.get("title"), "task_type": task.get("type"),
            "youtube_url": task.get("youtube_url"), "channel_name": task.get("channel_name"),
            "reward": reward, "proof_data_url": proof, "note": note, "status": "pending",
            "rejection_reason": None, "admin_note": None, "reviewed_by": None, "reviewed_at": None,
            "created_at": now_utc().isoformat(), "updated_at": now_utc().isoformat(),
        }
        await db.task_submissions.insert_one(rec)
        await db.users.update_one({"id": user["id"]}, {"$inc": {"tasks_pending": 1}, "$set": {"last_active": now_utc().isoformat()}})
        rec.pop("_id", None)
        await ws_manager.emit_admin("task_submission.created", rec)
        return rec

    @router.post("/tasks-v2/{task_id}/submit-proof")
    async def submit_task_proof(task_id: str, body: TaskSubmitIn, user: dict = Depends(get_current_user)):
        rec = await _create_task_submission(task_id, body.proof_data_url, body.note, user)
        return {"ok": True, "submission": rec}

    @router.post("/tasks-v2/{task_id}/complete")
    async def complete_task_v2(task_id: str, body: TaskCompleteIn, user: dict = Depends(get_current_user)):
        # Backward-compatible endpoint: completion now means proof submission and awaits admin review.
        rec = await _create_task_submission(task_id, body.proof or "", None, user)
        return {"ok": True, "submission": rec, "message": "Proof submitted for admin review. Reward is credited after approval."}

    @router.get("/task-submissions")
    async def my_task_submissions(user: dict = Depends(get_current_user)):
        return await db.task_submissions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)

    @router.get("/admin/task-submissions")
    async def admin_task_submissions(status_filter: Optional[str] = None, admin: dict = Depends(admin_required)):
        q = {"status": status_filter} if status_filter else {}
        return await db.task_submissions.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.patch("/admin/task-submissions/{submission_id}")
    async def admin_review_task_submission(submission_id: str, body: TaskReviewIn, admin: dict = Depends(admin_required)):
        sub = await db.task_submissions.find_one({"id": submission_id})
        if not sub:
            raise HTTPException(status_code=404, detail="Task submission not found")
        if sub.get("status") != "pending":
            raise HTTPException(status_code=400, detail="Only pending submissions can be reviewed")
        user_doc = await db.users.find_one({"id": sub["user_id"]})
        update = {
            "status": body.status, "reviewed_by": admin["id"], "reviewed_at": now_utc().isoformat(),
            "updated_at": now_utc().isoformat(), "admin_note": body.admin_note,
        }
        if body.status == "rejected":
            if not body.rejection_reason:
                raise HTTPException(status_code=400, detail="Rejection reason is required")
            update["rejection_reason"] = body.rejection_reason
            await db.users.update_one({"id": sub["user_id"]}, {"$inc": {"tasks_pending": -1}})
        else:
            if user_doc:
                completion = {
                    "id": str(uuid.uuid4()), "user_id": sub["user_id"], "task_id": sub["task_id"],
                    "title": sub.get("task_title"), "reward": float(sub.get("reward", 0)),
                    "proof": sub.get("proof_data_url"), "submission_id": submission_id, "created_at": now_utc().isoformat(),
                }
                await db.task_completions.insert_one(completion)
                await _grant_bonus(user_doc, float(sub.get("reward", 0)), "task_reward", f"Approved task proof: {sub.get('task_title')}")
                await db.users.update_one({"id": sub["user_id"]}, {"$inc": {"tasks_completed": 1, "tasks_pending": -1, "task_income": float(sub.get("reward", 0))}, "$set": {"last_active": now_utc().isoformat()}})
                await _maybe_award_first_task_reward(sub["user_id"])
                await _maybe_award_referral_rewards(sub["user_id"])
        await db.task_submissions.update_one({"id": submission_id}, {"$set": update})
        updated = await db.task_submissions.find_one({"id": submission_id}, {"_id": 0})
        await db.admin_logs.insert_one({"id": str(uuid.uuid4()), "admin_id": admin["id"], "action": f"task_submission.{body.status}", "target_id": submission_id, "created_at": now_utc().isoformat()})
        await ws_manager.emit_user(sub["user_id"], "task_submission.reviewed", updated)
        return updated

    def _next_checkin_state(current_reward: float, direction: int) -> tuple[float, int]:
        direction = 1 if int(direction or 1) >= 0 else -1
        current_reward = float(current_reward or DAILY_CHECKIN_MIN)
        if current_reward >= DAILY_CHECKIN_MAX:
            return DAILY_CHECKIN_MAX - DAILY_CHECKIN_STEP, -1
        if current_reward <= DAILY_CHECKIN_MIN and direction < 0:
            return DAILY_CHECKIN_MIN + DAILY_CHECKIN_STEP, 1
        candidate = current_reward + (DAILY_CHECKIN_STEP * direction)
        if candidate >= DAILY_CHECKIN_MAX:
            return DAILY_CHECKIN_MAX, 1
        if candidate <= DAILY_CHECKIN_MIN:
            return DAILY_CHECKIN_MIN, -1
        return candidate, direction

    @router.post("/rewards/checkin")
    async def daily_checkin(user: dict = Depends(get_current_user)):
        today = now_utc().date()
        last = user.get("last_checkin_at")
        if last and datetime.fromisoformat(last).date() == today:
            raise HTTPException(status_code=429, detail="Daily check-in already claimed")

        current = int(user.get("current_streak", 0))
        if last and datetime.fromisoformat(last).date() == today - timedelta(days=1):
            current += 1
        else:
            current = 1

        longest = max(int(user.get("longest_streak", 0)), current)
        reward = float(user.get("daily_checkin_next_reward", DAILY_CHECKIN_MIN) or DAILY_CHECKIN_MIN)
        direction = int(user.get("daily_checkin_direction", 1) or 1)
        next_reward, next_direction = _next_checkin_state(reward, direction)

        await db.users.update_one(
            {"id": user["id"]},
            {
                "$set": {
                    "current_streak": current,
                    "longest_streak": longest,
                    "last_checkin_at": now_utc().isoformat(),
                    "daily_checkin_next_reward": next_reward,
                    "daily_checkin_direction": next_direction,
                }
            },
        )
        await _grant_bonus({**user, "current_streak": current}, reward, "daily_checkin", f"Daily check-in reward day {current}")
        await ws_manager.emit_user(user["id"], "reward.checkin", {"streak": current, "reward": reward, "next_reward": next_reward})
        return {"ok": True, "streak": current, "longest_streak": longest, "reward": reward, "next_reward": next_reward, "direction": next_direction}

    @router.post("/rewards/spin")
    async def spin_wheel(user: dict = Depends(get_current_user)):
        tokens = int(user.get("spin_tokens", 0))
        queue = user.get("spin_reward_queue", []) or []
        if tokens <= 0 or not queue:
            raise HTTPException(status_code=429, detail="No spin tokens available")

        spin_count = int(user.get("spin_count", 0))
        try:
            reward = round(float(queue[0]), 2)
        except (TypeError, ValueError):
            reward = 0.0
        prize = next((p for p in REWARD_WHEEL_PRIZES if p["type"] == "cash_reward" and float(p["value"]) == reward), {"label": "Try Again" if reward <= 0 else f"${reward:.2f}", "value": reward, "type": "no_reward" if reward <= 0 else "cash_reward"})

        await db.users.update_one(
            {"id": user["id"]},
            {"$inc": {"spin_tokens": -1, "spin_count": 1}, "$pop": {"spin_reward_queue": -1}, "$set": {"last_spin_at": now_utc().isoformat()}},
        )
        jackpot = {"id": str(uuid.uuid4()), "user_id": user["id"], "reward": reward, "label": prize.get("label"), "prize_type": prize.get("type"), "type": "spin", "created_at": now_utc().isoformat()}
        await db.jackpots.insert_one(jackpot)
        if reward > 0:
            await _grant_bonus(user, reward, "spin_reward", f"Spin wheel reward: {prize.get('label')}")
        await ws_manager.emit_user(user["id"], "reward.spin", {"reward": reward, "prize": prize, "remaining_tokens": tokens - 1, "spin_count": spin_count + 1})
        return {"ok": True, "reward": reward, "prize": prize, "remaining_tokens": tokens - 1, "spin_count": spin_count + 1, "wheel_prizes": REWARD_WHEEL_PRIZES}

    @router.get("/achievements")
    async def achievements(user: dict = Depends(get_current_user)):
        tasks_done = await db.task_submissions.count_documents({"user_id": user["id"], "status": "approved"})
        refs = await db.users.count_documents({"referred_by": user["id"]})
        streak = int(user.get("longest_streak", 0))
        items = [
            {"id": "first_task", "title": "First Approved Task", "unlocked": tasks_done >= 1, "progress": min(tasks_done, 1), "goal": 1},
            {"id": "task_master_10", "title": "Approved Task Master", "unlocked": tasks_done >= 10, "progress": min(tasks_done, 10), "goal": 10},
            {"id": "streak_7", "title": "7-Day Crown Streak", "unlocked": streak >= 7, "progress": min(streak, 7), "goal": 7},
            {"id": "referral_3", "title": "Network Builder", "unlocked": refs >= 3, "progress": min(refs, 3), "goal": 3},
        ]
        await db.users.update_one({"id": user["id"]}, {"$set": {"achievement_count": sum(1 for i in items if i["unlocked"])}})
        return items

    @router.get("/leaderboard")
    async def leaderboard(metric: Literal["balance", "referrals", "tasks"] = "balance"):
        if metric == "referrals":
            users = await db.users.find({"role": "user"}, {"_id": 0, "id": 1, "name": 1, "membership_name": 1, "created_at": 1}).to_list(200)
            out = []
            for u in users:
                out.append({**u, "score": await db.users.count_documents({"referred_by": u["id"]})})
            return sorted(out, key=lambda x: x["score"], reverse=True)[:50]
        if metric == "tasks":
            users = await db.users.find({"role": "user"}, {"_id": 0, "id": 1, "name": 1, "membership_name": 1, "tasks_completed": 1}).sort("tasks_completed", -1).to_list(50)
            return [{**u, "score": int(u.get("tasks_completed", 0))} for u in users]
        users = await db.users.find({"role": "user"}, {"_id": 0, "id": 1, "name": 1, "membership_name": 1, "balance": 1}).sort("balance", -1).to_list(50)
        return [{**u, "score": float(u.get("balance", 0))} for u in users]

    @router.get("/vip/levels")
    async def vip_levels():
        return await db.vip_levels.find({}, {"_id": 0}).sort("level", 1).to_list(50)

    @router.get("/referrals/tree")
    async def referral_tree(user: dict = Depends(get_current_user)):
        level1 = await db.users.find({"referred_by": user["id"]}, {"_id": 0, "id": 1, "name": 1, "email": 1, "created_at": 1, "balance": 1}).to_list(200)
        nodes = []
        referral_rows = await db.referrals.find({"referrer_user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
        referral_by_user = {r.get("referred_user_id"): r for r in referral_rows}
        for r in level1:
            children = await db.users.find({"referred_by": r["id"]}, {"_id": 0, "id": 1, "name": 1, "email": 1, "created_at": 1, "balance": 1}).to_list(100)
            nodes.append({**r, "level": 1, "referral_status": referral_by_user.get(r["id"], {}).get("status", "pending"), "referrer_reward": referral_by_user.get(r["id"], {}).get("referrer_reward", 0), "referred_reward": referral_by_user.get(r["id"], {}).get("referred_reward", 0), "children": [{**c, "level": 2} for c in children]})
        return {"referral_code": user.get("referral_code"), "tree": nodes, "records": referral_rows, "config": await _get_referral_config()}

    @router.get("/payment-methods")
    async def payment_methods():
        return await db.payment_methods.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(50)

    @router.get("/admin/phase2/stats")
    async def admin_phase2_stats(admin: dict = Depends(admin_required)):
        total_bonus = await db.bonuses.aggregate([{"$group": {"_id": None, "total": {"$sum": "$amount"}}}]).to_list(1)
        return {
            "tasks": await db.tasks.count_documents({}),
            "task_completions": await db.task_completions.count_documents({}),
            "task_submissions_pending": await db.task_submissions.count_documents({"status": "pending"}),
            "bonuses_total": float(total_bonus[0]["total"]) if total_bonus else 0.0,
            "vip_levels": await db.vip_levels.count_documents({}),
            "active_payment_methods": await db.payment_methods.count_documents({"active": True}),
            "jackpot_events": await db.jackpots.count_documents({}),
            "connected_users": sum(len(v) for v in ws_manager.user_connections.values()),
            "connected_admins": len(ws_manager.admin_connections),
        }

    @router.get("/admin/tasks-v2")
    async def admin_tasks(admin: dict = Depends(admin_required)):
        return await db.tasks.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.post("/admin/tasks-v2")
    async def admin_create_task(body: TaskIn, admin: dict = Depends(admin_required)):
        rec = {"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **body.model_dump()}
        await db.tasks.insert_one(rec)
        await db.admin_logs.insert_one({"id": str(uuid.uuid4()), "admin_id": admin["id"], "action": "task.create", "target_id": rec["id"], "created_at": now_utc().isoformat()})
        await ws_manager.emit_all("task.created", rec)
        return rec

    @router.patch("/admin/tasks-v2/{task_id}")
    async def admin_update_task(task_id: str, body: TaskIn, admin: dict = Depends(admin_required)):
        await db.tasks.update_one({"id": task_id}, {"$set": body.model_dump()})
        rec = await db.tasks.find_one({"id": task_id}, {"_id": 0})
        if not rec:
            raise HTTPException(status_code=404, detail="Task not found")
        await db.admin_logs.insert_one({"id": str(uuid.uuid4()), "admin_id": admin["id"], "action": "task.update", "target_id": task_id, "created_at": now_utc().isoformat()})
        await ws_manager.emit_all("task.updated", rec)
        return rec

    @router.delete("/admin/tasks-v2/{task_id}")
    async def admin_delete_task(task_id: str, admin: dict = Depends(admin_required)):
        await db.tasks.update_one({"id": task_id}, {"$set": {"active": False}})
        await ws_manager.emit_all("task.disabled", {"id": task_id})
        return {"ok": True}

    @router.get("/admin/vip-levels")
    async def admin_vip_levels(admin: dict = Depends(admin_required)):
        return await db.vip_levels.find({}, {"_id": 0}).sort("level", 1).to_list(50)

    @router.post("/admin/vip-levels")
    async def admin_create_vip(body: VipLevelIn, admin: dict = Depends(admin_required)):
        rec = {"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **body.model_dump()}
        await db.vip_levels.insert_one(rec)
        return rec

    @router.get("/admin/payment-methods")
    async def admin_payment_methods(admin: dict = Depends(admin_required)):
        return await db.payment_methods.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)

    @router.post("/admin/payment-methods")
    async def admin_create_payment_method(body: PaymentMethodIn, admin: dict = Depends(admin_required)):
        rec = {"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **body.model_dump()}
        await db.payment_methods.insert_one(rec)
        return rec

    @router.get("/admin/jackpots")
    async def admin_jackpots(admin: dict = Depends(admin_required)):
        return await db.jackpots.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

    @router.post("/admin/jackpots")
    async def admin_create_jackpot(body: JackpotIn, admin: dict = Depends(admin_required)):
        rec = {"id": str(uuid.uuid4()), "created_by": admin["id"], "created_at": now_utc().isoformat(), **body.model_dump()}
        await db.jackpot_campaigns.insert_one(rec)
        await ws_manager.emit_all("jackpot.created", rec)
        return rec

    return router, seed_phase2, ws_manager
