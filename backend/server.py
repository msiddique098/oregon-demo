from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import asyncio
import uuid
import logging
import secrets
import random
import re
import json
import time
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from reward_math import normalize_plan_spin_fields, build_signup_spin_rewards
from trading_utils import (
    TRADING_FEE_RATE,
    animate_market_prices,
    apply_trade_balances,
    fallback_markets,
    market_price_map,
    merge_markets,
    normalize_symbol,
    pair_rate,
    split_pair,
)

import bcrypt
import jwt
from email_validator import EmailNotValidError, validate_email
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# ---------------- Config ----------------
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ACCESS_TTL_MIN = 60 * 24  # 24h
REFRESH_TTL_DAYS = 7
FREE_WITHDRAWAL_PROCESSING_HOURS = 144
PLAN_OWNER_DAILY_REWARD_PCT = 9.0
PUBLIC_MEMBER_COUNT_BASE = 115_000
PLAN_PROMO_OFFLINE_HOURS = 12
PLAN_PROMO_COOLDOWN_HOURS = 72
PLAN_PROMO_MAX_NOTIFICATIONS = 6
PLAN_PROMO_LOOP_SECONDS = 6 * 60 * 60
DEFAULT_WITHDRAWAL_NETWORK_TAXES = [
    {"coin": "USDT", "network": "TRC20", "tax_pct": 1.0},
    {"coin": "USDT", "network": "BEP20", "tax_pct": 1.0},
    {"coin": "USDT", "network": "ERC20", "tax_pct": 3.0},
    {"coin": "BTC", "network": "Bitcoin", "tax_pct": 2.0},
    {"coin": "ETH", "network": "ERC20", "tax_pct": 3.0},
    {"coin": "BNB", "network": "BEP20", "tax_pct": 1.0},
]
COINGECKO_API_BASE = os.environ.get("COINGECKO_API_BASE", "https://api.coingecko.com/api/v3").rstrip("/")
COINGECKO_API_KEY = os.environ.get("COINGECKO_API_KEY", "").strip()
COINGECKO_API_KEY_HEADER = os.environ.get("COINGECKO_API_KEY_HEADER", "x-cg-demo-api-key").strip() or "x-cg-demo-api-key"
MARKET_CACHE_SECONDS = int(os.environ.get("MARKET_CACHE_SECONDS", "25"))
TRADING_DEFAULT_LIMIT = int(os.environ.get("TRADING_DEFAULT_MARKET_LIMIT", "200"))
BINANCE_API_BASE = os.environ.get("BINANCE_API_BASE", "https://api.binance.com/api/v3").rstrip("/")
OPTIONS_PAYOUT_RATE = float(os.environ.get("OPTIONS_PAYOUT_RATE", "0.8"))
OPTIONS_DURATIONS_SECONDS = [30, 60, 120, 300]


mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("eregon")

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Eregon Marketing API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # using bearer tokens
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

async def _phase2_emit_user(user_id: str, event: str, payload: dict):
    manager = globals().get("_ws_manager")
    if manager:
        try:
            await manager.emit_user(user_id, event, payload)
        except Exception as exc:
            logger.warning("phase2 user websocket emit failed: %s", exc)

async def _phase2_emit_all(event: str, payload: dict):
    manager = globals().get("_ws_manager")
    if manager:
        try:
            await manager.emit_all(event, payload)
        except Exception as exc:
            logger.warning("phase2 websocket emit failed: %s", exc)

async def _phase2_emit_admin(event: str, payload: dict):
    manager = globals().get("_ws_manager")
    if manager:
        try:
            await manager.emit_admin(event, payload)
        except Exception as exc:
            logger.warning("phase2 admin websocket emit failed: %s", exc)

# ---------------- Helpers ----------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _masked_name(first: str, last: str) -> str:
    first_visible = max(1, min(3, len(first) - 1))
    last_visible = 1 if len(last) > 1 else len(last)
    return f"{first[:first_visible]}{'*' * max(1, len(first) - first_visible)} {last[:last_visible]}{'*' * max(1, len(last) - last_visible)}"


def _build_live_feed_seed(total: int = 80) -> list[dict]:
    """Seed neutral public feed messages without exposing individual member records."""
    templates = [
        ("check", "Task proof queue updated: new submissions are ready for admin review"),
        ("wallet", "Wallet workflow refreshed: approved rewards are reflected after review"),
        ("crown", "Membership plan workflow updated with current task and spin rules"),
        ("users", "Referral dashboard refreshed with eligible commission status"),
        ("sparkles", "Plan spin rewards are issued through queued spins"),
        ("diamond", "Withdrawal review queue updated for pending requests"),
        ("trending", "Campaign task list refreshed with new proof requirements"),
        ("check", "Completed task proofs move to balance only after approval"),
        ("wallet", "Balance summary now shows approved rewards and pending locks separately"),
        ("crown", "Plan benefits are synced with withdrawal priority and spin access"),
        ("users", "Team activity summary updated for referral reporting"),
        ("sparkles", "Reward hub refreshed with plan spins and task status"),
        ("diamond", "Withdrawal eligibility uses balance, locks, and pending request checks"),
        ("trending", "Admin workflow updated for deposits, plans, and commissions"),
        ("check", "Screenshot proof rules refreshed for clearer approval decisions"),
        ("wallet", "Approved task rewards are included in the lifetime total"),
    ]
    entries = []
    base_time = now_utc()
    for i in range(total):
        icon, message = templates[i % len(templates)]
        entries.append({
            "id": str(uuid.uuid4()),
            "message": message,
            "icon": icon,
            "source": "system_seed",
            "created_at": (base_time - timedelta(minutes=i * 5)).isoformat(),
        })
    return entries

def iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if dt else None

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_token(user_id: str, role: str, ttl_min: int = ACCESS_TTL_MIN) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": now_utc() + timedelta(minutes=ttl_min),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])

def gen_referral_code() -> str:
    return secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8].upper()

def gen_registration_code() -> str:
    return "EREGON-" + secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:8].upper()

# ---------------- Ledger ----------------
# Transaction types: admin_credit, admin_debit, admin_user_reward, registration_code_reward, withdrawal_debit, withdrawal_refund,
# deposit_credit, referral_commission, referral_join_bonus, task_reward, membership_bonus, bulk_bonus, spin_reward
async def record_tx(user_id: str, type_: str, amount: float, coin: str,
                    before_balance: float, after_balance: float,
                    admin_id: Optional[str] = None, reference_id: Optional[str] = None,
                    note: Optional[str] = None, status: str = "completed") -> dict:
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": type_,
        "amount": float(amount),
        "coin": coin,
        "before_balance": float(before_balance),
        "after_balance": float(after_balance),
        "admin_id": admin_id,
        "reference_id": reference_id,
        "note": note,
        "status": status,
        "created_at": now_utc().isoformat(),
    }
    await db.transactions.insert_one(rec)
    rec.pop("_id", None)
    await _phase2_emit_user(user_id, "transaction.created", rec)
    return rec

# ---------------- RBAC ----------------
# admin_role values: super_admin (full), finance (financial), support (tickets), moderator (read+notify)
PERMISSIONS = {
    "super_admin": {"users.*", "packages.*", "wallets.*", "withdrawals.*", "deposits.*",
                     "announcements.*", "notifications.*", "transactions.read", "activity.read",
                     "tickets.*", "feed.*", "bulk.*", "settings.*"},
    "finance":     {"users.read", "users.update_balance", "withdrawals.*", "deposits.*",
                     "transactions.read", "bulk.*", "packages.read"},
    "support":     {"users.read", "tickets.*", "notifications.*", "activity.read"},
    "moderator":   {"users.read", "transactions.read", "activity.read", "tickets.read"},
}

def has_permission(role: str, perm: str) -> bool:
    if role not in PERMISSIONS:
        return False
    grants = PERMISSIONS[role]
    if perm in grants:
        return True
    prefix = perm.split(".")[0] + ".*"
    return prefix in grants

def require_perm(perm: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
        role = user.get("admin_role", "super_admin")
        if not has_permission(role, perm):
            raise HTTPException(status_code=403, detail=f"Missing permission: {perm}")
        return user
    return dep

# ---------------- Models ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)
    referral_code: Optional[str] = None
    # Optional admin-issued invitation / identity code for signup bonuses.
    registration_code: Optional[str] = Field(default=None, max_length=40)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class ForgotIn(BaseModel):
    email: EmailStr

class VerifyEmailIn(BaseModel):
    email: EmailStr

class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=6)

class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: str
    admin_role: Optional[str] = None
    referral_code: str
    referred_by: Optional[str] = None
    membership_id: Optional[str] = None
    membership_name: Optional[str] = None
    coin_symbol: str = "USDT"
    balance: float = 0.0
    crypto_balances: dict = Field(default_factory=dict)
    daily_profit: float = 0.0
    total_earnings: float = 0.0
    referral_earnings: float = 0.0
    task_progress: float = 0.0
    tasks_completed: int = 0
    tasks_pending: int = 0
    commission_rate: float = 0.0
    status: str = "active"
    withdrawal_processing_hours: int = FREE_WITHDRAWAL_PROCESSING_HOURS

    # Phase 2: categorized balances + gamification
    locked_balance: float = 0.0
    bonus_balance: float = 0.0
    current_streak: int = 0
    longest_streak: int = 0
    last_checkin_at: Optional[str] = None
    spin_tokens: int = 0
    last_spin_at: Optional[str] = None
    achievement_count: int = 0

    # Admin-issued registration identity and first-task reward tracking
    registration_code: Optional[str] = None
    registration_code_id: Optional[str] = None
    first_task_reward_amount: float = 10.0
    first_task_reward_coin: str = "USDT"
    first_task_reward_claimed: bool = False
    first_task_reward_claimed_at: Optional[str] = None

    created_at: str
    last_active: Optional[str] = None

class AuthOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class AdminUpdateUserIn(BaseModel):
    name: Optional[str] = None
    coin_symbol: Optional[str] = None
    balance: Optional[float] = None
    daily_profit: Optional[float] = None
    total_earnings: Optional[float] = None
    referral_earnings: Optional[float] = None
    task_progress: Optional[float] = None
    tasks_completed: Optional[int] = None
    tasks_pending: Optional[int] = None
    commission_rate: Optional[float] = None
    status: Optional[Literal["active", "suspended"]] = None
    membership_id: Optional[str] = None
    withdrawal_processing_hours: Optional[int] = None
    locked_balance: Optional[float] = None
    bonus_balance: Optional[float] = None
    spin_tokens: Optional[int] = None
    current_streak: Optional[int] = None
    longest_streak: Optional[int] = None

class PackageIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    tier: str = Field(min_length=1, max_length=40)  # Basic | Silver | Gold | Platinum | Elite VIP
    investment: float = Field(gt=0)
    # Daily rewards are disabled. Kept for backwards-compatible reads only;
    # package create/update normalizes this value to 0.0.
    daily_profit_pct: float = 0.0
    commission_boost_pct: float = Field(default=0.0, ge=0)
    task_boost_pct: float = Field(default=0.0, ge=0)
    duration_days: int = Field(gt=0)
    badge_color: str = "purple"
    perks: List[str] = []
    priority_withdrawal_hours: int = Field(default=24, ge=0)
    spin_tokens: Optional[int] = Field(default=None, ge=0, le=100)
    spin_reward_queue: Optional[List[float]] = None
    plan_spin_reward_total: float = 0.0
    plan_spin_reward_pct: float = 1.0

class PackageOut(PackageIn):
    id: str
    created_at: str

class WalletIn(BaseModel):
    coin: str
    network: str
    address: str
    note: Optional[str] = None

class WalletOut(WalletIn):
    id: str

class WithdrawIn(BaseModel):
    amount: float
    coin: str
    network: str = "TRC20"
    address: str

class WithdrawOut(BaseModel):
    id: str
    user_id: str
    user_email: str
    user_name: str
    amount: float
    coin: str
    network: str = "TRC20"
    address: str
    network_tax_pct: float = 0.0
    network_tax_amount: float = 0.0
    receive_amount: float = 0.0
    status: str  # pending|reviewing|approved|processing|completed|rejected
    processing_hours: int
    created_at: str
    decided_at: Optional[str] = None
    admin_note: Optional[str] = None
    stages: List[dict] = []

class WithdrawDecisionIn(BaseModel):
    status: Literal["pending", "reviewing", "approved", "processing", "completed", "rejected"]
    processing_hours: Optional[int] = None
    admin_note: Optional[str] = None
    address: Optional[str] = None
    network: Optional[str] = None

class DepositIn(BaseModel):
    amount: float
    coin: str
    tx_hash: Optional[str] = None
    proof_data_url: Optional[str] = None
    package_id: Optional[str] = None

class DepositOut(BaseModel):
    id: str
    user_id: str
    user_email: str
    amount: float
    coin: str
    tx_hash: Optional[str] = None
    proof_data_url: Optional[str] = None
    package_id: Optional[str] = None
    package_name: Optional[str] = None
    status: str
    created_at: str

class DepositDecisionIn(BaseModel):
    status: Literal["pending", "approved", "rejected"]
    admin_note: Optional[str] = None
    deterministic_spin_values: Optional[List[float]] = None

class AnnouncementIn(BaseModel):
    title: str
    body: str
    pinned: bool = False

class AnnouncementOut(AnnouncementIn):
    id: str
    created_at: str

class NotificationIn(BaseModel):
    user_id: str  # "all" sends to everyone
    title: str
    body: str
    category: Literal["rewards", "withdrawals", "membership", "security", "promotions", "support", "system"] = "system"

class NotificationOut(BaseModel):
    id: str
    user_id: str
    title: str
    body: str
    category: str = "system"
    read: bool
    created_at: str

class RegistrationCodeIn(BaseModel):
    code: Optional[str] = None
    reward_amount: float = 10.0
    reward_coin: str = "USDT"
    plan_name: str = "Free"
    max_uses: int = Field(default=1, ge=1)
    note: Optional[str] = None

class RegistrationCodeOut(BaseModel):
    id: str
    code: str
    reward_amount: float
    reward_coin: str
    plan_name: str
    status: str
    max_uses: int
    used_count: int
    note: Optional[str] = None
    created_by: Optional[str] = None
    created_at: str

class RegistrationCodeStatusIn(BaseModel):
    status: Literal["active", "inactive"]


class MarketCoinOut(BaseModel):
    id: str
    symbol: str
    name: str
    image: Optional[str] = None
    current_price: float
    market_cap: float = 0.0
    market_cap_rank: Optional[int] = None
    total_volume: float = 0.0
    price_change_percentage_24h: float = 0.0
    sparkline_in_7d: dict = Field(default_factory=dict)
    source: str = "coingecko"
    custom: bool = False
    updated_at: Optional[str] = None


class TradingOrderIn(BaseModel):
    pair: str = Field(min_length=3, max_length=24)
    side: Literal["buy", "sell"]
    amount: float = Field(gt=0)
    order_type: Literal["market"] = "market"


class MarketPriceTargetIn(BaseModel):
    symbol: str = Field(min_length=2, max_length=16)
    target_price: float = Field(gt=0)
    duration_seconds: int = Field(default=12, ge=10, le=15)


class OptionsTradeIn(BaseModel):
    pair: str = Field(min_length=3, max_length=24)
    direction: Literal["up", "down"]
    stake: float = Field(gt=0)
    duration_seconds: int = Field(default=60)


class OptionsOutcomeIn(BaseModel):
    outcome: Literal["win", "lose", "auto"]


class TradingOrderOut(BaseModel):
    id: str
    user_id: str
    pair: str
    side: str
    base_symbol: str
    quote_symbol: str
    amount: float
    rate: float
    executed_base: float
    executed_quote: float
    fee_amount: float
    fee_coin: str
    status: str
    created_at: str


class PracticeSeedIn(BaseModel):
    count: int = Field(default=1500, ge=1, le=5000)
    password: str = Field(default="Practice@123", min_length=6, max_length=128)

