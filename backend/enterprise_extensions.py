import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Literal, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

DEFAULT_WITHDRAWAL_NETWORK_TAXES = [
    {"coin": "USDT", "network": "TRC20", "tax_pct": 1.0},
    {"coin": "USDT", "network": "BEP20", "tax_pct": 1.0},
    {"coin": "USDT", "network": "ERC20", "tax_pct": 3.0},
    {"coin": "BTC", "network": "Bitcoin", "tax_pct": 2.0},
    {"coin": "ETH", "network": "ERC20", "tax_pct": 3.0},
    {"coin": "BNB", "network": "BEP20", "tax_pct": 1.0},
]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class PlatformSettingIn(BaseModel):
    key: str = Field(min_length=2, max_length=80)
    value: Dict[str, Any]
    description: Optional[str] = None


class WithdrawalRuleIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    rule_type: Literal["minimum_balance", "kyc_required", "account_age_days", "vip_level", "manual_review", "cooldown_hours"]
    enabled: bool = True
    value: Dict[str, Any] = {}
    message: str = "Requirement not met."
    priority: int = 100


class CampaignIn(BaseModel):
    name: str
    campaign_type: Literal["countdown", "deposit_bonus", "task_boost", "referral_boost", "announcement"] = "countdown"
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    active: bool = True
    content: Dict[str, Any] = {}


class AnalyticsEventIn(BaseModel):
    event: str = Field(min_length=2, max_length=120)
    page: Optional[str] = None
    metadata: Dict[str, Any] = {}


class BulkTaskIn(BaseModel):
    tasks: List[Dict[str, Any]]


class ProfitSimulationIn(BaseModel):
    target: Literal["all", "tier", "ids"] = "all"
    tier: Optional[str] = None
    user_ids: Optional[List[str]] = None
    amount: Optional[float] = None
    percent: Optional[float] = None
    balance_field: Literal["balance", "bonus_balance", "daily_profit"] = "balance"
    note: str = "Admin profit accrual"


class MessageIntegrationIn(BaseModel):
    provider: Literal["whatsapp", "telegram", "email", "custom_webhook"]
    enabled: bool = False
    display_name: Optional[str] = None
    webhook_url: Optional[str] = None
    public_link: Optional[str] = None
    settings: Dict[str, Any] = {}


class FraudRuleIn(BaseModel):
    name: str
    enabled: bool = True
    risk_points: int = 10
    rule_type: Literal["multiple_accounts_ip", "rapid_withdrawals", "large_balance_change", "new_device", "manual"] = "manual"
    threshold: Dict[str, Any] = {}


