from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------- Config ----------------
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = "HS256"
ACCESS_TTL_MIN = 60 * 24

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("royalmarketing")

app = FastAPI(title="RoyalMarketing API")

# ================== CORS FIX (Critical for Vercel) ==================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://oregon-demo-gray.vercel.app",     # Your current deployment
        "https://oregon-demo.vercel.app",
        "*"                                        # Remove in production for security
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

# ... [Rest of your code remains the same until the end] ...

# Keep everything else exactly as you had it (I only changed CORS + added better logging)

@app.on_event("startup")
async def on_start():
    await seed()
    logger.info("✅ RoyalMarketing API started successfully")

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

@api.get("/")
async def health():
    return {"status": "ok", "service": "RoyalMarketing"}

# Include your extensions (unchanged)
from extensions import build_router as _build_phase2
_phase2_router, _seed_phase2, _ws_manager = _build_phase2(
    db=db, get_current_user=get_current_user, admin_required=admin_required,
    record_tx=record_tx, JWT_SECRET=JWT_SECRET, JWT_ALGO=JWT_ALGO
)
app.include_router(_phase2_router, prefix="/api")

from enterprise_extensions import build_enterprise_router as _build_enterprise
_enterprise_router, _seed_enterprise = _build_enterprise(
    db=db, get_current_user=get_current_user, admin_required=admin_required,
    record_tx=record_tx, ws_manager=_ws_manager
)
app.include_router(_enterprise_router, prefix="/api")