# ---------------- Auth ----------------
async def get_token(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    cookie = request.cookies.get("access_token")
    if cookie:
        return cookie
    raise HTTPException(status_code=401, detail="Not authenticated")

async def get_current_user(request: Request) -> dict:
    token = await get_token(request)
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user = await accrue_plan_owner_daily_reward(user)
    return user

DISALLOWED_SIGNUP_DOMAINS = {
    "example.com",
    "example.net",
    "example.org",
    "test.com",
    "mailinator.com",
    "tempmail.com",
    "10minutemail.com",
    "guerrillamail.com",
    "yopmail.com",
    "trashmail.com",
    "dispostable.com",
}


async def verify_signup_email_address(email: str) -> str:
    normalized = str(email or "").strip().lower()
    if await db.users.find_one({"email": normalized}):
        raise HTTPException(status_code=400, detail="Email already registered")

    domain = normalized.rsplit("@", 1)[-1] if "@" in normalized else ""
    if domain in DISALLOWED_SIGNUP_DOMAINS or domain.endswith((".test", ".invalid", ".localhost")):
        raise HTTPException(status_code=400, detail="Use a real email address that can receive mail")

    try:
        result = validate_email(normalized, check_deliverability=True)
    except EmailNotValidError as exc:
        raise HTTPException(status_code=400, detail=f"Email cannot be verified: {exc}") from exc

    return result.normalized.lower()

async def admin_required(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

def require_wallet_manager(admin: dict) -> None:
    if not has_permission(admin.get("admin_role", ""), "wallets.manage"):
        raise HTTPException(status_code=403, detail="Super admin access required for wallet management")

def user_withdrawal_processing_hours(user: dict) -> int:
    if not user.get("membership_id"):
        return FREE_WITHDRAWAL_PROCESSING_HOURS
    return int(user.get("withdrawal_processing_hours", FREE_WITHDRAWAL_PROCESSING_HOURS))

async def withdrawal_network_taxes() -> list[dict]:
    doc = await db.platform_settings.find_one({"key": "withdrawal_network_taxes"}, {"_id": 0})
    configured = (doc or {}).get("value", {}).get("networks")
    networks = configured if isinstance(configured, list) and configured else DEFAULT_WITHDRAWAL_NETWORK_TAXES
    cleaned = []
    for item in networks:
        try:
            coin = str(item.get("coin", "")).strip().upper()
            network = str(item.get("network", "")).strip()
            tax_pct = max(0.0, float(item.get("tax_pct", 0)))
        except (AttributeError, TypeError, ValueError):
            continue
        if coin and network:
            cleaned.append({"coin": coin, "network": network, "tax_pct": tax_pct})
    return cleaned or DEFAULT_WITHDRAWAL_NETWORK_TAXES

async def withdrawal_quote(amount: float, coin: str, network: str) -> dict:
    coin_value = str(coin or "USDT").strip().upper()
    network_value = str(network or "").strip()
    taxes = await withdrawal_network_taxes()
    match = next(
        (item for item in taxes if item["coin"] == coin_value and item["network"].lower() == network_value.lower()),
        None,
    )
    if not match:
        match = next((item for item in taxes if item["coin"] == coin_value), None)
    tax_pct = float((match or {}).get("tax_pct", 0.0))
    clean_network = (match or {}).get("network") or network_value or "TRC20"
    value = max(0.0, float(amount or 0))
    tax_amount = round(value * tax_pct / 100.0, 2)
    receive_amount = round(max(0.0, value - tax_amount), 2)
    return {
        "coin": coin_value,
        "network": clean_network,
        "network_tax_pct": tax_pct,
        "network_tax_amount": tax_amount,
        "receive_amount": receive_amount,
    }

def practice_users_enabled() -> bool:
    return os.environ.get("SEED_PRACTICE_USERS", "false").lower() in {"1", "true", "yes", "on"}

REAL_USER_QUERY = {
    "role": "user",
    "practice_seed": {"$ne": True},
    "email": {"$not": re.compile("(demo|test)", re.IGNORECASE)},
}

def admin_stats_user_query() -> dict:
    query = {
        "role": "user",
        "email": {"$not": re.compile("(demo|test)", re.IGNORECASE)},
    }
    if os.environ.get("INCLUDE_PRACTICE_USERS_IN_STATS", "false").lower() not in {"1", "true", "yes", "on"}:
        query["practice_seed"] = {"$ne": True}
    return query

def user_to_out(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u["name"],
        "role": u["role"],
        "admin_role": u.get("admin_role") if u.get("role") == "admin" else None,
        "referral_code": u.get("referral_code", ""),
        "referred_by": u.get("referred_by"),
        "membership_id": u.get("membership_id"),
        "membership_name": u.get("membership_name"),
        "coin_symbol": u.get("coin_symbol", "USDT"),
        "balance": float(u.get("balance", 0)),
        "crypto_balances": u.get("crypto_balances", {}),
        "daily_profit": float(u.get("daily_profit", 0)),
        "total_earnings": float(u.get("total_earnings", 0)),
        "referral_earnings": float(u.get("referral_earnings", 0)),
        "task_progress": float(u.get("task_progress", 0)),
        "tasks_completed": int(u.get("tasks_completed", 0)),
        "tasks_pending": int(u.get("tasks_pending", 0)),
        "commission_rate": float(u.get("commission_rate", 0)),
        "status": u.get("status", "active"),
        "withdrawal_processing_hours": user_withdrawal_processing_hours(u),
        "locked_balance": float(u.get("locked_balance", 0)),
        "bonus_balance": float(u.get("bonus_balance", 0)),
        "current_streak": int(u.get("current_streak", 0)),
        "longest_streak": int(u.get("longest_streak", 0)),
        "last_checkin_at": u.get("last_checkin_at"),
        "spin_tokens": int(u.get("spin_tokens", 0)),
        "last_spin_at": u.get("last_spin_at"),
        "achievement_count": int(u.get("achievement_count", 0)),
        "registration_code": u.get("registration_code"),
        "registration_code_id": u.get("registration_code_id"),
        "first_task_reward_amount": float(u.get("first_task_reward_amount", 10.0)),
        "first_task_reward_coin": u.get("first_task_reward_coin", "USDT"),
        "first_task_reward_claimed": bool(u.get("first_task_reward_claimed", False)),
        "first_task_reward_claimed_at": u.get("first_task_reward_claimed_at"),
        "created_at": u["created_at"] if isinstance(u["created_at"], str) else u["created_at"].isoformat(),
        "last_active": u.get("last_active"),
    }

WALLET_BALANCE_TX_TYPES = {
    "admin_credit",
    "admin_debit",
    "admin_user_reward",
    "registration_code_reward",
    "withdrawal_debit",
    "withdrawal_refund",
    "deposit_credit",
    "deposit_bonus_30",
    "bulk_bonus",
    "referral_commission",
    "referral_join_bonus",
    "task_reward",
    "membership_bonus",
    "daily_checkin",
    "spin_reward",
    "achievement_reward",
    "first_task_reward",
}


async def accrue_plan_owner_daily_reward(user: dict) -> dict:
    if not user or user.get("role") == "admin" or not user.get("membership_id"):
        return user

    today = now_utc().date().isoformat()
    if user.get("plan_daily_reward_last_date") == today:
        return user

    package = await db.packages.find_one({"id": user["membership_id"]}, {"_id": 0})
    if not package:
        return user

    try:
        investment = float(package.get("investment", 0))
    except (TypeError, ValueError):
        return user
    if investment <= 0:
        return user

    reward = round(investment * (PLAN_OWNER_DAILY_REWARD_PCT / 100.0), 2)
    if reward <= 0:
        return user

    reference_id = f"plan_owner_daily:{user['id']}:{user['membership_id']}:{today}"
    existing = await db.transactions.find_one(
        {"user_id": user["id"], "type": "membership_bonus", "reference_id": reference_id},
        {"_id": 0, "after_balance": 1},
    )
    if existing:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"plan_daily_reward_last_date": today, "plan_daily_reward_last_at": now_utc().isoformat()}},
        )
        return await db.users.find_one({"id": user["id"]}, {"_id": 0}) or user

    before_balance = round(float(user.get("balance", 0)), 2)
    after_balance = round(before_balance + reward, 2)
    now = now_utc().isoformat()
    result = await db.users.update_one(
        {
            "id": user["id"],
            "membership_id": user["membership_id"],
            "$or": [
                {"plan_daily_reward_last_date": {"$exists": False}},
                {"plan_daily_reward_last_date": {"$ne": today}},
            ],
        },
        {
            "$inc": {
                "balance": reward,
                "daily_profit": reward,
                "total_earnings": reward,
                "bonus_balance": reward,
            },
            "$set": {
                "plan_daily_reward_last_date": today,
                "plan_daily_reward_last_at": now,
                "plan_daily_reward_pct": PLAN_OWNER_DAILY_REWARD_PCT,
                "updated_at": now,
            },
        },
    )
    if result.modified_count == 0:
        return await db.users.find_one({"id": user["id"]}, {"_id": 0}) or user

    await record_tx(
        user["id"],
        "membership_bonus",
        reward,
        user.get("coin_symbol", "USDT"),
        before_balance,
        after_balance,
        reference_id=reference_id,
        note=f"Daily plan owner reward ({PLAN_OWNER_DAILY_REWARD_PCT:g}%) for {package.get('name', 'active plan')}",
    )
    await _phase2_emit_user(user["id"], "balance.updated", {
        "balance": after_balance,
        "bonus_balance": round(float(user.get("bonus_balance", 0)) + reward, 2),
        "delta": reward,
        "source": "membership_bonus",
    })
    return await db.users.find_one({"id": user["id"]}, {"_id": 0}) or {**user, "balance": after_balance}


async def reconcile_user_wallet_balance(user: dict) -> dict:
    if not user or user.get("role") == "admin":
        return user
    latest = await db.transactions.find(
        {"user_id": user["id"], "type": {"$in": list(WALLET_BALANCE_TX_TYPES)}},
        {"_id": 0, "after_balance": 1},
    ).sort("created_at", -1).to_list(1)
    if not latest:
        return user
    try:
        ledger_balance = round(float(latest[0].get("after_balance", user.get("balance", 0))), 8)
        current_balance = round(float(user.get("balance", 0)), 8)
    except (TypeError, ValueError):
        return user
    if ledger_balance != current_balance:
        await db.users.update_one({"id": user["id"]}, {"$set": {"balance": ledger_balance}})
        user = {**user, "balance": ledger_balance}
    return user


def _normalize_package_document(data: dict) -> dict:
    """Normalize package fields so every plan spin pool totals exactly 1%."""
    payload = dict(data)
    payload.update(normalize_plan_spin_fields(payload))
    payload["daily_profit_pct"] = 0.0
    perks = payload.get("perks") or []
    cleaned_perks = []
    for perk in perks:
        text = str(perk)
        if "daily" in text.lower() and "reward" in text.lower():
            text = "Plan spin rewards"
        cleaned_perks.append(text)
    if cleaned_perks:
        payload["perks"] = cleaned_perks
    return payload


async def _grant_plan_spin_rewards(user_id: str, package: dict, admin_id: Optional[str] = None) -> dict:
    """Queue deterministic plan spin rewards for a user once per assigned plan.

    Actual money is credited only when each spin is consumed, preserving the
    existing ledger and wallet flow while preventing random or duplicate payouts.
    """
    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")

    if package.get("custom_spin_rewards") and isinstance(package.get("spin_reward_queue"), list):
        queue = _clean_spin_values(package.get("spin_reward_queue"))
        package_doc = {
            **package,
            "spin_tokens": len(queue),
            "spin_reward_queue": queue,
            "plan_spin_reward_total": round(sum(queue), 2),
            "plan_spin_reward_pct": float(package.get("plan_spin_reward_pct", 0)),
        }
    else:
        package_doc = _normalize_package_document(package)
    queue = list(package_doc.get("spin_reward_queue") or [])
    if not queue:
        return {"granted": False, "reason": "Plan has no spin rewards"}

    if user_doc.get("plan_spin_reward_source_id") == package_doc.get("id"):
        return {"granted": False, "reason": "Plan spin rewards already queued for this plan"}

    now = now_utc().isoformat()
    existing_queue = list(user_doc.get("spin_reward_queue") or [])
    existing_tokens = max(0, int(user_doc.get("spin_tokens", 0)))
    await db.users.update_one(
        {"id": user_id},
        {
            "$set": {
                "spin_tokens": existing_tokens + len(queue),
                "spin_reward_queue": existing_queue + queue,
                "plan_spin_reward_source_id": package_doc.get("id"),
                "plan_spin_reward_total": package_doc.get("plan_spin_reward_total", round(sum(queue), 2)),
                "plan_spin_reward_pct": package_doc.get("plan_spin_reward_pct", 1.0),
                "plan_spin_reward_granted_at": now,
            }
        },
    )
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": "Plan Spins Added",
        "body": f"{len(queue)} spin tokens were added for {package_doc.get('name', 'your plan')}. Use them in the Reward Hub to unlock your plan rewards.",
        "category": "rewards",
        "read": False,
        "created_at": now,
    })
    await _phase2_emit_user(user_id, "plan.spins_granted", {
        "package_id": package_doc.get("id"),
        "package_name": package_doc.get("name"),
        "spin_tokens": len(queue),
        "plan_spin_reward_total": package_doc.get("plan_spin_reward_total", round(sum(queue), 2)),
    })
    return {"granted": True, "spin_tokens": len(queue), "total_reward": package_doc.get("plan_spin_reward_total", round(sum(queue), 2))}


def _clean_spin_values(values: Optional[List[float]]) -> list[float]:
    cleaned = []
    for value in values or []:
        try:
            amount = round(float(value), 2)
        except (TypeError, ValueError):
            continue
        if amount > 0:
            cleaned.append(amount)
    return cleaned


def _build_random_deposit_spin_rewards(amount: float, spin_count: int) -> list[float]:
    total_pct = random.uniform(1.0, 7.0)
    total_cents = max(1, int(round(float(amount) * total_pct)))
    count = max(1, min(int(spin_count or 1), total_cents))
    cuts = sorted(random.sample(range(1, total_cents), count - 1)) if count > 1 else []
    parts = []
    previous = 0
    for cut in cuts + [total_cents]:
        parts.append(cut - previous)
        previous = cut
    random.shuffle(parts)
    return [round(part / 100.0, 2) for part in parts]


async def _migrate_packages_to_plan_spins() -> None:
    """Startup migration for legacy packages that had daily-profit rewards."""
    async for package in db.packages.find({}):
        normalized = _normalize_package_document(package)
        await db.packages.update_one(
            {"id": package["id"]},
            {"$set": {
                "daily_profit_pct": 0.0,
                "spin_tokens": normalized["spin_tokens"],
                "spin_reward_queue": normalized["spin_reward_queue"],
                "plan_spin_reward_total": normalized["plan_spin_reward_total"],
                "plan_spin_reward_pct": normalized["plan_spin_reward_pct"],
                "perks": normalized.get("perks", package.get("perks", [])),
                "updated_at": now_utc().isoformat(),
                "migration": "plan_spin_rewards_v1",
            }}
        )

# ---------------- Auth Routes ----------------
@api.post("/auth/verify-email")
async def verify_email(body: VerifyEmailIn):
    email = await verify_signup_email_address(body.email)
    return {"ok": True, "email": email, "message": "Email looks valid and can receive mail"}

@api.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn, response: Response):
    email = await verify_signup_email_address(body.email)

    registration_code = (body.registration_code or "").strip().upper()
    reg_code = None
    if registration_code:
        if len(registration_code) < 4:
            raise HTTPException(status_code=400, detail="Registration code must be at least 4 characters")
        reg_code = await db.registration_codes.find_one(
            {"code": registration_code, "status": "active"},
            {"_id": 0},
        )
        if not reg_code:
            raise HTTPException(status_code=400, detail="Invalid or inactive registration code")

        max_uses = int(reg_code.get("max_uses", 1))
        used_count = int(reg_code.get("used_count", 0))
        if used_count >= max_uses:
            raise HTTPException(status_code=400, detail="Registration code has already been used")

    referred_by = None
    if body.referral_code:
        ref = await db.users.find_one({"referral_code": body.referral_code.upper()}, {"_id": 0})
        if ref:
            referred_by = ref["id"]

    signup_reward_coin = (reg_code or {}).get("reward_coin", "USDT").upper()
    signup_code_reward = round(max(0.0, float((reg_code or {}).get("reward_amount", 0.0))), 2) if reg_code else 0.0
    referral_bonus = 5.0 if referred_by else 0.0
    created_at = now_utc().isoformat()
    welcome_spin_queue = build_signup_spin_rewards() if reg_code else []
    welcome_spin_total = round(sum(welcome_spin_queue), 2)
    opening_balance = round(signup_code_reward + referral_bonus, 2)

    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": body.name,
        "password_hash": hash_password(body.password),
        "role": "user",
        "referral_code": gen_referral_code(),
        "referred_by": referred_by,
        "registration_code": registration_code or None,
        "registration_code_id": reg_code["id"] if reg_code else None,
        "coin_symbol": signup_reward_coin,
        # Registration-code reward is credited immediately. Welcome spins are
        # additional stored rewards that credit only when the user spins.
        "balance": opening_balance,
        "daily_profit": 0.0,
        "total_earnings": 0.0,
        "referral_earnings": 0.0,
        "task_progress": 0.0,
        "tasks_completed": 0,
        "tasks_pending": 0,
        "commission_rate": 5.0,
        "status": "active",
        "withdrawal_processing_hours": FREE_WITHDRAWAL_PROCESSING_HOURS,
        "locked_balance": 0.0,
        "bonus_balance": opening_balance,
        "current_streak": 0,
        "longest_streak": 0,
        "last_checkin_at": None,
        "spin_tokens": len(welcome_spin_queue),
        "spin_count": 0,
        "spin_reward_queue": welcome_spin_queue,
        "signup_spin_reward_total": welcome_spin_total,
        "signup_spin_reward_granted_at": created_at,
        "signup_spin_reward_source_id": reg_code["id"] if reg_code else None,
        "last_spin_at": None,
        "achievement_count": 0,
        "membership_id": None,
        "membership_name": (reg_code or {}).get("plan_name", "Free"),
        "first_task_reward_amount": 0.0,
        "first_task_reward_coin": signup_reward_coin,
        "first_task_reward_claimed": True,
        "first_task_reward_claimed_at": created_at,
        "created_at": created_at,
    }
    await db.users.insert_one(user)

    if signup_code_reward > 0:
        await record_tx(
            user_id=user["id"],
            type_="registration_code_reward",
            amount=signup_code_reward,
            coin=signup_reward_coin,
            before_balance=0.0,
            after_balance=signup_code_reward,
            admin_id=reg_code.get("created_by"),
            reference_id=reg_code.get("id"),
            note=reg_code.get("note") or f"Registration code reward for {registration_code}",
        )
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "title": "Signup Reward Credited",
            "body": f"You received {signup_code_reward:g} {signup_reward_coin} from your registration code.",
            "category": "rewards",
            "read": False,
            "created_at": created_at,
        })

    if referred_by:
        referrer = await db.users.find_one({"id": referred_by}, {"_id": 0})
        if referrer:
            ref_coin = referrer.get("coin_symbol", "USDT")
            ref_before = float(referrer.get("balance", 0))
            ref_after = round(ref_before + 5.0, 2)
            ref_earnings = round(float(referrer.get("referral_earnings", 0)) + 5.0, 2)
            await db.users.update_one(
                {"id": referred_by},
                {"$set": {"balance": ref_after, "referral_earnings": ref_earnings, "bonus_balance": round(float(referrer.get("bonus_balance", 0)) + 5.0, 2)}},
            )
            await record_tx(
                user_id=referred_by,
                type_="referral_commission",
                amount=5.0,
                coin=ref_coin,
                before_balance=ref_before,
                after_balance=ref_after,
                reference_id=user["id"],
                note=f"Referral reward for inviting {email}",
            )
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": referred_by,
                "title": "Referral Reward Credited",
                "body": f"You received 5 {ref_coin} for a successful referral.",
                "category": "rewards",
                "read": False,
                "created_at": created_at,
            })
        await record_tx(
            user_id=user["id"],
            type_="referral_commission",
            amount=5.0,
            coin=signup_reward_coin,
            before_balance=signup_code_reward,
            after_balance=opening_balance,
            reference_id=referred_by,
            note="Referral signup reward",
        )
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "title": "Referral Reward Credited",
            "body": f"You received 5 {signup_reward_coin} for joining through a referral.",
            "category": "rewards",
            "read": False,
            "created_at": created_at,
        })

    if welcome_spin_queue:
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "title": "Welcome Spins Added",
            "body": f"You received {len(welcome_spin_queue)} welcome spins from your registration code.",
            "category": "rewards",
            "read": False,
            "created_at": created_at,
        })
    if reg_code:
        await db.registration_codes.update_one(
            {"id": reg_code["id"]},
            {
                "$inc": {"used_count": 1},
                "$push": {
                    "used_by": {
                        "user_id": user["id"],
                        "email": user["email"],
                        "used_at": now_utc().isoformat(),
                    }
                },
            },
        )
    token = create_token(user["id"], user["role"])
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=ACCESS_TTL_MIN * 60, path="/")
    if reg_code:
        await _phase2_emit_admin("registration_code.used", {"code": registration_code, "user_id": user["id"], "email": email})
    return {"access_token": token, "token_type": "bearer", "user": user_to_out(user)}