def build_enterprise_router(db, get_current_user, admin_required, record_tx, ws_manager=None):
    router = APIRouter()

    async def emit_user(user_id: str, event: str, payload: dict):
        if ws_manager:
            try:
                await ws_manager.emit_user(user_id, event, payload)
            except Exception:
                pass

    async def emit_admin(event: str, payload: dict):
        if ws_manager:
            try:
                await ws_manager.emit_admin(event, payload)
            except Exception:
                pass

    async def seed_enterprise():
        await db.platform_settings.create_index("key", unique=True)
        await db.withdrawal_rules.create_index([("enabled", 1), ("priority", 1)])
        await db.campaigns.create_index([("active", 1), ("ends_at", 1)])
        await db.analytics_events.create_index([("event", 1), ("created_at", -1)])
        await db.analytics_events.create_index([("user_id", 1), ("created_at", -1)])
        await db.fraud_events.create_index([("user_id", 1), ("created_at", -1)])
        await db.device_sessions.create_index([("user_id", 1), ("last_seen_at", -1)])
        await db.message_integrations.create_index("provider", unique=True)
        await db.fraud_rules.create_index([("enabled", 1), ("rule_type", 1)])

        if not await db.platform_settings.find_one({"key": "withdrawal_config"}):
            await db.platform_settings.insert_one({
                "id": str(uuid.uuid4()),
                "key": "withdrawal_config",
                "value": {"minimum_withdrawal": 100, "currency": "USDT", "review_delay_hours": 24},
                "description": "Transparent withdrawal configuration shown to users.",
                "updated_at": now_utc().isoformat(),
            })
        if not await db.platform_settings.find_one({"key": "withdrawal_network_taxes"}):
            await db.platform_settings.insert_one({
                "id": str(uuid.uuid4()),
                "key": "withdrawal_network_taxes",
                "value": {"networks": DEFAULT_WITHDRAWAL_NETWORK_TAXES},
                "description": "Network tax percentages used to estimate the net amount users receive from withdrawals.",
                "updated_at": now_utc().isoformat(),
            })

        await db.platform_settings.update_one(
            {"key": "withdrawal_config"},
            {"$set": {"value.minimum_withdrawal": 100, "value.currency": "USDT", "updated_at": now_utc().isoformat()}},
        )
        if not await db.platform_settings.find_one({"key": "referral_rewards"}):
            await db.platform_settings.insert_one({
                "id": str(uuid.uuid4()),
                "key": "referral_rewards",
                "value": {"enabled": True, "referrer_reward": 5, "referred_reward": 2, "first_deposit_commission_pct": 5, "qualification_rule": "first_approved_task"},
                "description": "Referral rewards after first approved task, plus first-deposit referral commission.",
                "updated_at": now_utc().isoformat(),
            })

        await db.withdrawal_rules.update_many(
            {"rule_type": "minimum_balance"},
            {"$set": {"value.amount": 100, "message": "Reach 100 USDT withdrawable balance before requesting withdrawal."}},
        )
        await db.platform_settings.update_one(
            {"key": "referral_rewards"},
            {"$set": {"value.first_deposit_commission_pct": 5, "updated_at": now_utc().isoformat()}},
        )

        if await db.withdrawal_rules.count_documents({}) == 0:
            rules = [
                {"name": "Minimum withdrawable balance", "rule_type": "minimum_balance", "enabled": True, "value": {"amount": 100}, "message": "Reach 100 USDT withdrawable balance before requesting withdrawal.", "priority": 10},
                {"name": "Account age review", "rule_type": "account_age_days", "enabled": True, "value": {"days": 1}, "message": "New accounts enter manual review for the first 24 hours.", "priority": 20},
                {"name": "Manual review for all withdrawals", "rule_type": "manual_review", "enabled": True, "value": {"required": True}, "message": "Withdrawals are reviewed by finance before processing.", "priority": 90},
            ]
            for r in rules:
                await db.withdrawal_rules.insert_one({"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **r})

        if await db.fraud_rules.count_documents({}) == 0:
            for r in [
                {"name": "Multiple accounts on same IP", "rule_type": "multiple_accounts_ip", "risk_points": 25, "threshold": {"accounts": 3}, "enabled": True},
                {"name": "Rapid withdrawal attempts", "rule_type": "rapid_withdrawals", "risk_points": 30, "threshold": {"attempts": 3, "hours": 24}, "enabled": True},
                {"name": "Large balance movement", "rule_type": "large_balance_change", "risk_points": 20, "threshold": {"amount": 1000}, "enabled": True},
            ]:
                await db.fraud_rules.insert_one({"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **r})

    def anon_user(u: Optional[dict]) -> str:
        if not u:
            return "Eregon Member"
        name = (u.get("name") or "Eregon Member").strip()
        if not name:
            return "Eregon Member"
        return name[0].upper() + "***"

    async def evaluate_withdrawal_rules(user: dict) -> dict:
        rules = await db.withdrawal_rules.find({"enabled": True}, {"_id": 0}).sort("priority", 1).to_list(200)
        passed, failed, review = [], [], []
        balance = float(user.get("balance", 0))
        created = user.get("created_at")
        created_dt = None
        if isinstance(created, str):
            try:
                created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
            except Exception:
                created_dt = None
        for rule in rules:
            rt = rule.get("rule_type")
            value = rule.get("value") or {}
            ok = True
            item = {"id": rule["id"], "name": rule["name"], "type": rt, "message": rule.get("message", "")}
            if rt == "minimum_balance":
                ok = balance >= float(value.get("amount", 0))
                item["current"] = balance
                item["target"] = float(value.get("amount", 0))
            elif rt == "account_age_days" and created_dt:
                min_days = int(value.get("days", 0))
                ok = (now_utc() - created_dt).days >= min_days
                item["target_days"] = min_days
            elif rt == "vip_level":
                order = {"Free": 0, "Basic": 0, "Silver": 1, "Gold": 2, "Platinum": 3, "Elite VIP": 4}
                ok = order.get(user.get("membership_name") or "Free", 0) >= order.get(value.get("level") or "Free", 0)
                item["required_level"] = value.get("level")
            elif rt == "kyc_required":
                ok = bool(user.get("kyc_verified", False))
            elif rt == "manual_review":
                review.append(item)
                continue
            elif rt == "cooldown_hours":
                last = user.get("last_withdrawal_at")
                hours = int(value.get("hours", 0))
                ok = True
                if last:
                    try:
                        last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
                        ok = now_utc() - last_dt >= timedelta(hours=hours)
                    except Exception:
                        ok = True
                item["cooldown_hours"] = hours
            (passed if ok else failed).append(item)
        return {"eligible": len(failed) == 0, "passed": passed, "failed": failed, "review": review}

    async def score_user(user: dict) -> dict:
        score = 0
        reasons = []
        rules = await db.fraud_rules.find({"enabled": True}, {"_id": 0}).to_list(100)
        ip = user.get("last_ip")
        for rule in rules:
            rt = rule.get("rule_type")
            threshold = rule.get("threshold") or {}
            if rt == "multiple_accounts_ip" and ip:
                count = await db.users.count_documents({"last_ip": ip})
                if count >= int(threshold.get("accounts", 3)):
                    score += int(rule.get("risk_points", 10))
                    reasons.append({"rule": rule["name"], "detail": f"{count} accounts share the same recent IP"})
            elif rt == "rapid_withdrawals":
                hours = int(threshold.get("hours", 24))
                attempts = int(threshold.get("attempts", 3))
                since = (now_utc() - timedelta(hours=hours)).isoformat()
                count = await db.withdrawals.count_documents({"user_id": user["id"], "created_at": {"$gte": since}})
                if count >= attempts:
                    score += int(rule.get("risk_points", 10))
                    reasons.append({"rule": rule["name"], "detail": f"{count} withdrawal attempts in {hours}h"})
            elif rt == "large_balance_change":
                amount = float(threshold.get("amount", 1000))
                since = (now_utc() - timedelta(days=1)).isoformat()
                txs = await db.transactions.find({"user_id": user["id"], "created_at": {"$gte": since}}, {"_id": 0}).to_list(200)
                moved = sum(float(t.get("amount", 0)) for t in txs)
                if moved >= amount:
                    score += int(rule.get("risk_points", 10))
                    reasons.append({"rule": rule["name"], "detail": f"{moved:g} moved in 24h"})
        level = "low" if score < 30 else "medium" if score < 70 else "high"
        return {"user_id": user["id"], "risk_score": score, "risk_level": level, "reasons": reasons}

    @router.get("/enterprise/user-engagement")
    async def user_engagement(user: dict = Depends(get_current_user)):
        config = await db.platform_settings.find_one({"key": "withdrawal_config"}, {"_id": 0}) or {"value": {"minimum_withdrawal": 100}}
        min_withdrawal = float((config.get("value") or {}).get("minimum_withdrawal", 100))
        balance = float(user.get("balance", 0))
        progress = min(100, round((balance / min_withdrawal) * 100, 2)) if min_withdrawal > 0 else 100
        rules = await evaluate_withdrawal_rules(user)
        campaigns = await db.campaigns.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(10)
        activity_types = ["withdrawal_debit", "withdrawal_refund", "deposit_credit", "task_reward", "spin_reward", "first_task_reward", "bulk_bonus", "referral_commission"]
        recent = await db.transactions.find({"user_id": user["id"], "type": {"$in": activity_types}}, {"_id": 0}).sort("created_at", -1).to_list(12)
        if len(recent) < 4:
            global_recent = await db.transactions.find({"type": {"$in": activity_types}}, {"_id": 0}).sort("created_at", -1).to_list(12)
            seen = {t.get("id") for t in recent}
            recent.extend([t for t in global_recent if t.get("id") not in seen][:12 - len(recent)])
        activities = []
        for t in recent:
            u = await db.users.find_one({"id": t.get("user_id")}, {"_id": 0, "name": 1})
            activities.append({
                "id": t.get("id"), "type": t.get("type"), "amount": t.get("amount"), "coin": t.get("coin", "USDT"),
                "user_label": anon_user(u), "created_at": t.get("created_at"),
            })
        submissions = await db.task_submissions.find({"user_id": user["id"]}, {"_id": 0, "id": 1, "status": 1, "reward": 1, "created_at": 1}).sort("created_at", -1).to_list(6)
        for sub in submissions:
            activities.append({
                "id": f"submission-{sub.get('id')}",
                "type": f"task_{sub.get('status', 'submitted')}",
                "amount": sub.get("reward", 0),
                "coin": user.get("coin_symbol", "USDT"),
                "user_label": "You",
                "created_at": sub.get("created_at"),
            })
        activities = sorted(activities, key=lambda item: item.get("created_at") or "", reverse=True)[:12]
        return {"withdrawal_progress": {"current": balance, "target": min_withdrawal, "percent": progress}, "withdrawal_rules": rules, "campaigns": campaigns, "real_activity": activities}

    @router.post("/analytics/events")
    async def track_event(body: AnalyticsEventIn, request: Request, user: Optional[dict] = Depends(get_current_user)):
        rec = {"id": str(uuid.uuid4()), "user_id": user.get("id") if user else None, "event": body.event, "page": body.page, "metadata": body.metadata, "ip": request.client.host if request.client else None, "created_at": now_utc().isoformat()}
        await db.analytics_events.insert_one(rec)
        rec.pop("_id", None)
        return {"ok": True}

    @router.get("/withdrawal/rules/evaluate")
    async def user_withdrawal_rules(user: dict = Depends(get_current_user)):
        return await evaluate_withdrawal_rules(user)

    @router.get("/admin/enterprise/overview")
    async def admin_enterprise_overview(admin: dict = Depends(admin_required)):
        since = (now_utc() - timedelta(days=7)).isoformat()
        users = await db.users.count_documents({"role": "user"})
        withdrawals = await db.withdrawals.count_documents({"created_at": {"$gte": since}})
        deposits = await db.deposits.count_documents({"created_at": {"$gte": since}})
        events = await db.analytics_events.count_documents({"created_at": {"$gte": since}})
        high_risk = await db.fraud_events.count_documents({"risk_level": "high", "created_at": {"$gte": since}})
        rules = await db.withdrawal_rules.find({}, {"_id": 0}).sort("priority", 1).to_list(200)
        campaigns = await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
        return {"users": users, "withdrawals_7d": withdrawals, "deposits_7d": deposits, "analytics_events_7d": events, "high_risk_7d": high_risk, "withdrawal_rules": rules, "campaigns": campaigns}

    @router.get("/admin/platform-settings")
    async def admin_list_settings(admin: dict = Depends(admin_required)):
        return await db.platform_settings.find({}, {"_id": 0}).sort("key", 1).to_list(200)

    @router.post("/admin/platform-settings")
    async def admin_upsert_setting(body: PlatformSettingIn, admin: dict = Depends(admin_required)):
        rec = {"key": body.key, "value": body.value, "description": body.description, "updated_by": admin["id"], "updated_at": now_utc().isoformat()}
        await db.platform_settings.update_one({"key": body.key}, {"$set": rec, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now_utc().isoformat()}}, upsert=True)
        return await db.platform_settings.find_one({"key": body.key}, {"_id": 0})

    @router.get("/admin/withdrawal-rules")
    async def admin_list_withdrawal_rules(admin: dict = Depends(admin_required)):
        return await db.withdrawal_rules.find({}, {"_id": 0}).sort("priority", 1).to_list(200)

    @router.post("/admin/withdrawal-rules")
    async def admin_create_withdrawal_rule(body: WithdrawalRuleIn, admin: dict = Depends(admin_required)):
        rec = {"id": str(uuid.uuid4()), "created_by": admin["id"], "created_at": now_utc().isoformat(), **body.model_dump()}
        await db.withdrawal_rules.insert_one(rec)
        rec.pop("_id", None)
        await emit_admin("withdrawal_rules.changed", rec)
        return rec

    @router.patch("/admin/withdrawal-rules/{rule_id}")
    async def admin_update_withdrawal_rule(rule_id: str, body: WithdrawalRuleIn, admin: dict = Depends(admin_required)):
        await db.withdrawal_rules.update_one({"id": rule_id}, {"$set": {**body.model_dump(), "updated_by": admin["id"], "updated_at": now_utc().isoformat()}})
        rec = await db.withdrawal_rules.find_one({"id": rule_id}, {"_id": 0})
        if not rec:
            raise HTTPException(status_code=404, detail="Withdrawal rule not found")
        await emit_admin("withdrawal_rules.changed", rec)
        return rec

    @router.delete("/admin/withdrawal-rules/{rule_id}")
    async def admin_delete_withdrawal_rule(rule_id: str, admin: dict = Depends(admin_required)):
        await db.withdrawal_rules.delete_one({"id": rule_id})
        return {"ok": True}

    @router.get("/admin/campaigns")
    async def admin_list_campaigns(admin: dict = Depends(admin_required)):
        return await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)

    @router.post("/admin/campaigns")
    async def admin_create_campaign(body: CampaignIn, admin: dict = Depends(admin_required)):
        rec = {"id": str(uuid.uuid4()), "created_by": admin["id"], "created_at": now_utc().isoformat(), **body.model_dump()}
        await db.campaigns.insert_one(rec)
        rec.pop("_id", None)
        await emit_admin("campaign.created", rec)
        return rec

    @router.patch("/admin/campaigns/{campaign_id}")
    async def admin_update_campaign(campaign_id: str, body: CampaignIn, admin: dict = Depends(admin_required)):
        await db.campaigns.update_one({"id": campaign_id}, {"$set": {**body.model_dump(), "updated_by": admin["id"], "updated_at": now_utc().isoformat()}})
        rec = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
        if not rec:
            raise HTTPException(status_code=404, detail="Campaign not found")
        return rec

    @router.post("/admin/tasks-v2/bulk")
    async def admin_bulk_create_tasks(body: BulkTaskIn, admin: dict = Depends(admin_required)):
        docs = []
        for task in body.tasks:
            docs.append({
                "id": str(uuid.uuid4()),
                "title": str(task.get("title") or "Untitled task"),
                "description": task.get("description"),
                "reward": float(task.get("reward") or 1),
                "type": task.get("type") or "daily",
                "vip_level": task.get("vip_level"),
                "cooldown_hours": int(task.get("cooldown_hours") or 24),
                "thumbnail": task.get("thumbnail"),
                "active": bool(task.get("active", True)),
                "target_user_ids": task.get("target_user_ids") or None,
                "created_by": admin["id"],
                "created_at": now_utc().isoformat(),
            })
        if docs:
            await db.tasks.insert_many(docs)
        return {"ok": True, "created": len(docs), "tasks": docs}

    @router.post("/admin/simulations/profit-accrual")
    async def admin_profit_accrual(body: ProfitSimulationIn, admin: dict = Depends(admin_required)):
        q = {"role": "user"}
        if body.target == "tier" and body.tier:
            q["membership_name"] = body.tier
        elif body.target == "ids" and body.user_ids:
            q["id"] = {"$in": body.user_ids}
        users = await db.users.find(q, {"_id": 0}).to_list(5000)
        affected = 0
        total_delta = 0.0
        for u in users:
            field = body.balance_field
            before = float(u.get(field, 0))
            delta = float(body.amount) if body.amount is not None else before * (float(body.percent or 0) / 100)
            if delta == 0:
                continue
            after = before + delta
            await db.users.update_one({"id": u["id"]}, {"$set": {field: after}})
            await record_tx(u["id"], "admin_profit_accrual", abs(delta), u.get("coin_symbol", "USDT"), before, after, admin_id=admin["id"], note=body.note, status="completed")
            await emit_user(u["id"], "balance.updated", {"field": field, "before": before, "after": after, "delta": delta})
            affected += 1
            total_delta += delta
        return {"ok": True, "affected": affected, "total_delta": total_delta}

    @router.get("/admin/fraud/users")
    async def admin_fraud_users(admin: dict = Depends(admin_required), limit: int = 100):
        users = await db.users.find({"role": "user"}, {"_id": 0}).sort("last_active", -1).to_list(limit)
        results = []
        for u in users:
            results.append(await score_user(u))
        results.sort(key=lambda x: x["risk_score"], reverse=True)
        return results

    @router.post("/admin/fraud/scan/{user_id}")
    async def admin_scan_user(user_id: str, admin: dict = Depends(admin_required)):
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        result = await score_user(user)
        await db.fraud_events.insert_one({"id": str(uuid.uuid4()), **result, "scanned_by": admin["id"], "created_at": now_utc().isoformat()})
        return result

    @router.get("/admin/message-integrations")
    async def admin_list_integrations(admin: dict = Depends(admin_required)):
        return await db.message_integrations.find({}, {"_id": 0}).sort("provider", 1).to_list(50)

    @router.post("/admin/message-integrations")
    async def admin_upsert_integration(body: MessageIntegrationIn, admin: dict = Depends(admin_required)):
        rec = {**body.model_dump(), "updated_by": admin["id"], "updated_at": now_utc().isoformat()}
        await db.message_integrations.update_one({"provider": body.provider}, {"$set": rec, "$setOnInsert": {"id": str(uuid.uuid4()), "created_at": now_utc().isoformat()}}, upsert=True)
        return await db.message_integrations.find_one({"provider": body.provider}, {"_id": 0})

    @router.get("/support/channels")
    async def public_support_channels():
        items = await db.message_integrations.find({"enabled": True}, {"_id": 0, "webhook_url": 0, "settings": 0}).sort("provider", 1).to_list(20)
        return items

    return router, seed_enterprise