@api.post("/auth/login", response_model=AuthOut)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginIn, response: Response):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    valid_password = bool(user and verify_password(body.password, user["password_hash"]))
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@eregon.online").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD")
    super_admin_email = os.environ.get("SUPER_ADMIN_EMAIL", "superadmin@eregon.online").lower()
    super_admin_password = os.environ.get("SUPER_ADMIN_PASSWORD")
    if user and not valid_password and email == admin_email and admin_password and body.password == admin_password:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"password_hash": hash_password(admin_password), "role": "admin", "admin_role": "admin", "status": "active"}},
        )
        user = await db.users.find_one({"id": user["id"]})
        valid_password = True
    elif user and not valid_password and email == super_admin_email and super_admin_password and body.password == super_admin_password:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"password_hash": hash_password(super_admin_password), "role": "admin", "admin_role": "super_admin", "status": "active"}},
        )
        user = await db.users.find_one({"id": user["id"]})
        valid_password = True
    if not user or not valid_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended")
    # Activity tracking
    ua = request.headers.get("user-agent", "")
    ip = request.client.host if request.client else "unknown"
    await db.activity_logs.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "action": "login",
        "ip": ip,
        "user_agent": ua,
        "created_at": now_utc().isoformat(),
    })
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_active": now_utc().isoformat(), "last_ip": ip}})
    token = create_token(user["id"], user["role"])
    response.set_cookie("access_token", token, httponly=True, samesite="lax", max_age=ACCESS_TTL_MIN * 60, path="/")
    return {"access_token": token, "token_type": "bearer", "user": user_to_out(user)}

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    user = await reconcile_user_wallet_balance(user)
    return user_to_out(user)

@api.post("/auth/forgot-password")
async def forgot(body: ForgotIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_resets.insert_one({
            "token": token,
            "user_id": user["id"],
            "expires_at": (now_utc() + timedelta(hours=1)).isoformat(),
            "used": False,
        })
        logger.info(f"[SIMULATED EMAIL] Password reset token for {body.email}: {token}")
        return {"ok": True, "message": "If the email exists, a reset link has been sent"}
    return {"ok": True, "message": "If the email exists, a reset link has been sent"}

@api.post("/auth/reset-password")
async def reset(body: ResetIn):
    rec = await db.password_resets.find_one({"token": body.token, "used": False})
    if not rec or datetime.fromisoformat(rec["expires_at"]) < now_utc():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    await db.password_resets.update_one({"token": body.token}, {"$set": {"used": True}})
    return {"ok": True}

# ---------------- User Endpoints ----------------
@api.get("/user/dashboard")
async def user_dashboard(user: dict = Depends(get_current_user)):
    user = await reconcile_user_wallet_balance(user)
    notifications = await db.notifications.find({"user_id": {"$in": [user["id"], "all"]}}, {"_id": 0}).sort("created_at", -1).to_list(20)
    announcements = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    withdrawals = await db.withdrawals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    deposits = await db.deposits.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)
    task_submissions = await db.task_submissions.find({"user_id": user["id"]}, {"_id": 0, "proof_data_url": 0}).sort("created_at", -1).to_list(20)
    task_summary = {
        "pending_review": await db.task_submissions.count_documents({"user_id": user["id"], "status": "pending"}),
        "approved": await db.task_submissions.count_documents({"user_id": user["id"], "status": "approved"}),
        "rejected": await db.task_submissions.count_documents({"user_id": user["id"], "status": "rejected"}),
    }
    withdrawal_eligibility = await _withdrawal_eligibility(user) if "_withdrawal_eligibility" in globals() else None
    referrals = await db.users.find({"referred_by": user["id"]}, {"_id": 0, "password_hash": 0}).to_list(100)
    referrals_count = len(referrals)
    community_balance_rows = await db.users.aggregate([
        {"$match": {"role": "user", "status": {"$ne": "banned"}}},
        {"$group": {"_id": None, "score": {"$sum": {"$ifNull": ["$balance", 0]}}}},
    ]).to_list(1)
    community_real_users = await db.users.count_documents({"role": "user", "status": {"$ne": "banned"}})
    community_member_count = PUBLIC_MEMBER_COUNT_BASE + int(community_real_users or 0)
    membership = None
    if user.get("membership_id"):
        membership = await db.packages.find_one({"id": user["membership_id"]}, {"_id": 0})
        if membership:
            for hidden_key in ("spin_reward_queue", "plan_spin_reward_total", "plan_spin_reward_pct"):
                membership.pop(hidden_key, None)
    return {
        "user": user_to_out(user),
        "notifications": notifications,
        "announcements": announcements,
        "withdrawals": withdrawals,
        "deposits": deposits,
        "task_submissions": task_submissions,
        "task_summary": task_summary,
        "withdrawal_eligibility": withdrawal_eligibility,
        "referrals_count": referrals_count,
        "referrals": [
            {"name": r["name"], "email": r["email"], "joined": r["created_at"], "earnings": r.get("balance", 0)}
            for r in referrals
        ],
        "membership": membership,
        "community_summary": {
            "name": "Community approved total",
            "score": float(community_balance_rows[0]["score"]) if community_balance_rows else 0.0,
            "member_count": community_member_count,
            "real_member_count": community_real_users,
            "membership_name": f"{community_member_count:,} active member accounts",
        },
    }

@api.get("/user/withdrawals", response_model=List[WithdrawOut])
async def user_withdrawals(user: dict = Depends(get_current_user)):
    items = await db.withdrawals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

async def _withdrawal_eligibility(user: dict) -> dict:
    config = await db.platform_settings.find_one({"key": "withdrawal_config"}, {"_id": 0}) or {"value": {"minimum_withdrawal": 25, "currency": user.get("coin_symbol", "USDT"), "review_delay_hours": 24}}
    minimum = float((config.get("value") or {}).get("minimum_withdrawal", 25))
    pending = await db.withdrawals.aggregate([
        {"$match": {"user_id": user["id"], "status": {"$in": ["pending", "reviewing", "approved", "processing"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    pending_total = float(pending[0]["total"]) if pending else 0.0
    total_balance = float(user.get("balance", 0))
    locked_balance = float(user.get("locked_balance", 0))
    withdrawable = max(0.0, total_balance - locked_balance - pending_total)
    failed = []
    review = []
    if withdrawable < minimum:
        failed.append({"type": "minimum_balance", "message": f"Minimum withdrawal is {minimum:g} {user.get('coin_symbol', 'USDT')}.", "current": withdrawable, "target": minimum})
    rules = await db.withdrawal_rules.find({"enabled": True}, {"_id": 0}).sort("priority", 1).to_list(100)
    created_dt = None
    try:
        created_dt = datetime.fromisoformat(str(user.get("created_at")).replace("Z", "+00:00"))
    except Exception:
        created_dt = None
    for rule in rules:
        rt = rule.get("rule_type")
        value = rule.get("value") or {}
        item = {"type": rt, "name": rule.get("name"), "message": rule.get("message", "")}
        if rt == "account_age_days" and created_dt:
            days = int(value.get("days", 0))
            if (now_utc() - created_dt).days < days:
                failed.append({**item, "target_days": days})
        elif rt == "manual_review":
            review.append(item)
    return {
        "eligible": len(failed) == 0,
        "minimum_withdrawal": minimum,
        "total_balance": total_balance,
        "locked_balance": locked_balance,
        "pending_withdrawal": pending_total,
        "withdrawable_balance": withdrawable,
        "network_taxes": await withdrawal_network_taxes(),
        "failed": failed,
        "review": review,
    }

@api.get("/user/withdrawal-eligibility")
async def user_withdrawal_eligibility(user: dict = Depends(get_current_user)):
    return await _withdrawal_eligibility(user)

@api.post("/user/withdrawals", response_model=WithdrawOut)
async def submit_withdrawal(body: WithdrawIn, user: dict = Depends(get_current_user)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    if not body.address or len(body.address.strip()) < 8:
        raise HTTPException(status_code=400, detail="Enter a valid destination address or payment identifier")
    quote = await withdrawal_quote(body.amount, body.coin, body.network)
    eligibility = await _withdrawal_eligibility(user)
    if body.amount < eligibility["minimum_withdrawal"]:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal is {eligibility['minimum_withdrawal']:g} {body.coin}")
    if body.amount > eligibility["withdrawable_balance"]:
        raise HTTPException(status_code=400, detail="Amount exceeds your withdrawable balance after pending withdrawals and locked balance")
    if eligibility["failed"]:
        raise HTTPException(status_code=400, detail={"message": "Withdrawal is not eligible yet", "failed": eligibility["failed"]})
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user["name"],
        "amount": float(body.amount),
        "coin": quote["coin"],
        "network": quote["network"],
        "address": body.address.strip(),
        "network_tax_pct": quote["network_tax_pct"],
        "network_tax_amount": quote["network_tax_amount"],
        "receive_amount": quote["receive_amount"],
        "status": "pending",
        "processing_hours": user_withdrawal_processing_hours(user),
        "created_at": now_utc().isoformat(),
        "decided_at": None,
        "admin_note": None,
        "eligibility_snapshot": eligibility,
        "stages": [{"stage": "pending", "at": now_utc().isoformat(), "by": user["id"]}],
    }
    await db.withdrawals.insert_one(rec)
    rec.pop("_id", None)
    await record_tx(user["id"], "withdrawal_request", float(body.amount), body.coin, float(user.get("balance", 0)), float(user.get("balance", 0)), reference_id=rec["id"], note="Withdrawal request submitted", status="pending")
    return rec

@api.get("/user/deposits", response_model=List[DepositOut])
async def user_deposits(user: dict = Depends(get_current_user)):
    items = await db.deposits.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.post("/user/deposits", response_model=DepositOut)
async def submit_deposit(body: DepositIn, user: dict = Depends(get_current_user)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    package = None
    if body.package_id:
        package = await db.packages.find_one({"id": body.package_id}, {"_id": 0})
        if not package:
            raise HTTPException(status_code=404, detail="Plan not found")
        required_amount = float(package.get("investment", 0))
        if float(body.amount) < required_amount:
            raise HTTPException(status_code=400, detail=f"Amount must cover the {package.get('name', 'selected')} plan")
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_email": user["email"],
        "amount": body.amount,
        "coin": body.coin,
        "tx_hash": body.tx_hash,
        "proof_data_url": body.proof_data_url,
        "package_id": package.get("id") if package else None,
        "package_name": package.get("name") if package else None,
        "status": "pending",
        "created_at": now_utc().isoformat(),
    }
    await db.deposits.insert_one(rec)
    rec.pop("_id", None)
    return rec

@api.get("/user/wallets", response_model=List[WalletOut])
async def list_wallets_public(user: dict = Depends(get_current_user)):
    items = await db.wallets.find({}, {"_id": 0}).to_list(100)
    return items

@api.get("/user/packages", response_model=List[PackageOut])
async def list_packages_public(user: dict = Depends(get_current_user)):
    items = await db.packages.find({}, {"_id": 0}).sort("investment", 1).to_list(100)
    return items

@api.get("/user/notifications", response_model=List[NotificationOut])
async def user_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": {"$in": [user["id"], "all"]}}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.post("/user/notifications/{nid}/read")
async def mark_read(nid: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}

# ---------------- Public ----------------
@api.get("/public/packages", response_model=List[PackageOut])
async def list_packages_public_anon():
    items = await db.packages.find({}, {"_id": 0}).sort("investment", 1).to_list(100)
    return items

@api.get("/public/announcements", response_model=List[AnnouncementOut])
async def list_announcements_public():
    items = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return items

# ---------------- Admin Endpoints ----------------
@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(admin_required)):
    stats_user_query = admin_stats_user_query()
    total_users = await db.users.count_documents(stats_user_query)
    active_users = await db.users.count_documents({**stats_user_query, "status": "active"})
    pending_wd = await db.withdrawals.count_documents({"status": "pending"})
    pending_dep = await db.deposits.count_documents({"status": "pending"})
    total_packages = await db.packages.count_documents({})

    # Sum balances
    agg = await db.users.aggregate([
        {"$match": stats_user_query},
        {"$group": {"_id": None, "total": {"$sum": "$balance"}, "profit": {"$sum": "$daily_profit"}, "spin_tokens": {"$sum": "$spin_tokens"}}}
    ]).to_list(1)
    totals = agg[0] if agg else {"total": 0, "profit": 0, "spin_tokens": 0}

    # Last 7 days deposit/withdrawal chart
    chart = []
    for i in range(6, -1, -1):
        day = (now_utc() - timedelta(days=i)).date()
        start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc).isoformat()
        end = datetime.combine(day, datetime.max.time(), tzinfo=timezone.utc).isoformat()
        dep_count = await db.deposits.count_documents({"created_at": {"$gte": start, "$lte": end}})
        wd_count = await db.withdrawals.count_documents({"created_at": {"$gte": start, "$lte": end}})
        chart.append({"date": day.isoformat(), "deposits": dep_count, "withdrawals": wd_count})

    return {
        "total_users": total_users,
        "active_users": active_users,
        "pending_withdrawals": pending_wd,
        "pending_deposits": pending_dep,
        "total_packages": total_packages,
        "total_balance": totals.get("total", 0),
        "total_daily_profit": totals.get("profit", 0),
        "total_spin_tokens": totals.get("spin_tokens", 0),
        "chart": chart,
    }

@api.get("/admin/users", response_model=List[UserOut])
async def admin_list_users(admin: dict = Depends(admin_required),
                           q: Optional[str] = None,
                           limit: int = 2000,
                           skip: int = 0,
                           min_balance: Optional[float] = None,
                           max_balance: Optional[float] = None,
                           signup_from: Optional[str] = None,
                           signup_to: Optional[str] = None,
                           activity_from: Optional[str] = None,
                           activity_to: Optional[str] = None,
                           sort_by: Literal["created_at", "last_active", "balance", "email", "name"] = "created_at",
                           sort_dir: Literal["asc", "desc"] = "desc"):
    # Keep the existing admin UI unchanged: the regular users table loads normal
    # user records. On the first admin list load, silently top up the testing
    # dataset. If the database insert is slow or unavailable on a serverless cold
    # start, return the deterministic generated users as a fallback so the table
    # never shows an empty list just because seeding has not finished yet.
    safe_limit = max(1, min(limit, 5000))
    safe_skip = max(0, skip)
    search = (q or "").strip()

    if practice_users_enabled() and not search and safe_skip == 0:
        try:
            await seed_practice_users()
        except Exception as exc:
            logger.warning("Practice user database seed skipped during admin list: %s", exc)

    # Do not hide existing records if older rows have role missing or a non-user
    # member role. Only admin accounts are excluded from this management table.
    query: dict = {
        "role": {"$ne": "admin"},
        "email": {"$not": re.compile("(demo|test)", re.IGNORECASE)},
    }
    if search:
        query["$and"] = [{"$or": [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"id": {"$regex": search, "$options": "i"}},
        ]}]

    if min_balance is not None or max_balance is not None:
        query["balance"] = {}
        if min_balance is not None:
            query["balance"]["$gte"] = min_balance
        if max_balance is not None:
            query["balance"]["$lte"] = max_balance

    if signup_from or signup_to:
        query["created_at"] = {}
        if signup_from:
            query["created_at"]["$gte"] = signup_from
        if signup_to:
            query["created_at"]["$lte"] = signup_to

    if activity_from or activity_to:
        query["last_active"] = {}
        if activity_from:
            query["last_active"]["$gte"] = activity_from
        if activity_to:
            query["last_active"]["$lte"] = activity_to

    sort_field = {
        "created_at": "created_at",
        "last_active": "last_active",
        "balance": "balance",
        "email": "email",
        "name": "name",
    }[sort_by]
    sort_direction = 1 if sort_dir == "asc" else -1

    users = await db.users.find(query, {"_id": 0}).sort(sort_field, sort_direction).skip(safe_skip).to_list(safe_limit)

    return [user_to_out(u) for u in users]


@api.patch("/admin/users/{uid}", response_model=UserOut)
async def admin_update_user(uid: str, body: AdminUpdateUserIn, admin: dict = Depends(admin_required)):
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    wallet_fields = {"balance", "daily_profit", "total_earnings", "referral_earnings", "locked_balance", "bonus_balance", "spin_tokens"}
    if wallet_fields.intersection(update):
        require_wallet_manager(admin)
    assigned_pkg = None
    membership_changed = False
    if "membership_id" in update:
        pkg = await db.packages.find_one({"id": update["membership_id"]}, {"_id": 0})
        if pkg:
            assigned_pkg = _normalize_package_document(pkg)
            update["membership_name"] = assigned_pkg["name"]
            membership_changed = user.get("membership_id") != assigned_pkg.get("id")
        else:
            update["membership_name"] = None
            update["membership_id"] = None
            membership_changed = user.get("membership_id") is not None
    # Record ledger entries for any balance/earning fields that changed
    coin = user.get("coin_symbol", "USDT")
    ledger_fields = {
        "balance": ("admin_adjust_balance", "balance"),
        "daily_profit": ("admin_adjust_daily_profit", "daily_profit"),
        "total_earnings": ("admin_adjust_total_earnings", "total_earnings"),
        "referral_earnings": ("admin_adjust_referral", "referral_earnings"),
    }
    for field, (tx_type, _) in ledger_fields.items():
        if field in update:
            before = float(user.get(field, 0))
            after = float(update[field])
            if before != after:
                delta = after - before
                await record_tx(
                    user_id=uid,
                    type_=("admin_credit" if delta > 0 else "admin_debit") if field == "balance" else tx_type,
                    amount=abs(delta), coin=coin,
                    before_balance=before, after_balance=after,
                    admin_id=admin["id"], note=f"{field} adjusted by admin",
                )
    if update:
        await db.users.update_one({"id": uid}, {"$set": update})
        if assigned_pkg and membership_changed:
            await _grant_plan_spin_rewards(uid, assigned_pkg, admin_id=admin["id"])
        await _phase2_emit_user(uid, "user.updated", {"fields": list(update.keys())})
    updated = await db.users.find_one({"id": uid}, {"_id": 0})
    return user_to_out(updated)

@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, admin: dict = Depends(admin_required)):
    await db.users.delete_one({"id": uid, "role": "user"})
    return {"ok": True}

# Packages CRUD
@api.get("/admin/packages", response_model=List[PackageOut])
async def admin_list_packages(admin: dict = Depends(admin_required)):
    items = await db.packages.find({}, {"_id": 0}).sort("investment", 1).to_list(200)
    return items

@api.post("/admin/packages", response_model=PackageOut)
async def admin_create_package(body: PackageIn, admin: dict = Depends(admin_required)):
    rec = _normalize_package_document({"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **body.model_dump()})
    await db.packages.insert_one(rec)
    rec.pop("_id", None)
    return rec

@api.patch("/admin/packages/{pid}", response_model=PackageOut)
async def admin_update_package(pid: str, body: PackageIn, admin: dict = Depends(admin_required)):
    payload = _normalize_package_document({**body.model_dump(), "updated_at": now_utc().isoformat()})
    await db.packages.update_one({"id": pid}, {"$set": payload})
    pkg = await db.packages.find_one({"id": pid}, {"_id": 0})
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found")
    return pkg

@api.delete("/admin/packages/{pid}")
async def admin_delete_package(pid: str, admin: dict = Depends(admin_required)):
    await db.packages.delete_one({"id": pid})
    return {"ok": True}

# Wallets
@api.get("/admin/wallets", response_model=List[WalletOut])
async def admin_list_wallets(admin: dict = Depends(require_perm("wallets.manage"))):
    items = await db.wallets.find({}, {"_id": 0}).to_list(100)
    return items

@api.post("/admin/wallets", response_model=WalletOut)
async def admin_create_wallet(body: WalletIn, admin: dict = Depends(require_perm("wallets.manage"))):
    rec = {"id": str(uuid.uuid4()), **body.model_dump()}
    await db.wallets.insert_one(rec)
    rec.pop("_id", None)
    return rec

@api.delete("/admin/wallets/{wid}")
async def admin_delete_wallet(wid: str, admin: dict = Depends(require_perm("wallets.manage"))):
    await db.wallets.delete_one({"id": wid})
    return {"ok": True}

# Withdrawals
@api.get("/admin/withdrawals", response_model=List[WithdrawOut])
async def admin_list_withdrawals(admin: dict = Depends(admin_required), status_filter: Optional[str] = None):
    require_wallet_manager(admin)
    q = {"status": status_filter} if status_filter else {}
    items = await db.withdrawals.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.patch("/admin/withdrawals/{wid}", response_model=WithdrawOut)
async def admin_decide_withdrawal(wid: str, body: WithdrawDecisionIn, admin: dict = Depends(admin_required)):
    require_wallet_manager(admin)
    wd = await db.withdrawals.find_one({"id": wid})
    if not wd:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    corrected_address = body.address.strip() if body.address is not None else str(wd.get("address", "")).strip()
    corrected_network = body.network.strip() if body.network is not None else str(wd.get("network", "TRC20")).strip()
    if not corrected_address or len(corrected_address) < 8:
        raise HTTPException(status_code=400, detail="Enter a valid destination address or payment identifier")
    quote = await withdrawal_quote(float(wd["amount"]), wd.get("coin", "USDT"), corrected_network)
    update = {"status": body.status, "decided_at": now_utc().isoformat()}
    update["address"] = corrected_address
    update["network"] = quote["network"]
    update["network_tax_pct"] = quote["network_tax_pct"]
    update["network_tax_amount"] = quote["network_tax_amount"]
    update["receive_amount"] = quote["receive_amount"]
    if body.processing_hours is not None:
        update["processing_hours"] = body.processing_hours
    if body.admin_note is not None:
        update["admin_note"] = body.admin_note

    # Append stage history
    stages_history = wd.get("stages", [])
    stage = {"stage": body.status, "at": now_utc().isoformat(), "by": admin["id"]}
    if corrected_address != str(wd.get("address", "")).strip() or corrected_network.lower() != str(wd.get("network", "TRC20")).strip().lower():
        stage["correction"] = {
            "previous_address": wd.get("address"),
            "previous_network": wd.get("network"),
            "address": corrected_address,
            "network": quote["network"],
        }
    stages_history.append(stage)
    update["stages"] = stages_history

    prev_status = wd["status"]
    # Balance flow:
    # - debit user balance when entering "approved" or "processing" or "completed" from a non-debited stage
    # - refund only when rejected from a previously-debited stage
    debited_stages = {"approved", "processing", "completed"}
    refund_stages = {"rejected"}
    was_debited = prev_status in debited_stages
    now_debited = body.status in debited_stages

    user = await db.users.find_one({"id": wd["user_id"]})
    if user:
        coin = user.get("coin_symbol", wd["coin"])
        before = float(user.get("balance", 0))
        if not was_debited and now_debited:
            after = before - float(wd["amount"])
            await db.users.update_one({"id": wd["user_id"]}, {"$set": {"balance": after}})
            await record_tx(
                user_id=wd["user_id"], type_="withdrawal_debit",
                amount=float(wd["amount"]), coin=coin,
                before_balance=before, after_balance=after,
                admin_id=admin["id"], reference_id=wd["id"],
                note=f"Withdrawal to {corrected_address} on {quote['network']}",
            )
        elif was_debited and body.status in refund_stages:
            after = before + float(wd["amount"])
            await db.users.update_one({"id": wd["user_id"]}, {"$set": {"balance": after}})
            await record_tx(
                user_id=wd["user_id"], type_="withdrawal_refund",
                amount=float(wd["amount"]), coin=coin,
                before_balance=before, after_balance=after,
                admin_id=admin["id"], reference_id=wd["id"],
                note=body.admin_note or "Withdrawal rejected — refunded",
            )

    await db.withdrawals.update_one({"id": wid}, {"$set": update})
    updated = await db.withdrawals.find_one({"id": wid}, {"_id": 0})
    await _phase2_emit_user(updated["user_id"], "withdrawal.updated", updated)
    return updated

# Deposits
@api.get("/admin/deposits", response_model=List[DepositOut])
async def admin_list_deposits(admin: dict = Depends(admin_required)):
    require_wallet_manager(admin)
    items = await db.deposits.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in items:
        u = await db.users.find_one({"id": d["user_id"]}, {"_id": 0, "email": 1})
        d["user_email"] = u["email"] if u else "unknown"
    return items

@api.patch("/admin/deposits/{did}", response_model=DepositOut)
async def admin_decide_deposit(did: str, body: DepositDecisionIn, admin: dict = Depends(admin_required)):
    require_wallet_manager(admin)
    dep = await db.deposits.find_one({"id": did})
    if not dep:
        raise HTTPException(status_code=404, detail="Deposit not found")
    update = {"status": body.status}
    if dep["status"] != "approved" and body.status == "approved":
        user_doc = await db.users.find_one({"id": dep["user_id"]})
        if user_doc:
            user_update = {}
            package = None
            spin_reward_values = []
            spin_reward_mode = None
            if dep.get("package_id"):
                package = await db.packages.find_one({"id": dep["package_id"]}, {"_id": 0})
                if package:
                    user_update.update({
                        "membership_id": package.get("id"),
                        "membership_name": package.get("name"),
                        "commission_rate": float(package.get("commission_boost_pct", user_doc.get("commission_rate", 0))),
                        "withdrawal_processing_hours": int(package.get("priority_withdrawal_hours", user_doc.get("withdrawal_processing_hours", 48))),
                    })
                    spin_reward_values = _clean_spin_values(body.deterministic_spin_values)
                    if spin_reward_values:
                        spin_reward_mode = "admin"
                    else:
                        spin_reward_values = _build_random_deposit_spin_rewards(float(dep["amount"]), int(package.get("spin_tokens", 1)))
                        spin_reward_mode = "random"
            existing_credit = await db.transactions.find_one({"reference_id": dep["id"], "type": "deposit_credit"})
            if not existing_credit:
                before = float(user_doc.get("balance", 0))
                after = before + float(dep["amount"])
                user_update["balance"] = after
                await record_tx(
                    user_id=dep["user_id"], type_="deposit_credit",
                    amount=float(dep["amount"]), coin=dep["coin"],
                    before_balance=before, after_balance=after,
                    admin_id=admin["id"], reference_id=dep["id"],
                    note=f"Deposit approved · tx {dep.get('tx_hash') or '—'}",
                )
            if user_update:
                await db.users.update_one({"id": dep["user_id"]}, {"$set": user_update})
            if package:
                reward_package = {
                    **package,
                    "custom_spin_rewards": True,
                    "spin_tokens": len(spin_reward_values),
                    "spin_reward_queue": spin_reward_values,
                    "plan_spin_reward_total": round(sum(spin_reward_values), 2),
                    "plan_spin_reward_pct": round((sum(spin_reward_values) / max(float(dep["amount"]), 0.01)) * 100, 2),
                }
                await _grant_plan_spin_rewards(dep["user_id"], reward_package, admin_id=admin["id"])
                update.update({
                    "spin_reward_values": spin_reward_values,
                    "spin_reward_total": round(sum(spin_reward_values), 2),
                    "spin_reward_mode": spin_reward_mode,
                })
                notification = {
                    "id": str(uuid.uuid4()),
                    "user_id": dep["user_id"],
                    "title": "Plan Subscription Approved",
                    "body": f"Your {package.get('name', 'membership')} plan is now active.",
                    "category": "membership",
                    "read": False,
                    "created_at": now_utc().isoformat(),
                }
                await db.notifications.insert_one(notification)
                notification.pop("_id", None)
                await _phase2_emit_user(dep["user_id"], "notification.created", notification)
    await db.deposits.update_one({"id": did}, {"$set": update})
    updated = await db.deposits.find_one({"id": did}, {"_id": 0})
    u = await db.users.find_one({"id": updated["user_id"]}, {"_id": 0, "email": 1})
    updated["user_email"] = u["email"] if u else "unknown"
    await _phase2_emit_user(updated["user_id"], "deposit.updated", updated)
    return updated

# Announcements
@api.get("/admin/announcements", response_model=List[AnnouncementOut])
async def admin_list_announcements(admin: dict = Depends(admin_required)):
    items = await db.announcements.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

@api.post("/admin/announcements", response_model=AnnouncementOut)
async def admin_create_announcement(body: AnnouncementIn, admin: dict = Depends(admin_required)):
    rec = {"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **body.model_dump()}
    await db.announcements.insert_one(rec)
    rec.pop("_id", None)
    return rec

@api.delete("/admin/announcements/{aid}")
async def admin_delete_announcement(aid: str, admin: dict = Depends(admin_required)):
    await db.announcements.delete_one({"id": aid})
    return {"ok": True}

# Registration Codes
@api.post("/admin/registration-codes", response_model=RegistrationCodeOut)
async def admin_create_registration_code(body: RegistrationCodeIn, admin: dict = Depends(admin_required)):
    code = (body.code or gen_registration_code()).strip().upper()
    existing = await db.registration_codes.find_one({"code": code})
    if existing:
        raise HTTPException(status_code=400, detail="Registration code already exists")

    rec = {
        "id": str(uuid.uuid4()),
        "code": code,
        "reward_amount": float(body.reward_amount),
        "reward_coin": body.reward_coin.upper(),
        "plan_name": body.plan_name,
        "status": "active",
        "max_uses": int(body.max_uses),
        "used_count": 0,
        "used_by": [],
        "note": body.note,
        "created_by": admin["id"],
        "created_at": now_utc().isoformat(),
    }
    await db.registration_codes.insert_one(rec)
    rec.pop("_id", None)
    await _phase2_emit_admin("registration_code.created", rec)
    return rec

@api.get("/admin/registration-codes", response_model=List[RegistrationCodeOut])
async def admin_list_registration_codes(admin: dict = Depends(admin_required)):
    items = await db.registration_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api.patch("/admin/registration-codes/{code_id}/status", response_model=RegistrationCodeOut)
async def admin_update_registration_code_status(code_id: str, body: RegistrationCodeStatusIn, admin: dict = Depends(admin_required)):
    await db.registration_codes.update_one({"id": code_id}, {"$set": {"status": body.status}})
    rec = await db.registration_codes.find_one({"id": code_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Registration code not found")
    await _phase2_emit_admin("registration_code.status", rec)
    return rec

@api.get("/admin/registration-codes/{code_id}/usage")
async def admin_registration_code_usage(code_id: str, admin: dict = Depends(admin_required)):
    rec = await db.registration_codes.find_one({"id": code_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Registration code not found")
    users = await db.users.find({"registration_code_id": code_id}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return {"code": rec, "users": users}

# Notifications
@api.post("/admin/notifications", response_model=NotificationOut)
async def admin_create_notification(body: NotificationIn, admin: dict = Depends(admin_required)):
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": body.user_id,
        "title": body.title,
        "body": body.body,
        "category": body.category,
        "read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.notifications.insert_one(rec)
    rec.pop("_id", None)
    if body.user_id == "all":
        await _phase2_emit_all("notification.created", rec)
    else:
        await _phase2_emit_user(body.user_id, "notification.created", rec)
    return rec


async def create_user_notification(user_id: str, title: str, body: str, category: str = "system") -> dict:
    rec = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": title,
        "body": body,
        "category": category,
        "read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.notifications.insert_one(rec)
    rec.pop("_id", None)
    await _phase2_emit_user(user_id, "notification.created", rec)
    return rec


async def create_admin_notifications(title: str, body: str, category: str = "admin") -> list[dict]:
    admins = await db.users.find({"role": "admin", "status": {"$ne": "suspended"}}, {"_id": 0, "id": 1}).to_list(100)
    records = []
    now_iso = now_utc().isoformat()
    for admin_doc in admins:
        rec = {
            "id": str(uuid.uuid4()),
            "user_id": admin_doc["id"],
            "title": title,
            "body": body,
            "category": category,
            "read": False,
            "created_at": now_iso,
        }
        records.append(rec)
    if records:
        await db.notifications.insert_many(records)
        for rec in records:
            rec.pop("_id", None)
            await _phase2_emit_user(rec["user_id"], "notification.created", rec)
    return records


def _practice_name_pool():
    first_names = [
        "James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Elizabeth",
        "William", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Christopher", "Karen",
        "Charles", "Nancy", "Daniel", "Lisa", "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra",
        "Donald", "Ashley", "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle",
        "Kenneth", "Dorothy", "Kevin", "Carol", "Brian", "Amanda", "George", "Melissa", "Edward", "Deborah",
        "Ronald", "Stephanie", "Timothy", "Rebecca", "Jason", "Sharon", "Jeffrey", "Laura", "Ryan", "Cynthia",
        "Jacob", "Kathleen", "Gary", "Amy", "Nicholas", "Shirley", "Eric", "Angela", "Jonathan", "Helen",
        "Stephen", "Anna", "Larry", "Brenda", "Justin", "Pamela", "Scott", "Nicole", "Brandon", "Emma",
        "Benjamin", "Samantha", "Samuel", "Katherine", "Gregory", "Christine", "Alexander", "Debra", "Patrick", "Rachel",
        "Frank", "Catherine", "Raymond", "Carolyn", "Jack", "Janet", "Dennis", "Ruth", "Jerry", "Maria"
    ]
    last_names = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
        "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
        "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
        "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores",
        "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts",
        "Gomez", "Phillips", "Evans", "Turner", "Diaz", "Parker", "Cruz", "Edwards", "Collins", "Reyes",
        "Stewart", "Morris", "Morales", "Murphy", "Cook", "Rogers", "Gutierrez", "Ortiz", "Morgan", "Cooper",
        "Peterson", "Bailey", "Reed", "Kelly", "Howard", "Ramos", "Kim", "Cox", "Ward", "Richardson",
        "Watson", "Brooks", "Chavez", "Wood", "James", "Bennett", "Gray", "Mendoza", "Ruiz", "Hughes",
        "Price", "Alvarez", "Castillo", "Sanders", "Patel", "Myers", "Long", "Ross", "Foster", "Jimenez"
    ]
    return first_names, last_names


def _build_practice_users(packages: list[dict], total: int = 1500) -> list[dict]:
    """Generate synthetic admin/testing users for the regular users table."""
    rng = random.Random(20260517)
    first_names, last_names = _practice_name_pool()
    now = now_utc()
    package_choices = packages or []
    tiers = [p.get("name") for p in package_choices] or ["Basic", "Silver", "Gold", "Platinum", "Elite VIP"]
    users = []
    used_emails = set()

    for idx in range(total):
        first = first_names[idx % len(first_names)]
        last = last_names[(idx * 7 + idx // len(first_names)) % len(last_names)]
        suffix = idx + 1001
        name = f"{first} {last}"
        email_local = f"{first}.{last}.{suffix}".lower().replace("'", "")
        email = f"{email_local}@eregon.online"
        if email in used_emails:
            email = f"{email_local}.{idx}@eregon.test"
        used_emails.add(email)

        if idx < max(1, int(total * 0.03)):
            balance = round(rng.uniform(25000, 50000), 2)
        else:
            balance = round(max(1200, rng.gauss(3600, 825)), 2)

        referral_earnings = round(balance * rng.uniform(0.06, 0.22), 2)
        bonus_balance = round(balance * rng.uniform(0.015, 0.08), 2)
        locked_balance = round(balance * rng.uniform(0.0, 0.08), 2)
        daily_profit = 0.0
        total_earnings = round(balance + referral_earnings + bonus_balance + rng.uniform(100, 1800), 2)
        tasks_completed = rng.randint(8, 180)
        tasks_pending = rng.randint(0, 8)
        joined_days_ago = rng.randint(14, 540)
        created_at = (now - timedelta(days=joined_days_ago, hours=rng.randint(0, 23), minutes=rng.randint(0, 59))).isoformat()
        pkg = package_choices[min(len(package_choices)-1, rng.choices(range(len(tiers)), weights=[42, 30, 18, 8, 2][:len(tiers)], k=1)[0])] if package_choices else None
        membership_name = (pkg or {}).get("name") or rng.choice(tiers)
        status = rng.choices(["active", "suspended"], weights=[98, 2], k=1)[0]
        user_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"eregon-marketing-practice-user-{idx}"))
        spin_fields = normalize_plan_spin_fields(pkg) if pkg else {"spin_tokens": 0, "spin_reward_queue": [], "plan_spin_reward_total": 0.0, "plan_spin_reward_pct": 1.0}

        users.append({
            "id": user_id,
            "email": email,
            "name": name,
            "password_hash": None,  # filled by seed() once to avoid repeated bcrypt work
            "role": "user",
            "referral_code": f"RM{suffix:06d}",
            "referred_by": None,
            "coin_symbol": "USDT",
            "balance": balance,
            "daily_profit": daily_profit,
            "total_earnings": total_earnings,
            "referral_earnings": referral_earnings,
            "task_progress": round(rng.uniform(5, 98), 1),
            "tasks_completed": tasks_completed,
            "tasks_pending": tasks_pending,
            "commission_rate": round(rng.choice([5, 7.5, 10, 12, 15, 18, 20]), 1),
            "status": status,
            "withdrawal_processing_hours": rng.choice([2, 12, 24, 36, 48]),
            "locked_balance": locked_balance,
            "bonus_balance": bonus_balance,
            "current_streak": 0,
            "longest_streak": 0,
            "last_checkin_at": None,
            "spin_tokens": spin_fields.get("spin_tokens", 0),
            "spin_count": 0,
            "spin_reward_queue": spin_fields.get("spin_reward_queue", []),
            "last_spin_at": None,
            "achievement_count": rng.randint(0, 12),
            "membership_id": (pkg or {}).get("id"),
            "membership_name": membership_name,
            "plan_spin_reward_total": spin_fields.get("plan_spin_reward_total", 0.0),
            "plan_spin_reward_pct": spin_fields.get("plan_spin_reward_pct", 1.0),
            "plan_spin_reward_source_id": (pkg or {}).get("id"),
            "practice_seed": True,
            "created_at": created_at,
            "last_active": (now - timedelta(days=rng.randint(0, 30))).isoformat(),
        })

    # Link a portion of practice users into referral chains without exposing anything publicly.
    for idx, u in enumerate(users):
        if idx > 0 and rng.random() < 0.42:
            sponsor_index = rng.randint(max(0, idx - 75), idx - 1)
            u["referred_by"] = users[sponsor_index]["id"]
    return users


async def seed_practice_users(target_override: Optional[int] = None, password_override: Optional[str] = None, ignore_env: bool = False):
    if not ignore_env and not practice_users_enabled():
        return {"ok": True, "inserted": 0, "existing_practice_users": await db.users.count_documents({"practice_seed": True}), "target": 0, "skipped": "SEED_PRACTICE_USERS is disabled"}

    target = int(target_override or os.environ.get("PRACTICE_USER_COUNT", "1500"))
    target = max(1, min(target, 5000))
    existing_count = await db.users.count_documents({"practice_seed": True})
    if existing_count >= target:
        return {"ok": True, "inserted": 0, "existing_practice_users": existing_count, "target": target}

    packages = await db.packages.find({}, {"_id": 0}).sort("investment", 1).to_list(20)
    password_hash = hash_password(password_override or os.environ.get("PRACTICE_USER_PASSWORD", "Practice@123"))
    users = _build_practice_users(packages, target)
    for u in users:
        u["password_hash"] = password_hash

    existing_emails = set(await db.users.distinct("email", {"email": {"$in": [u["email"] for u in users]}}))
    to_insert = [u for u in users if u["email"] not in existing_emails]
    if to_insert:
        await db.users.insert_many(to_insert, ordered=False)
        logger.info("Seeded %s Eregon Marketing synthetic practice users", len(to_insert))
    final_count = await db.users.count_documents({"practice_seed": True})
    return {"ok": True, "inserted": len(to_insert), "existing_practice_users": final_count, "target": target}

# ---------------- Startup ----------------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("referral_code")
    await db.users.create_index("registration_code")
    await db.users.create_index("registration_code_id")
    await db.registration_codes.create_index("code", unique=True)
    await db.registration_codes.create_index("status")
    await db.registration_codes.create_index("created_at")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@eregon.online").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Eregon Admin",
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "admin_role": "admin",
            "referral_code": "ADMIN001",
            "referred_by": None,
            "coin_symbol": "USDT",
            "balance": 0.0,
            "daily_profit": 0.0,
            "total_earnings": 0.0,
            "referral_earnings": 0.0,
            "task_progress": 0.0,
            "tasks_completed": 0,
            "tasks_pending": 0,
            "commission_rate": 0.0,
            "status": "active",
            "withdrawal_processing_hours": 0,
            "locked_balance": 0.0,
            "bonus_balance": 0.0,
            "current_streak": 0,
            "longest_streak": 0,
            "last_checkin_at": None,
            "spin_tokens": 0,
            "spin_count": 0,
            "spin_reward_queue": [],
            "last_spin_at": None,
            "achievement_count": 0,
            "membership_id": None,
            "membership_name": None,
            "created_at": now_utc().isoformat(),
        })
        logger.info("Seeded admin: %s", admin_email)
    else:
        admin_update = {"role": "admin", "admin_role": "admin", "status": "active"}
        if not verify_password(admin_password, existing["password_hash"]):
            admin_update["password_hash"] = hash_password(admin_password)
        await db.users.update_one({"email": admin_email}, {"$set": admin_update})

    super_admin_email = os.environ.get("SUPER_ADMIN_EMAIL", "superadmin@eregon.online").lower()
    super_admin_password = os.environ.get("SUPER_ADMIN_PASSWORD")
    if super_admin_email != admin_email and super_admin_password:
        existing_super = await db.users.find_one({"email": super_admin_email})
        if not existing_super:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": super_admin_email,
                "name": "Royal Crypto Super Admin",
                "password_hash": hash_password(super_admin_password),
                "role": "admin",
                "admin_role": "super_admin",
                "referral_code": "SUPERADMIN",
                "referred_by": None,
                "coin_symbol": "USDT",
                "balance": 0.0,
                "daily_profit": 0.0,
                "total_earnings": 0.0,
                "referral_earnings": 0.0,
                "task_progress": 0.0,
                "tasks_completed": 0,
                "tasks_pending": 0,
                "commission_rate": 0.0,
                "status": "active",
                "withdrawal_processing_hours": 0,
                "locked_balance": 0.0,
                "bonus_balance": 0.0,
                "current_streak": 0,
                "longest_streak": 0,
                "last_checkin_at": None,
                "spin_tokens": 0,
                "spin_count": 0,
                "spin_reward_queue": [],
                "last_spin_at": None,
                "achievement_count": 0,
                "membership_id": None,
                "membership_name": None,
                "created_at": now_utc().isoformat(),
            })
            logger.info("Seeded super admin: %s", super_admin_email)
        else:
            super_admin_update = {"role": "admin", "admin_role": "super_admin", "status": "active"}
            if not verify_password(super_admin_password, existing_super["password_hash"]):
                super_admin_update["password_hash"] = hash_password(super_admin_password)
            await db.users.update_one({"email": super_admin_email}, {"$set": super_admin_update})

    # Seed default member account
    member_email = "member@eregon.online"
    if not await db.users.find_one({"email": member_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": member_email,
            "name": "Eregon Marketing Member",
            "password_hash": hash_password("User@123"),
            "role": "user",
            "referral_code": "EREGON01",
            "referred_by": None,
            "coin_symbol": "USDT",
            "balance": 12450.75,
            "daily_profit": 0.0,
            "total_earnings": 9821.40,
            "referral_earnings": 1240.50,
            "task_progress": 68.0,
            "tasks_completed": 17,
            "tasks_pending": 3,
            "commission_rate": 12.0,
            "status": "active",
            "withdrawal_processing_hours": 12,
            "locked_balance": 250.0,
            "bonus_balance": 340.75,
            "current_streak": 4,
            "longest_streak": 9,
            "last_checkin_at": None,
            "spin_tokens": 0,
            "spin_count": 0,
            "spin_reward_queue": [],
            "last_spin_at": None,
            "achievement_count": 2,
            "membership_id": None,
            "membership_name": "Gold",
            "created_at": now_utc().isoformat(),
        })

    # Seed default packages
    if await db.packages.count_documents({}) == 0:
        defaults = [
            {"name": "Basic", "tier": "Basic", "investment": 100, "daily_profit_pct": 0.0, "commission_boost_pct": 0, "task_boost_pct": 0, "duration_days": 30, "badge_color": "zinc", "perks": ["Plan spin rewards", "Standard support"], "priority_withdrawal_hours": 48, "spin_tokens": 2},
            {"name": "Silver", "tier": "Silver", "investment": 500, "daily_profit_pct": 0.0, "commission_boost_pct": 5, "task_boost_pct": 10, "duration_days": 60, "badge_color": "slate", "perks": ["5 plan spins", "Priority support", "+5% referral commission"], "priority_withdrawal_hours": 36, "spin_tokens": 5},
            {"name": "Gold", "tier": "Gold", "investment": 2000, "daily_profit_pct": 0.0, "commission_boost_pct": 10, "task_boost_pct": 25, "duration_days": 90, "badge_color": "amber", "perks": ["10 plan spins", "VIP support", "+10% referral commission", "Exclusive tasks"], "priority_withdrawal_hours": 24, "spin_tokens": 10},
            {"name": "Platinum", "tier": "Platinum", "investment": 5000, "daily_profit_pct": 0.0, "commission_boost_pct": 15, "task_boost_pct": 50, "duration_days": 120, "badge_color": "purple", "perks": ["20 plan spins", "Dedicated manager", "+15% referral", "Priority withdrawals"], "priority_withdrawal_hours": 12, "spin_tokens": 20},
            {"name": "Elite VIP", "tier": "Elite VIP", "investment": 15000, "daily_profit_pct": 0.0, "commission_boost_pct": 25, "task_boost_pct": 100, "duration_days": 180, "badge_color": "gold", "perks": ["30 plan spins", "Concierge support", "+25% referral", "Instant withdrawals", "Elite events access"], "priority_withdrawal_hours": 2, "spin_tokens": 30},
        ]
        for d in defaults:
            await db.packages.insert_one(_normalize_package_document({"id": str(uuid.uuid4()), "created_at": now_utc().isoformat(), **d}))

    await _migrate_packages_to_plan_spins()

    # Seed synthetic practice users for admin/testing workflows. Public pages remain aggregate-only.
    await seed_practice_users()

    # Seed wallets
    if await db.wallets.count_documents({}) == 0:
        wallets = [
            {"id": str(uuid.uuid4()), "coin": "USDT", "network": "TRC20", "address": "TEregonUSDTAddressHere000000000", "note": "Minimum 10 USDT"},
            {"id": str(uuid.uuid4()), "coin": "USDT", "network": "ERC20", "address": "0xEregonUSDTErc20AddressHere0000", "note": "Higher network fees"},
            {"id": str(uuid.uuid4()), "coin": "BTC", "network": "Bitcoin", "address": "bc1qeregonbtcaddressplaceholder0000000", "note": "Min 0.0005 BTC"},
            {"id": str(uuid.uuid4()), "coin": "ETH", "network": "ERC20", "address": "0xEregonEthAddressPlaceholder0000000", "note": "Min 0.01 ETH"},
        ]
        await db.wallets.insert_many(wallets)

    # Seed announcement
    if await db.announcements.count_documents({}) == 0:
        await db.announcements.insert_one({
            "id": str(uuid.uuid4()),
            "title": "Welcome to Eregon Marketing",
            "body": "Unlock VIP tiers, plan spins, and approved task rewards through a clean reward workflow.",
            "pinned": True,
            "created_at": now_utc().isoformat(),
        })

    # Seed live feed with a realistic activity pool
    if await db.live_feed.count_documents({}) < 50:
        await db.live_feed.delete_many({})
        await db.live_feed.insert_many(_build_live_feed_seed(80))

    # Ensure legacy admin users have a non-wallet role unless explicitly seeded as super admin.
    await db.users.update_many({"role": "admin", "admin_role": {"$exists": False}}, {"$set": {"admin_role": "admin"}})
    await db.users.update_one({"email": admin_email}, {"$set": {"role": "admin", "admin_role": "admin", "status": "active"}})
    if super_admin_email != admin_email and super_admin_password:
        await db.users.update_one({"email": super_admin_email}, {"$set": {"role": "admin", "admin_role": "super_admin", "status": "active"}})

    # Seed feed settings
    if not await db.settings.find_one({"key": "feed"}):
        await db.settings.insert_one({"key": "feed", "auto_enabled": True, "interval_sec": 8})

    # Indexes for new collections
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.transactions.create_index("type")
    await db.trades.create_index([("user_id", 1), ("created_at", -1)])
    await db.trades.create_index("pair")
    await db.options_trades.create_index([("user_id", 1), ("created_at", -1)])
    await db.options_trades.create_index("status")
    await db.market_price_targets.create_index("symbol")
    await db.activity_logs.create_index([("user_id", 1), ("created_at", -1)])
    await db.tickets.create_index([("user_id", 1), ("last_message_at", -1)])
    await db.ticket_messages.create_index([("ticket_id", 1), ("created_at", 1)])
    await db.live_feed.create_index("created_at")
    await db.notifications.create_index("user_id")

def _legacy_referral_code(email: str) -> str:
    suffix = uuid.uuid5(uuid.NAMESPACE_DNS, f"legacy-eregon-user-{email}").hex[:8].upper()
    return f"LEG{suffix}"

async def import_legacy_app_data_users():
    legacy_path = Path(os.environ.get("LEGACY_APP_DATA_FILE", "/app/data/db.json"))
    if not legacy_path.exists():
        return

    with legacy_path.open("r", encoding="utf-8") as fh:
        payload = json.load(fh)

    users = payload.get("users") or []
    inserted = 0
    skipped = 0

    for legacy in users:
        email = str(legacy.get("email") or "").strip().lower()
        if not email or legacy.get("role") == "admin":
            skipped += 1
            continue
        if await db.users.find_one({"email": email}, {"_id": 1}):
            skipped += 1
            continue

        legacy_id = str(legacy.get("id") or "")
        user_id = legacy_id or str(uuid.uuid5(uuid.NAMESPACE_DNS, f"legacy-eregon-user-id-{email}"))
        created_at = legacy.get("createdAt") or legacy.get("created_at") or now_utc().isoformat()
        balance = float(legacy.get("balance") or 0)
        password_hash = legacy.get("password_hash") or legacy.get("passwordHash") or hash_password(secrets.token_urlsafe(24))

        user_doc = {
            "id": user_id,
            "email": email,
            "name": legacy.get("name") or email.split("@")[0],
            "password_hash": password_hash,
            "role": "user",
            "referral_code": legacy.get("referralCode") or legacy.get("referral_code") or _legacy_referral_code(email),
            "referred_by": legacy.get("sponsorId") or legacy.get("sponsor_id"),
            "coin_symbol": legacy.get("coin_symbol") or "USDT",
            "balance": balance,
            "daily_profit": float(legacy.get("daily_profit") or 0),
            "total_earnings": float(legacy.get("total_earnings") or max(balance, 0)),
            "referral_earnings": float(legacy.get("referral_earnings") or 0),
            "task_progress": float(legacy.get("task_progress") or 0),
            "tasks_completed": int(legacy.get("tasks_completed") or 0),
            "tasks_pending": int(legacy.get("tasks_pending") or 0),
            "commission_rate": float(legacy.get("commission_rate") or 5),
            "status": legacy.get("status") or "active",
            "withdrawal_processing_hours": int(legacy.get("withdrawal_processing_hours") or 24),
            "locked_balance": float(legacy.get("locked_balance") or 0),
            "bonus_balance": float(legacy.get("bonus_balance") or 0),
            "current_streak": int(legacy.get("current_streak") or 0),
            "longest_streak": int(legacy.get("longest_streak") or 0),
            "last_checkin_at": legacy.get("last_checkin_at"),
            "spin_tokens": int(legacy.get("spin_tokens") or 0),
            "spin_count": int(legacy.get("spin_count") or 0),
            "spin_reward_queue": legacy.get("spin_reward_queue") or [],
            "last_spin_at": legacy.get("last_spin_at"),
            "achievement_count": int(legacy.get("achievement_count") or 0),
            "membership_id": legacy.get("membership_id"),
            "membership_name": legacy.get("membership_name") or "Legacy",
            "plan_spin_reward_total": float(legacy.get("plan_spin_reward_total") or 0),
            "plan_spin_reward_pct": float(legacy.get("plan_spin_reward_pct") or 1),
            "plan_spin_reward_source_id": legacy.get("plan_spin_reward_source_id"),
            "first_deposit_rewarded": bool(legacy.get("firstDepositRewarded", legacy.get("first_deposit_rewarded", False))),
            "legacy_source": "app_data_db_json",
            "legacy_id": legacy_id,
            "created_at": created_at,
            "last_active": legacy.get("lastActive") or legacy.get("last_active") or created_at,
        }

        await db.users.insert_one(user_doc)
        inserted += 1

    if inserted or skipped:
        logger.info("Legacy app data user import complete: inserted=%s skipped=%s", inserted, skipped)

async def run_startup_task(name: str, task):
    try:
        await task()
        return True
    except Exception as exc:
        logger.error("%s skipped during startup: %s", name, exc)
        return False

async def send_plan_promo_reminders_once() -> int:
    now = now_utc()
    inactive_cutoff = (now - timedelta(hours=PLAN_PROMO_OFFLINE_HOURS)).isoformat()
    reminder_cutoff = (now - timedelta(hours=PLAN_PROMO_COOLDOWN_HOURS)).isoformat()
    query = {
        "role": "user",
        "membership_id": None,
        "status": {"$nin": ["suspended", "banned"]},
        "$and": [
            {"$or": [
                {"last_active": {"$lte": inactive_cutoff}},
                {"last_active": {"$exists": False}, "created_at": {"$lte": inactive_cutoff}},
            ]},
            {"$or": [
                {"plan_promo_last_notified_at": {"$exists": False}},
                {"plan_promo_last_notified_at": {"$lte": reminder_cutoff}},
            ]},
            {"$or": [
                {"plan_promo_notification_count": {"$exists": False}},
                {"plan_promo_notification_count": {"$lt": PLAN_PROMO_MAX_NOTIFICATIONS}},
            ]},
        ],
    }
    users = await db.users.find(query, {"_id": 0, "id": 1}).limit(100).to_list(100)
    sent = 0
    for user_doc in users:
        user_id = user_doc.get("id")
        if not user_id:
            continue
        updated = await db.users.update_one(
            {
                "id": user_id,
                "membership_id": None,
                "$or": [
                    {"plan_promo_last_notified_at": {"$exists": False}},
                    {"plan_promo_last_notified_at": {"$lte": reminder_cutoff}},
                ],
            },
            {
                "$set": {"plan_promo_last_notified_at": now.isoformat()},
                "$inc": {"plan_promo_notification_count": 1},
            },
        )
        if updated.modified_count != 1:
            continue
        notification = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": "Plan perks are available",
            "body": "When you are ready, plans can unlock daily plan rewards, extra spins, and faster withdrawal review.",
            "category": "membership",
            "read": False,
            "created_at": now.isoformat(),
        }
        await db.notifications.insert_one(notification)
        await _phase2_emit_user(user_id, "notification.created", notification)
        sent += 1
    return sent

async def plan_promo_reminder_loop():
    await asyncio.sleep(60)
    while True:
        try:
            sent = await send_plan_promo_reminders_once()
            if sent:
                logger.info("Plan promo reminders queued: %s", sent)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Plan promo reminder loop skipped cycle: %s", exc)
        await asyncio.sleep(PLAN_PROMO_LOOP_SECONDS)

@app.on_event("startup")
async def on_start():
    if await run_startup_task("Core database seed", seed):
        logger.info("Eregon Marketing API ready")
        await run_startup_task("Legacy app data user import", import_legacy_app_data_users)
        asyncio.create_task(plan_promo_reminder_loop())
    else:
        logger.warning("Eregon Marketing API started without database seed; MongoDB may be unavailable")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

@api.get("/")
async def health():
    return {"status": "ok", "service": "Eregon Marketing"}

# ---------------- Markets + Internal Trading ----------------
_market_cache: dict = {"expires_at": 0.0, "payload": None}


def _coingecko_headers() -> dict:
    headers = {"accept": "application/json", "user-agent": "EregonMarketing/1.0"}
    if COINGECKO_API_KEY:
        headers[COINGECKO_API_KEY_HEADER] = COINGECKO_API_KEY
    return headers


def _fetch_markets_sync(limit: int, vs_currency: str) -> list[dict]:
    params = {
        "vs_currency": vs_currency.lower(),
        "order": "market_cap_desc",
        "per_page": max(1, min(250, int(limit))),
        "page": 1,
        "sparkline": "true",
        "price_change_percentage": "1h,24h,7d",
    }
    response = requests.get(
        f"{COINGECKO_API_BASE}/coins/markets",
        params=params,
        headers=_coingecko_headers(),
        timeout=8,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise ValueError("CoinGecko response was not a list")
    return data


def _fetch_binance_markets_sync() -> list[dict]:
    symbol_meta = {
        "BTCUSDT": ("bitcoin", "btc", "Bitcoin", 1),
        "ETHUSDT": ("ethereum", "eth", "Ethereum", 2),
        "BNBUSDT": ("binancecoin", "bnb", "BNB", 4),
        "SOLUSDT": ("solana", "sol", "Solana", 5),
        "XRPUSDT": ("ripple", "xrp", "XRP", 6),
        "ADAUSDT": ("cardano", "ada", "Cardano", 8),
        "DOGEUSDT": ("dogecoin", "doge", "Dogecoin", 9),
        "TRXUSDT": ("tron", "trx", "TRON", 10),
    }
    response = requests.get(f"{BINANCE_API_BASE}/ticker/24hr", timeout=6)
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, list):
        raise ValueError("Binance ticker response was not a list")
    by_symbol = {item.get("symbol"): item for item in data if item.get("symbol") in symbol_meta}
    markets = []
    for ticker, (coin_id, symbol, name, rank) in symbol_meta.items():
        item = by_symbol.get(ticker)
        if not item:
            continue
        price = float(item.get("lastPrice") or 0)
        if price <= 0:
            continue
        volume = float(item.get("quoteVolume") or 0)
        change = float(item.get("priceChangePercent") or 0)
        markets.append({
            "id": coin_id,
            "symbol": symbol,
            "name": name,
            "image": None,
            "current_price": price,
            "market_cap": 0.0,
            "market_cap_rank": rank,
            "total_volume": volume,
            "price_change_percentage_24h": change,
            "sparkline_in_7d": {"price": []},
            "source": "binance",
        })
    if len(markets) < 3:
        raise ValueError("Binance returned too few usable markets")
    return markets


async def get_market_snapshot(limit: int = TRADING_DEFAULT_LIMIT, vs_currency: str = "usd", include_custom: bool = True, force: bool = False) -> dict:
    now = time.time()
    limit = max(1, min(250, int(limit or TRADING_DEFAULT_LIMIT)))
    vs_currency = (vs_currency or "usd").lower()
    cache_key = f"{vs_currency}:{limit}:{include_custom}"
    cached = _market_cache.get("payload")
    if not force and cached and _market_cache.get("key") == cache_key and now < float(_market_cache.get("expires_at", 0)):
        return await _with_live_market_controls(cached)

    source = "coingecko"
    error = None
    try:
        live = await asyncio.to_thread(_fetch_markets_sync, limit, vs_currency)
        coins = merge_markets(live, include_custom=include_custom)
    except Exception as exc:
        error = str(exc)[:180]
        try:
            live = await asyncio.to_thread(_fetch_binance_markets_sync)
            coins = merge_markets(live, include_custom=include_custom)
            source = "binance"
        except Exception as binance_exc:
            logger.warning("Market fetch failed; using static fallback. coingecko=%s binance=%s", exc, binance_exc)
            coins = fallback_markets(limit)
            source = "fallback"
            error = f"{error}; Binance: {str(binance_exc)[:120]}"

    payload = {
        "coins": coins[:limit + (4 if include_custom else 0)],
        "count": len(coins[:limit + (4 if include_custom else 0)]),
        "vs_currency": vs_currency.upper(),
        "source": source,
        "source_error": error,
        "provider": "CoinGecko" if source == "coingecko" else "Binance" if source == "binance" else "Fallback cache",
        "fee_rate": TRADING_FEE_RATE,
        "updated_at": now_utc().isoformat(),
        "cache_seconds": MARKET_CACHE_SECONDS,
    }
    _market_cache.update({"key": cache_key, "expires_at": now + MARKET_CACHE_SECONDS, "payload": payload})
    return await _with_live_market_controls(payload)


def _smooth_progress(progress: float) -> float:
    p = max(0.0, min(1.0, float(progress)))
    return p * p * (3 - 2 * p)


async def _with_live_market_controls(payload: dict) -> dict:
    now_ts = time.time()
    coins = animate_market_prices(payload.get("coins") or [], now_ts)
    targets = await db.market_price_targets.find({"status": {"$ne": "disabled"}}, {"_id": 0}).to_list(500)
    by_symbol = {normalize_symbol(t.get("symbol")): t for t in targets if t.get("symbol")}
    for coin in coins:
        symbol = normalize_symbol(coin.get("symbol"))
        target = by_symbol.get(symbol)
        if not target:
            continue
        from_price = float(target.get("from_price") or coin.get("current_price") or target.get("target_price") or 0)
        target_price = float(target.get("target_price") or 0)
        start_ts = float(target.get("start_ts") or now_ts)
        end_ts = float(target.get("end_ts") or start_ts + 12)
        if target_price <= 0:
            continue
        if now_ts >= end_ts:
            price = target_price
            if target.get("status") == "active":
                await db.market_price_targets.update_one({"id": target.get("id")}, {"$set": {"status": "completed", "completed_at": now_utc().isoformat()}})
        else:
            progress = _smooth_progress((now_ts - start_ts) / max(1.0, end_ts - start_ts))
            price = from_price + (target_price - from_price) * progress
        prior = max(0.00000001, float(coin.get("current_price") or price))
        coin["current_price"] = round(max(0.00000001, price), 10)
        coin["price_change_percentage_24h"] = round(float(coin.get("price_change_percentage_24h") or 0) + ((price - prior) / prior * 100), 4)
        coin["admin_target_active"] = target.get("status") == "active" and now_ts < end_ts
    live_payload = dict(payload)
    live_payload["coins"] = coins
    live_payload["count"] = len(coins)
    live_payload["updated_at"] = now_utc().isoformat()
    live_payload["cache_seconds"] = min(int(payload.get("cache_seconds") or MARKET_CACHE_SECONDS), 3)
    return live_payload


def _find_market_by_symbol(coins: list[dict], symbol: str) -> Optional[dict]:
    normalized = normalize_symbol(symbol)
    for coin in coins:
        if normalize_symbol(coin.get("symbol")) == normalized:
            return coin
    return None


def _build_pair_payload(base: str, quote: str, prices: dict) -> Optional[dict]:
    try:
        rate = pair_rate(base, quote, prices)
    except ValueError:
        return None
    return {"pair": f"{normalize_symbol(base)}/{normalize_symbol(quote)}", "base": normalize_symbol(base), "quote": normalize_symbol(quote), "rate": round(rate, 12)}


def _user_balance_map(user: dict) -> dict:
    balances = {"USDT": round(float(user.get("balance", 0) or 0), 12)}
    for symbol, amount in (user.get("crypto_balances") or {}).items():
        sym = normalize_symbol(symbol)
        if sym and sym != "USDT":
            try:
                balances[sym] = round(float(amount or 0), 12)
            except (TypeError, ValueError):
                continue
    return balances


def _portfolio_from_balances(balances: dict, markets: list[dict]) -> dict:
    prices = market_price_map(markets)
    by_symbol = {normalize_symbol(item.get("symbol")): item for item in markets}
    positions = []
    total_usd = 0.0
    for symbol, amount in sorted(balances.items()):
        amount = float(amount or 0)
        if abs(amount) < 0.0000000001:
            continue
        price = float(prices.get(symbol, 1.0 if symbol in {"USDT", "USDC", "USD"} else 0.0) or 0.0)
        usd_value = amount * price
        total_usd += usd_value
        market = by_symbol.get(symbol, {})
        positions.append({
            "symbol": symbol,
            "name": market.get("name") or ("Tether" if symbol == "USDT" else symbol),
            "amount": round(amount, 12),
            "price_usd": round(price, 10),
            "usd_value": round(usd_value, 6),
            "change_24h": float(market.get("price_change_percentage_24h") or 0.0),
            "image": market.get("image"),
            "custom": bool(market.get("custom", False)),
        })
    return {"positions": positions, "total_usd": round(total_usd, 6)}


@api.get("/markets")
async def public_markets(limit: int = TRADING_DEFAULT_LIMIT, vs_currency: str = "usd", include_custom: bool = True, force: bool = False):
    """Top crypto markets with live internal price motion. Uses CoinGecko when available."""
    return await get_market_snapshot(limit=limit, vs_currency=vs_currency, include_custom=include_custom, force=force)


@api.get("/admin/market-targets")
async def admin_market_targets(admin: dict = Depends(admin_required)):
    items = await db.market_price_targets.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api.post("/admin/market-targets")
async def admin_set_market_target(body: MarketPriceTargetIn, admin: dict = Depends(admin_required)):
    symbol = normalize_symbol(body.symbol)
    snapshot = await get_market_snapshot(limit=TRADING_DEFAULT_LIMIT, include_custom=True, force=True)
    coin = _find_market_by_symbol(snapshot["coins"], symbol)
    if not coin:
        raise HTTPException(status_code=404, detail="Coin symbol not found in current market list")
    now_ts = time.time()
    duration = max(10, min(15, int(body.duration_seconds or 12)))
    target = {
        "id": str(uuid.uuid4()),
        "symbol": symbol,
        "coin_name": coin.get("name") or symbol,
        "from_price": round(float(coin.get("current_price") or 0), 10),
        "target_price": round(float(body.target_price), 10),
        "duration_seconds": duration,
        "start_ts": now_ts,
        "end_ts": now_ts + duration,
        "status": "active",
        "created_by": admin["id"],
        "created_at": now_utc().isoformat(),
    }
    await db.market_price_targets.update_many({"symbol": symbol, "status": {"$ne": "disabled"}}, {"$set": {"status": "disabled", "disabled_at": now_utc().isoformat()}})
    await db.market_price_targets.insert_one(target)
    await _phase2_emit_all("markets.target_updated", {"symbol": symbol, "duration_seconds": duration})
    target.pop("_id", None)
    return {"ok": True, "target": target}


@api.get("/trading/pairs")
async def trading_pairs():
    snapshot = await get_market_snapshot(limit=TRADING_DEFAULT_LIMIT, include_custom=True)
    prices = market_price_map(snapshot["coins"])
    preferred = ["BTC", "ETH", "BNB", "SOL", "XRP", "DOGE", "ADA", "TRX", "ERGN", "RYL", "MRKT", "BTD"]
    symbols = [normalize_symbol(c.get("symbol")) for c in snapshot["coins"] if c.get("symbol")]
    tradable = []
    for sym in preferred + symbols:
        if sym and sym not in {"USDT", "USDC", "USD"} and sym not in tradable and sym in prices:
            tradable.append(sym)
        if len(tradable) >= 60:
            break

    pairs = []
    for sym in tradable:
        pair = _build_pair_payload(sym, "USDT", prices)
        if pair:
            pairs.append(pair)
    for base, quote in [("ETH", "BTC"), ("BNB", "BTC"), ("SOL", "BTC"), ("ERGN", "USDT"), ("RYL", "USDT"), ("MRKT", "USDT"), ("BTD", "USDT")]:
        pair = _build_pair_payload(base, quote, prices)
        if pair and all(existing["pair"] != pair["pair"] for existing in pairs):
            pairs.insert(0, pair)
    return {"pairs": pairs, "fee_rate": TRADING_FEE_RATE, "updated_at": snapshot["updated_at"], "source": snapshot["source"]}


@api.get("/trading/portfolio")
async def trading_portfolio(user: dict = Depends(get_current_user)):
    snapshot = await get_market_snapshot(limit=TRADING_DEFAULT_LIMIT, include_custom=True)
    balances = _user_balance_map(user)
    portfolio = _portfolio_from_balances(balances, snapshot["coins"])
    return {
        "balances": balances,
        "positions": portfolio["positions"],
        "total_usd": portfolio["total_usd"],
        "fee_rate": TRADING_FEE_RATE,
        "market_source": snapshot["source"],
        "updated_at": snapshot["updated_at"],
    }


@api.get("/trading/orders", response_model=List[TradingOrderOut])
async def trading_order_history(limit: int = 50, user: dict = Depends(get_current_user)):
    items = await db.trades.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(200, limit)))
    return items


@api.post("/trading/orders")
async def place_trading_order(body: TradingOrderIn, user: dict = Depends(get_current_user)):
    snapshot = await get_market_snapshot(limit=TRADING_DEFAULT_LIMIT, include_custom=True, force=False)
    prices = market_price_map(snapshot["coins"])
    pair = body.pair.strip().upper().replace("-", "/")
    try:
        fill = apply_trade_balances(_user_balance_map(user), pair, body.side, float(body.amount), prices, fee_rate=TRADING_FEE_RATE)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    before_balances = fill["before"]
    after_balances = fill["after"]
    before_usdt = float(before_balances.get("USDT", 0.0))
    after_usdt = float(after_balances.get("USDT", 0.0))
    crypto_after = {sym: amt for sym, amt in after_balances.items() if sym != "USDT" and abs(float(amt or 0)) >= 0.0000000001}
    now_iso = now_utc().isoformat()

    updated = await db.users.find_one_and_update(
        {"id": user["id"], "status": {"$ne": "suspended"}},
        {"$set": {"balance": round(after_usdt, 12), "crypto_balances": crypto_after, "last_active": now_iso}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Trading is unavailable for this account")

    trade_id = str(uuid.uuid4())
    trade = {
        "id": trade_id,
        "user_id": user["id"],
        "pair": f"{fill['base_symbol']}/{fill['quote_symbol']}",
        "side": fill["side"],
        "base_symbol": fill["base_symbol"],
        "quote_symbol": fill["quote_symbol"],
        "amount": round(float(body.amount), 12),
        "rate": fill["rate"],
        "executed_base": fill["executed_base"],
        "executed_quote": fill["executed_quote"],
        "fee_amount": fill["fee_amount"],
        "fee_coin": fill["fee_coin"],
        "before_balances": before_balances,
        "after_balances": after_balances,
        "market_source": snapshot["source"],
        "status": "filled",
        "created_at": now_iso,
    }
    await db.trades.insert_one(trade)

    usdt_delta = round(after_usdt - before_usdt, 12)
    note = (
        f"{fill['side'].title()} {fill['executed_base']:g} {fill['base_symbol']} "
        f"on {fill['base_symbol']}/{fill['quote_symbol']} at {fill['rate']:g}; "
        f"fee {fill['fee_amount']:g} {fill['fee_coin']}"
    )
    await record_tx(
        user_id=user["id"],
        type_="trading_buy" if fill["side"] == "buy" else "trading_sell",
        amount=usdt_delta,
        coin="USDT",
        before_balance=before_usdt,
        after_balance=after_usdt,
        reference_id=trade_id,
        note=note,
    )
    await _phase2_emit_user(user["id"], "balance.updated", {"balance": after_usdt, "crypto_balances": crypto_after, "source": "trading", "trade": trade})
    trade.pop("_id", None)
    portfolio = _portfolio_from_balances(after_balances, snapshot["coins"])
    return {"ok": True, "trade": trade, "portfolio": {"balances": after_balances, **portfolio}}


async def _settle_expired_options(user_id: Optional[str] = None) -> int:
    now_iso = now_utc().isoformat()
    q = {"status": "open", "expires_at": {"$lte": now_iso}}
    if user_id:
        q["user_id"] = user_id
    pending = await db.options_trades.find(q, {"_id": 0}).to_list(100)
    if not pending:
        return 0
    snapshot = await get_market_snapshot(limit=TRADING_DEFAULT_LIMIT, include_custom=True, force=False)
    prices = market_price_map(snapshot["coins"])
    settled = 0
    for option in pending:
        try:
            base, quote = split_pair(option.get("pair"))
            exit_rate = pair_rate(base, quote, prices)
        except ValueError:
            continue
        entry_rate = float(option.get("entry_rate") or 0)
        direction = option.get("direction")
        forced_outcome = option.get("forced_outcome")
        if forced_outcome == "win":
            won = True
        elif forced_outcome == "lose":
            won = False
        else:
            won = (exit_rate > entry_rate and direction == "up") or (exit_rate < entry_rate and direction == "down")
        stake = round(float(option.get("stake") or 0), 2)
        payout_rate = float(option.get("payout_rate") or OPTIONS_PAYOUT_RATE)
        payout = round(stake * (1 + payout_rate), 2) if won else 0.0
        profit = round(payout - stake, 2) if won else round(-stake, 2)
        before = None
        after = None
        if won and payout > 0:
            updated = await db.users.find_one_and_update(
                {"id": option["user_id"]},
                {"$inc": {"balance": payout, "total_earnings": max(0.0, profit)}, "$set": {"last_active": now_iso}},
                return_document=ReturnDocument.AFTER,
            )
            if updated:
                after = round(float(updated.get("balance", 0)), 2)
                before = round(after - payout, 2)
                await record_tx(
                    user_id=option["user_id"],
                    type_="options_payout",
                    amount=payout,
                    coin="USDT",
                    before_balance=before,
                    after_balance=after,
                    reference_id=option["id"],
                    note=f"Options {direction.upper()} win on {option.get('pair')} at {exit_rate:g}; profit {profit:g} USDT",
                )
        await db.options_trades.update_one(
            {"id": option["id"], "status": "open"},
            {"$set": {
                "status": "won" if won else "lost",
                "exit_rate": round(exit_rate, 12),
                "payout": payout,
                "profit": profit,
                "settled_at": now_iso,
                "market_source": snapshot["source"],
                "settled_rule": "admin" if forced_outcome in {"win", "lose"} else "market",
            }},
        )
        result_word = "won" if won else "lost"
        user_body = (
            f"Your {option.get('pair')} {str(direction).upper()} contract {result_word}. "
            f"Entry {entry_rate:g}, exit {exit_rate:g}. "
            f"{'Payout ' + str(payout) + ' USDT.' if won else 'Stake lost.'}"
        )
        admin_body = (
            f"{option.get('pair')} {str(direction).upper()} options contract by user {option.get('user_id')} "
            f"{result_word}. Stake {stake:g} USDT, profit {profit:g} USDT."
        )
        await create_user_notification(option["user_id"], "Options Contract Settled", user_body, "trading")
        await create_admin_notifications("Options Contract Settled", admin_body, "trading")
        await _phase2_emit_admin("options.settled", {"id": option["id"], "status": "won" if won else "lost", "user_id": option["user_id"], "pair": option.get("pair")})
        settled += 1
    return settled


@api.get("/admin/trading/options")
async def admin_options_trades(status: Optional[str] = None, limit: int = 100, admin: dict = Depends(admin_required)):
    await _settle_expired_options()
    q = {}
    if status:
        q["status"] = status
    items = await db.options_trades.find(q, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(500, limit)))
    user_ids = [item.get("user_id") for item in items if item.get("user_id")]
    users = await db.users.find({"id": {"$in": user_ids}}, {"_id": 0, "id": 1, "email": 1, "name": 1}).to_list(len(user_ids) or 1)
    by_id = {u["id"]: u for u in users}
    for item in items:
        item["user"] = by_id.get(item.get("user_id"))
    return items


@api.post("/admin/trading/options/{option_id}/outcome")
async def admin_set_options_outcome(option_id: str, body: OptionsOutcomeIn, admin: dict = Depends(admin_required)):
    option = await db.options_trades.find_one({"id": option_id}, {"_id": 0})
    if not option:
        raise HTTPException(status_code=404, detail="Options contract not found")
    if option.get("status") != "open":
        raise HTTPException(status_code=400, detail="Only open options contracts can be controlled")
    update: dict = {
        "$set": {
            "admin_outcome_updated_by": admin["id"],
            "admin_outcome_updated_at": now_utc().isoformat(),
        }
    }
    if body.outcome == "auto":
        update["$unset"] = {"forced_outcome": ""}
    else:
        update["$set"]["forced_outcome"] = body.outcome
    await db.options_trades.update_one({"id": option_id}, update)
    refreshed = await db.options_trades.find_one({"id": option_id}, {"_id": 0})
    await db.admin_logs.insert_one({"id": str(uuid.uuid4()), "admin_id": admin["id"], "action": "options.outcome.set", "target_id": option_id, "metadata": {"outcome": body.outcome}, "created_at": now_utc().isoformat()})
    await _phase2_emit_admin("options.outcome_updated", refreshed)
    return {"ok": True, "option": refreshed}


@api.get("/trading/options")
async def options_trade_history(limit: int = 50, user: dict = Depends(get_current_user)):
    await _settle_expired_options(user["id"])
    items = await db.options_trades.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(max(1, min(200, limit)))
    return {"items": items, "payout_rate": OPTIONS_PAYOUT_RATE, "durations": OPTIONS_DURATIONS_SECONDS}


@api.post("/trading/options")
async def place_options_trade(body: OptionsTradeIn, user: dict = Depends(get_current_user)):
    duration = int(body.duration_seconds or 60)
    if duration not in OPTIONS_DURATIONS_SECONDS:
        raise HTTPException(status_code=400, detail="Unsupported contract duration")
    stake = round(float(body.stake), 2)
    if stake <= 0:
        raise HTTPException(status_code=400, detail="Stake must be greater than zero")
    snapshot = await get_market_snapshot(limit=TRADING_DEFAULT_LIMIT, include_custom=True, force=False)
    prices = market_price_map(snapshot["coins"])
    pair = body.pair.strip().upper().replace("-", "/")
    try:
        base, quote = split_pair(pair)
        entry_rate = pair_rate(base, quote, prices)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if quote != "USDT":
        raise HTTPException(status_code=400, detail="Options contracts currently use USDT pairs only")
    now = now_utc()
    expires_at = now + timedelta(seconds=duration)
    updated = await db.users.find_one_and_update(
        {"id": user["id"], "status": {"$ne": "suspended"}, "balance": {"$gte": stake}},
        {"$inc": {"balance": -stake}, "$set": {"last_active": now.isoformat()}},
        return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Insufficient USDT balance for this contract")
    after = round(float(updated.get("balance", 0)), 2)
    before = round(after + stake, 2)
    option_id = str(uuid.uuid4())
    option = {
        "id": option_id,
        "user_id": user["id"],
        "pair": f"{base}/{quote}",
        "direction": body.direction,
        "stake": stake,
        "payout_rate": OPTIONS_PAYOUT_RATE,
        "entry_rate": round(entry_rate, 12),
        "duration_seconds": duration,
        "status": "open",
        "market_source": snapshot["source"],
        "created_at": now.isoformat(),
        "expires_at": expires_at.isoformat(),
    }
    await db.options_trades.insert_one(option)
    option.pop("_id", None)
    await record_tx(
        user_id=user["id"],
        type_="options_stake",
        amount=-stake,
        coin="USDT",
        before_balance=before,
        after_balance=after,
        reference_id=option_id,
        note=f"Options {body.direction.upper()} contract on {base}/{quote} for {duration}s",
    )
    await create_user_notification(
        user["id"],
        "Options Contract Opened",
        f"Your {base}/{quote} {body.direction.upper()} contract is open for {duration}s with a {stake:g} USDT stake.",
        "trading",
    )
    await create_admin_notifications(
        "New Options Contract",
        f"{user.get('email') or user['id']} opened {base}/{quote} {body.direction.upper()} for {stake:g} USDT, expiring in {duration}s.",
        "trading",
    )
    admin_option = {
        **option,
        "user": {
            "id": user["id"],
            "email": user.get("email"),
            "name": user.get("name") or user.get("full_name"),
        },
    }
    await _phase2_emit_user(user["id"], "balance.updated", {"balance": after, "source": "options", "option": option})
    await _phase2_emit_admin("options.opened", admin_option)
    return {"ok": True, "option": option, "balance": after}

# ====================================================================
# PHASE 1 ENTERPRISE EXTENSIONS
# ====================================================================

# ---------------- Transaction Ledger ----------------
class TxOut(BaseModel):
    id: str
    user_id: str
    type: str
    amount: float
    coin: str
    before_balance: float
    after_balance: float
    admin_id: Optional[str] = None
    reference_id: Optional[str] = None
    note: Optional[str] = None
    status: str
    created_at: str

@api.get("/user/transactions", response_model=List[TxOut])
async def user_transactions(user: dict = Depends(get_current_user),
                            type_filter: Optional[str] = None,
                            coin: Optional[str] = None,
                            limit: int = 200):
    q: dict = {"user_id": user["id"]}
    if type_filter:
        q["type"] = type_filter
    if coin:
        q["coin"] = coin
    items = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items

@api.get("/admin/transactions", response_model=List[TxOut])
async def admin_transactions(admin: dict = Depends(admin_required),
                              user_id: Optional[str] = None,
                              type_filter: Optional[str] = None,
                              coin: Optional[str] = None,
                              date_from: Optional[str] = None,
                              date_to: Optional[str] = None,
                              limit: int = 500):
    q: dict = {}
    if user_id: q["user_id"] = user_id
    if type_filter: q["type"] = type_filter
    if coin: q["coin"] = coin
    if date_from or date_to:
        q["created_at"] = {}
        if date_from: q["created_at"]["$gte"] = date_from
        if date_to:   q["created_at"]["$lte"] = date_to
    items = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items

@api.get("/admin/transactions.csv")
async def admin_transactions_csv(admin: dict = Depends(admin_required),
                                  user_id: Optional[str] = None,
                                  type_filter: Optional[str] = None,
                                  coin: Optional[str] = None):
    q: dict = {}
    if user_id: q["user_id"] = user_id
    if type_filter: q["type"] = type_filter
    if coin: q["coin"] = coin
    items = await db.transactions.find(q, {"_id": 0}).sort("created_at", -1).to_list(5000)
    lines = ["id,user_id,type,amount,coin,before_balance,after_balance,admin_id,reference_id,note,status,created_at"]
    for t in items:
        note = (t.get("note") or "").replace(",", " ").replace("\n", " ")
        lines.append(
            f'{t["id"]},{t["user_id"]},{t["type"]},{t["amount"]},{t["coin"]},'
            f'{t["before_balance"]},{t["after_balance"]},{t.get("admin_id") or ""},'
            f'{t.get("reference_id") or ""},{note},{t["status"]},{t["created_at"]}'
        )
    csv = "\n".join(lines)
    return Response(content=csv, media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=transactions.csv"})

# ---------------- Activity Logs ----------------
class ActivityOut(BaseModel):
    id: str
    user_id: str
    action: str
    ip: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: str

@api.get("/admin/activity", response_model=List[ActivityOut])
async def admin_activity(admin: dict = Depends(admin_required),
                          user_id: Optional[str] = None, limit: int = 300):
    q = {"user_id": user_id} if user_id else {}
    items = await db.activity_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items

# ---------------- Support Tickets ----------------
class TicketIn(BaseModel):
    subject: str = Field(min_length=2, max_length=160)
    body: str = Field(min_length=2)
    priority: Literal["low", "normal", "high", "urgent"] = "normal"
    attachment_data_url: Optional[str] = None

class TicketMessageIn(BaseModel):
    body: str
    attachment_data_url: Optional[str] = None

class TicketUpdateIn(BaseModel):
    status: Optional[Literal["open", "pending", "resolved", "closed"]] = None
    priority: Optional[Literal["low", "normal", "high", "urgent"]] = None
    assigned_to: Optional[str] = None

class TicketMessageOut(BaseModel):
    id: str
    ticket_id: str
    author_id: str
    author_role: str
    body: str
    attachment_data_url: Optional[str] = None
    created_at: str

class TicketOut(BaseModel):
    id: str
    user_id: str
    user_email: str
    user_name: str
    subject: str
    status: str
    priority: str
    assigned_to: Optional[str] = None
    unread_for_user: int = 0
    unread_for_admin: int = 0
    last_message_at: str
    created_at: str

async def ticket_to_out(t: dict) -> dict:
    u = await db.users.find_one({"id": t["user_id"]}, {"_id": 0, "email": 1, "name": 1})
    return {
        "id": t["id"], "user_id": t["user_id"],
        "user_email": u["email"] if u else "—",
        "user_name": u["name"] if u else "—",
        "subject": t["subject"], "status": t["status"], "priority": t["priority"],
        "assigned_to": t.get("assigned_to"),
        "unread_for_user": t.get("unread_for_user", 0),
        "unread_for_admin": t.get("unread_for_admin", 0),
        "last_message_at": t["last_message_at"], "created_at": t["created_at"],
    }

@api.get("/user/tickets", response_model=List[TicketOut])
async def list_user_tickets(user: dict = Depends(get_current_user)):
    items = await db.tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("last_message_at", -1).to_list(200)
    return [await ticket_to_out(t) for t in items]

@api.post("/user/tickets", response_model=TicketOut)
async def create_ticket(body: TicketIn, user: dict = Depends(get_current_user)):
    tid = str(uuid.uuid4())
    now = now_utc().isoformat()
    t = {
        "id": tid, "user_id": user["id"], "subject": body.subject,
        "status": "open", "priority": body.priority, "assigned_to": None,
        "unread_for_user": 0, "unread_for_admin": 1,
        "last_message_at": now, "created_at": now,
    }
    await db.tickets.insert_one(t)
    await db.ticket_messages.insert_one({
        "id": str(uuid.uuid4()), "ticket_id": tid,
        "author_id": user["id"], "author_role": "user",
        "body": body.body, "attachment_data_url": body.attachment_data_url,
        "created_at": now,
    })
    return await ticket_to_out(t)

@api.get("/user/tickets/{tid}/messages", response_model=List[TicketMessageOut])
async def list_user_ticket_messages(tid: str, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"id": tid, "user_id": user["id"]})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    msgs = await db.ticket_messages.find({"ticket_id": tid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    await db.tickets.update_one({"id": tid}, {"$set": {"unread_for_user": 0}})
    return msgs

@api.post("/user/tickets/{tid}/messages", response_model=TicketMessageOut)
async def reply_user_ticket(tid: str, body: TicketMessageIn, user: dict = Depends(get_current_user)):
    t = await db.tickets.find_one({"id": tid, "user_id": user["id"]})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    msg = {
        "id": str(uuid.uuid4()), "ticket_id": tid,
        "author_id": user["id"], "author_role": "user",
        "body": body.body, "attachment_data_url": body.attachment_data_url,
        "created_at": now_utc().isoformat(),
    }
    await db.ticket_messages.insert_one(msg)
    await db.tickets.update_one({"id": tid}, {"$set": {"last_message_at": msg["created_at"], "status": "open"},
                                                "$inc": {"unread_for_admin": 1}})
    msg.pop("_id", None)
    await _phase2_emit_admin("ticket.user_reply", {"ticket_id": tid, "message": msg})
    return msg

@api.get("/admin/tickets", response_model=List[TicketOut])
async def admin_list_tickets(admin: dict = Depends(admin_required),
                              status_filter: Optional[str] = None,
                              priority: Optional[str] = None):
    q: dict = {}
    if status_filter: q["status"] = status_filter
    if priority: q["priority"] = priority
    items = await db.tickets.find(q, {"_id": 0}).sort("last_message_at", -1).to_list(500)
    return [await ticket_to_out(t) for t in items]

@api.get("/admin/tickets/{tid}/messages", response_model=List[TicketMessageOut])
async def admin_list_ticket_messages(tid: str, admin: dict = Depends(admin_required)):
    msgs = await db.ticket_messages.find({"ticket_id": tid}, {"_id": 0}).sort("created_at", 1).to_list(500)
    await db.tickets.update_one({"id": tid}, {"$set": {"unread_for_admin": 0}})
    return msgs

@api.post("/admin/tickets/{tid}/messages", response_model=TicketMessageOut)
async def admin_reply_ticket(tid: str, body: TicketMessageIn, admin: dict = Depends(admin_required)):
    t = await db.tickets.find_one({"id": tid})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    msg = {
        "id": str(uuid.uuid4()), "ticket_id": tid,
        "author_id": admin["id"], "author_role": "admin",
        "body": body.body, "attachment_data_url": body.attachment_data_url,
        "created_at": now_utc().isoformat(),
    }
    await db.ticket_messages.insert_one(msg)
    await db.tickets.update_one({"id": tid}, {"$set": {"last_message_at": msg["created_at"], "status": "pending"},
                                                "$inc": {"unread_for_user": 1}})
    msg.pop("_id", None)
    await _phase2_emit_user(t["user_id"], "ticket.admin_reply", {"ticket_id": tid, "message": msg})
    return msg

@api.patch("/admin/tickets/{tid}", response_model=TicketOut)
async def admin_update_ticket(tid: str, body: TicketUpdateIn, admin: dict = Depends(admin_required)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.tickets.update_one({"id": tid}, {"$set": update})
    t = await db.tickets.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return await ticket_to_out(t)

# ---------------- Live Activity Feed ----------------
class FeedIn(BaseModel):
    message: str
    icon: Optional[str] = "sparkles"

class FeedOut(BaseModel):
    id: str
    message: str
    icon: str
    source: str
    created_at: str

@api.get("/public/feed", response_model=List[FeedOut])
async def public_feed(limit: int = 50):
    items = await db.live_feed.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return items

@api.post("/admin/feed", response_model=FeedOut)
async def admin_create_feed(body: FeedIn, admin: dict = Depends(admin_required)):
    rec = {"id": str(uuid.uuid4()), "message": body.message, "icon": body.icon or "sparkles",
           "source": "admin", "created_at": now_utc().isoformat()}
    await db.live_feed.insert_one(rec)
    rec.pop("_id", None)
    await _phase2_emit_all("feed.created", rec)
    return rec

@api.delete("/admin/feed/{fid}")
async def admin_delete_feed(fid: str, admin: dict = Depends(admin_required)):
    await db.live_feed.delete_one({"id": fid})
    return {"ok": True}

@api.get("/admin/feed/settings")
async def admin_feed_settings(admin: dict = Depends(admin_required)):
    s = await db.settings.find_one({"key": "feed"}, {"_id": 0}) or {"key": "feed", "auto_enabled": True, "interval_sec": 8}
    return s

@api.post("/admin/feed/settings")
async def admin_save_feed_settings(payload: dict, admin: dict = Depends(admin_required)):
    s = {"key": "feed",
         "auto_enabled": bool(payload.get("auto_enabled", True)),
         "interval_sec": int(payload.get("interval_sec", 8))}
    await db.settings.update_one({"key": "feed"}, {"$set": s}, upsert=True)
    return s

# ---------------- Bulk Reward Tools ----------------
class BulkBonusIn(BaseModel):
    target: Literal["all", "tier", "ids"]
    tier: Optional[str] = None
    user_ids: Optional[List[str]] = None
    amount: float
    note: Optional[str] = "Bulk bonus from Eregon Admin"

class BulkCommissionIn(BaseModel):
    target: Literal["all", "tier", "ids"]
    tier: Optional[str] = None
    user_ids: Optional[List[str]] = None
    delta_percent: float  # add this to existing commission_rate

class AdminUserRewardIn(BaseModel):
    user_identifier: str = Field(min_length=1, max_length=160)
    amount: float = Field(gt=0)
    coin: str = "USDT"
    message: str = Field(default="Manual reward from Eregon Admin", min_length=1, max_length=240)

async def _resolve_single_user_identifier(identifier: str) -> dict:
    value = str(identifier or "").strip()
    if not value:
        raise HTTPException(status_code=400, detail="User ID, email, name, or referral code is required")
    q = {
        "role": "user",
        "$or": [
            {"id": value},
            {"email": value.lower()},
            {"referral_code": value.upper()},
            {"name": {"$regex": f"^{re.escape(value)}$", "$options": "i"}},
        ],
    }
    matches = await db.users.find(q).to_list(5)
    if not matches:
        raise HTTPException(status_code=404, detail="User not found for the supplied ID, email, name, or referral code")
    if len(matches) > 1:
        raise HTTPException(status_code=400, detail="Multiple users match this name. Use email or user ID instead")
    return matches[0]

async def _resolve_users(target: str, tier: Optional[str], user_ids: Optional[List[str]]):
    q: dict = {"role": "user"}
    if target == "tier" and tier:
        q["membership_name"] = tier
    elif target == "ids" and user_ids:
        q["id"] = {"$in": user_ids}
    return await db.users.find(q).to_list(5000)

@api.post("/admin/bulk/bonus")
async def admin_bulk_bonus(body: BulkBonusIn, admin: dict = Depends(admin_required)):
    require_wallet_manager(admin)
    targets = await _resolve_users(body.target, body.tier, body.user_ids)
    count = 0
    for u in targets:
        before = float(u.get("balance", 0))
        after = before + float(body.amount)
        await db.users.update_one({"id": u["id"]}, {"$set": {"balance": after}})
        await record_tx(
            user_id=u["id"], type_="bulk_bonus", amount=float(body.amount),
            coin=u.get("coin_symbol", "USDT"),
            before_balance=before, after_balance=after,
            admin_id=admin["id"], note=body.note,
        )
        count += 1
    return {"ok": True, "affected": count}

@api.post("/admin/bulk/commission")
async def admin_bulk_commission(body: BulkCommissionIn, admin: dict = Depends(admin_required)):
    targets = await _resolve_users(body.target, body.tier, body.user_ids)
    count = 0
    for u in targets:
        new_rate = float(u.get("commission_rate", 0)) + float(body.delta_percent)
        await db.users.update_one({"id": u["id"]}, {"$set": {"commission_rate": new_rate}})
        count += 1
    return {"ok": True, "affected": count}

@api.post("/admin/user-rewards")
async def admin_grant_user_reward(body: AdminUserRewardIn, admin: dict = Depends(admin_required)):
    user_doc = await _resolve_single_user_identifier(body.user_identifier)
    amount = round(float(body.amount), 2)
    coin = (body.coin or user_doc.get("coin_symbol", "USDT")).upper()
    note = body.message.strip() or "Manual reward from Eregon Admin"
    reference_id = str(uuid.uuid4())
    updated_user = await db.users.find_one_and_update(
        {"id": user_doc["id"]},
        {
            "$inc": {"balance": amount, "bonus_balance": amount, "total_earnings": amount},
            "$set": {"coin_symbol": coin, "last_active": now_utc().isoformat()},
        },
        return_document=ReturnDocument.AFTER,
    )
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found")
    after = round(float(updated_user.get("balance", amount)), 2)
    before = round(after - amount, 2)
    bonus_after = round(float(updated_user.get("bonus_balance", amount)), 2)
    tx = await record_tx(
        user_id=user_doc["id"],
        type_="admin_user_reward",
        amount=amount,
        coin=coin,
        before_balance=before,
        after_balance=after,
        admin_id=admin["id"],
        reference_id=reference_id,
        note=note,
    )
    bonus = {"id": reference_id, "user_id": user_doc["id"], "amount": amount, "source": "admin_user_reward", "note": note, "created_at": now_utc().isoformat()}
    await db.bonuses.insert_one(bonus)
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": user_doc["id"],
        "title": "Reward Credited",
        "body": f"{amount:g} {coin} credited: {note}",
        "category": "rewards",
        "read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.notifications.insert_one(notification)
    await _phase2_emit_user(user_doc["id"], "balance.updated", {"balance": after, "bonus_balance": bonus_after, "delta": amount, "source": "admin_user_reward", "note": note})
    await _phase2_emit_user(user_doc["id"], "notification.created", notification)
    await db.admin_logs.insert_one({"id": str(uuid.uuid4()), "admin_id": admin["id"], "action": "user.reward.credit", "target_id": user_doc["id"], "created_at": now_utc().isoformat()})
    return {"ok": True, "user_id": user_doc["id"], "email": user_doc.get("email"), "before_balance": before, "after_balance": after, "transaction": tx}

# ---------------- Notification helpers ----------------
@api.get("/user/notifications/unread-count")
async def unread_count(user: dict = Depends(get_current_user)):
    c = await db.notifications.count_documents({"user_id": {"$in": [user["id"], "all"]}, "read": False})
    return {"count": c}

@api.post("/user/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": {"$in": [user["id"], "all"]}}, {"$set": {"read": True}})
    return {"ok": True}

async def _migrate_registration_code_signup_rewards() -> None:
    """Backfill admin-created registration code rewards for users created before this fix."""
    async for user_doc in db.users.find({"role": "user", "registration_code_id": {"$exists": True, "$ne": None}}):
        code_id = user_doc.get("registration_code_id")
        already = await db.transactions.find_one({
            "user_id": user_doc.get("id"),
            "type": "registration_code_reward",
            "reference_id": code_id,
        })
        if already:
            continue
        reg_code = await db.registration_codes.find_one({"id": code_id}, {"_id": 0})
        if not reg_code:
            continue
        amount = round(max(0.0, float(reg_code.get("reward_amount", 0.0))), 2)
        if amount <= 0:
            continue
        coin = (reg_code.get("reward_coin") or user_doc.get("coin_symbol") or "USDT").upper()
        before = float(user_doc.get("balance", 0))
        after = round(before + amount, 2)
        bonus_after = round(float(user_doc.get("bonus_balance", 0)) + amount, 2)
        await db.users.update_one(
            {"id": user_doc["id"]},
            {"$set": {"balance": after, "bonus_balance": bonus_after, "coin_symbol": coin, "registration_code_reward_migrated_at": now_utc().isoformat()}},
        )
        await record_tx(
            user_id=user_doc["id"],
            type_="registration_code_reward",
            amount=amount,
            coin=coin,
            before_balance=before,
            after_balance=after,
            admin_id=reg_code.get("created_by"),
            reference_id=code_id,
            note=reg_code.get("note") or f"Registration code reward for {reg_code.get('code', user_doc.get('registration_code', 'invite code'))}",
        )
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_doc["id"],
            "title": "Signup Reward Credited",
            "body": f"{amount:g} {coin} from your registration code has been added to your wallet.",
            "category": "rewards",
            "read": False,
            "created_at": now_utc().isoformat(),
        })

app.include_router(api)

# ====================================================================
# PHASE 2 EXTENSIONS — Categorized balances, Task Engine v2,
# Plan Spin Wheel, Achievements, Leaderboard, WebSocket
# ====================================================================
from extensions import build_router as _build_phase2  # noqa: E402

_phase2_router, _seed_phase2, _ws_manager = _build_phase2(
    db=db,
    get_current_user=get_current_user,
    admin_required=admin_required,
    record_tx=record_tx,
    JWT_SECRET=JWT_SECRET,
    JWT_ALGO=JWT_ALGO,
)

app.include_router(_phase2_router, prefix="/api")


@app.on_event("startup")
async def _phase2_start():
    async def _phase2_tasks():
        await _seed_phase2()
        await _migrate_registration_code_signup_rewards()

    if await run_startup_task("Phase 2 database seed", _phase2_tasks):
        logger.info("Eregon Marketing Phase 2 ready (tasks, deterministic plan spins, ws)")
    else:
        logger.warning("Eregon Marketing Phase 2 started without database seed; MongoDB may be unavailable")

# ====================================================================
# ENTERPRISE SAFE GROWTH EXTENSIONS — transparent rules, real social proof,
# analytics, anti-fraud, messaging integrations, configurable settings
# ====================================================================
from enterprise_extensions import build_enterprise_router as _build_enterprise  # noqa: E402

_enterprise_router, _seed_enterprise = _build_enterprise(
    db=db,
    get_current_user=get_current_user,
    admin_required=admin_required,
    record_tx=record_tx,
    ws_manager=_ws_manager,
)
app.include_router(_enterprise_router, prefix="/api")


@app.on_event("startup")
async def _enterprise_start():
    if await run_startup_task("Enterprise database seed", _seed_enterprise):
        logger.info("Eregon Marketing Enterprise safe growth controls ready")
    else:
        logger.warning("Eregon Marketing Enterprise started without database seed; MongoDB may be unavailable")


STATIC_DIR = ROOT_DIR / "static"


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    if not STATIC_DIR.exists():
        raise HTTPException(status_code=404, detail="Frontend build not found")

    requested = (STATIC_DIR / full_path).resolve()
    static_root = STATIC_DIR.resolve()
    if full_path and requested.is_file() and requested.is_relative_to(static_root):
        return FileResponse(requested)

    return FileResponse(STATIC_DIR / "index.html")
