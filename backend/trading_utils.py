"""Trading and market-data helpers for the Eregon exchange screens.

These functions are deliberately pure/testable. The API layer in server.py owns
MongoDB reads/writes and external HTTP calls.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Tuple

TRADING_FEE_RATE = 0.001  # 0.10% internal exchange fee

CUSTOM_COINS: List[Dict[str, Any]] = [
    {
        "id": "eregon-token",
        "symbol": "ERGN",
        "name": "Eregon Token",
        "base_price": 0.125,
        "rank": 9001,
        "theme": "gold",
    },
    {
        "id": "royal-coin",
        "symbol": "RYL",
        "name": "Royal Coin",
        "base_price": 0.72,
        "rank": 9002,
        "theme": "purple",
    },
    {
        "id": "marketing-coin",
        "symbol": "MRKT",
        "name": "Marketing Coin",
        "base_price": 0.038,
        "rank": 9003,
        "theme": "emerald",
    },
    {
        "id": "betandar-coin",
        "symbol": "BTD",
        "name": "Betandar Coin",
        "base_price": 0.19,
        "rank": 9004,
        "theme": "amber",
    },
]

FALLBACK_MAJOR_MARKETS: List[Dict[str, Any]] = [
    {"id": "bitcoin", "symbol": "btc", "name": "Bitcoin", "current_price": 65000.0, "market_cap_rank": 1, "price_change_percentage_24h": 0.0},
    {"id": "ethereum", "symbol": "eth", "name": "Ethereum", "current_price": 3500.0, "market_cap_rank": 2, "price_change_percentage_24h": 0.0},
    {"id": "tether", "symbol": "usdt", "name": "Tether", "current_price": 1.0, "market_cap_rank": 3, "price_change_percentage_24h": 0.0},
    {"id": "binancecoin", "symbol": "bnb", "name": "BNB", "current_price": 600.0, "market_cap_rank": 4, "price_change_percentage_24h": 0.0},
    {"id": "solana", "symbol": "sol", "name": "Solana", "current_price": 145.0, "market_cap_rank": 5, "price_change_percentage_24h": 0.0},
    {"id": "ripple", "symbol": "xrp", "name": "XRP", "current_price": 0.55, "market_cap_rank": 6, "price_change_percentage_24h": 0.0},
    {"id": "usd-coin", "symbol": "usdc", "name": "USDC", "current_price": 1.0, "market_cap_rank": 7, "price_change_percentage_24h": 0.0},
    {"id": "cardano", "symbol": "ada", "name": "Cardano", "current_price": 0.45, "market_cap_rank": 8, "price_change_percentage_24h": 0.0},
    {"id": "dogecoin", "symbol": "doge", "name": "Dogecoin", "current_price": 0.12, "market_cap_rank": 9, "price_change_percentage_24h": 0.0},
    {"id": "tron", "symbol": "trx", "name": "TRON", "current_price": 0.11, "market_cap_rank": 10, "price_change_percentage_24h": 0.0},
]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_symbol(symbol: str) -> str:
    return str(symbol or "").strip().upper().replace("-", "")


def split_pair(pair: str) -> Tuple[str, str]:
    raw = str(pair or "").strip().upper().replace("-", "/")
    if "/" not in raw:
        raise ValueError("Trading pair must use BASE/QUOTE format")
    base, quote = [normalize_symbol(p) for p in raw.split("/", 1)]
    if not base or not quote or base == quote:
        raise ValueError("Invalid trading pair")
    return base, quote


def _sparkline(price: float, phase: float, points: int = 28) -> List[float]:
    values = []
    for idx in range(points):
        wave = math.sin(phase + idx * 0.55) * 0.018 + math.cos(phase * 0.7 + idx * 0.23) * 0.011
        values.append(round(max(0.00000001, price * (1 + wave)), 8))
    return values


def _motion_factor(symbol: str, epoch: float, custom: bool = False) -> float:
    seed = sum((idx + 1) * ord(ch) for idx, ch in enumerate(normalize_symbol(symbol)))
    if normalize_symbol(symbol) in {"USDT", "USDC", "USD"}:
        amplitude = 0.00008
    else:
        amplitude = 0.012 if custom else 0.0018
    phase = epoch / (2.4 + (seed % 11) * 0.17) + seed * 0.013
    wave = math.sin(phase) * amplitude + math.cos(phase * 0.43) * amplitude * 0.55
    pulse = math.sin(epoch / (7.0 + (seed % 5)) + seed) * amplitude * 0.35
    return max(0.85, 1.0 + wave + pulse)


def animate_market_prices(markets: Iterable[Dict[str, Any]], epoch_seconds: float | None = None) -> List[Dict[str, Any]]:
    """Add small second-by-second movement to quoted prices without mutating input rows."""
    epoch = float(epoch_seconds if epoch_seconds is not None else datetime.now(timezone.utc).timestamp())
    animated = []
    for raw in markets:
        item = dict(raw)
        symbol = item.get("symbol") or item.get("id")
        factor = _motion_factor(symbol, epoch, bool(item.get("custom")))
        base_price = max(0.00000001, float(item.get("current_price") or 0.0))
        price = max(0.00000001, base_price * factor)
        prior_price = max(0.00000001, base_price / max(factor, 0.00000001))
        item["current_price"] = round(price, 10)
        item["market_cap"] = round(float(item.get("market_cap") or 0.0) * factor, 2)
        item["total_volume"] = round(float(item.get("total_volume") or 0.0) * (1 + abs(factor - 1) * 18), 2)
        item["price_change_percentage_24h"] = round(float(item.get("price_change_percentage_24h") or 0.0) + ((price - prior_price) / prior_price * 100), 4)
        spark = list((item.get("sparkline_in_7d") or {}).get("price") or [])
        if spark:
            spark = spark[-39:] + [round(price, 8)]
        else:
            spark = _sparkline(price, epoch / 40.0)
        item["sparkline_in_7d"] = {"price": spark}
        item["updated_at"] = utc_now_iso()
        animated.append(item)
    return animated


def build_custom_markets(epoch_seconds: float | None = None) -> List[Dict[str, Any]]:
    """Return deterministic custom coins with small time-based fluctuations."""
    epoch = float(epoch_seconds if epoch_seconds is not None else datetime.now(timezone.utc).timestamp())
    markets = []
    for idx, coin in enumerate(CUSTOM_COINS):
        phase = epoch / (210 + idx * 35) + idx * 1.618
        drift = math.sin(phase) * 0.055 + math.cos(phase / 2.0) * 0.028 + math.sin(epoch / (17 + idx * 3)) * 0.014
        price = max(0.00000001, float(coin["base_price"]) * (1 + drift))
        change = drift * 100
        volume = price * (400000 + idx * 125000)
        market_cap = price * (20_000_000 + idx * 7_500_000)
        markets.append({
            "id": coin["id"],
            "symbol": coin["symbol"].lower(),
            "name": coin["name"],
            "image": None,
            "current_price": round(price, 8),
            "market_cap": round(market_cap, 2),
            "market_cap_rank": coin["rank"],
            "total_volume": round(volume, 2),
            "price_change_percentage_24h": round(change, 4),
            "sparkline_in_7d": {"price": _sparkline(price, phase)},
            "source": "custom",
            "custom": True,
            "updated_at": utc_now_iso(),
        })
    return markets


def sanitize_market(raw: Dict[str, Any], source: str = "coingecko") -> Dict[str, Any]:
    price = float(raw.get("current_price") or 0.0)
    return {
        "id": str(raw.get("id") or raw.get("symbol") or "").strip(),
        "symbol": str(raw.get("symbol") or "").lower(),
        "name": str(raw.get("name") or raw.get("symbol") or "").strip(),
        "image": raw.get("image"),
        "current_price": round(price, 10),
        "market_cap": float(raw.get("market_cap") or 0.0),
        "market_cap_rank": raw.get("market_cap_rank"),
        "total_volume": float(raw.get("total_volume") or 0.0),
        "price_change_percentage_24h": float(raw.get("price_change_percentage_24h") or 0.0),
        "sparkline_in_7d": raw.get("sparkline_in_7d") or {"price": []},
        "source": source,
        "custom": bool(raw.get("custom", False)),
        "updated_at": utc_now_iso(),
    }


def fallback_markets(limit: int = 200) -> List[Dict[str, Any]]:
    majors = [sanitize_market(item, source="fallback") for item in FALLBACK_MAJOR_MARKETS]
    # The fallback is intentionally small and clearly marked. Live deployments should use CoinGecko.
    return (majors + build_custom_markets())[:max(1, int(limit))]


def merge_markets(live_markets: Iterable[Dict[str, Any]], include_custom: bool = True) -> List[Dict[str, Any]]:
    items = [sanitize_market(item, source=item.get("source") or "coingecko") for item in live_markets]
    if include_custom:
        items.extend(build_custom_markets())
    seen = set()
    deduped = []
    for item in items:
        sym = item.get("symbol")
        if not sym or sym in seen:
            continue
        seen.add(sym)
        deduped.append(item)
    return deduped


def market_price_map(markets: Iterable[Dict[str, Any]]) -> Dict[str, float]:
    prices = {"USDT": 1.0, "USDC": 1.0, "USD": 1.0}
    for item in markets:
        symbol = normalize_symbol(item.get("symbol"))
        price = float(item.get("current_price") or 0)
        if symbol and price > 0:
            prices[symbol] = price
    return prices


def pair_rate(base_symbol: str, quote_symbol: str, prices: Dict[str, float]) -> float:
    base = normalize_symbol(base_symbol)
    quote = normalize_symbol(quote_symbol)
    base_price = float(prices.get(base) or 0)
    quote_price = float(prices.get(quote) or 0)
    if base_price <= 0 or quote_price <= 0:
        raise ValueError("Live price is unavailable for this pair")
    return base_price / quote_price


def apply_trade_balances(
    balances: Dict[str, float],
    pair: str,
    side: str,
    amount: float,
    prices: Dict[str, float],
    fee_rate: float = TRADING_FEE_RATE,
) -> Dict[str, Any]:
    """Apply a market trade to a symbol balance map and return updated balances + fill details.

    For BUY, amount is quote-coin spend. For SELL, amount is base-coin size.
    """
    base, quote = split_pair(pair)
    side_norm = str(side or "").strip().lower()
    if side_norm not in {"buy", "sell"}:
        raise ValueError("Order side must be buy or sell")
    amount = float(amount)
    if amount <= 0:
        raise ValueError("Order amount must be greater than zero")
    rate = pair_rate(base, quote, prices)
    before = {normalize_symbol(k): round(float(v or 0), 12) for k, v in balances.items()}
    before.setdefault("USDT", 0.0)
    updated = dict(before)

    if side_norm == "buy":
        quote_spend = amount
        available_quote = float(updated.get(quote, 0.0))
        if available_quote + 1e-12 < quote_spend:
            raise ValueError(f"Insufficient {quote} balance")
        fee_quote = quote_spend * fee_rate
        base_received = (quote_spend - fee_quote) / rate
        updated[quote] = round(available_quote - quote_spend, 12)
        updated[base] = round(float(updated.get(base, 0.0)) + base_received, 12)
        fee_amount = fee_quote
        fee_coin = quote
        executed_base = base_received
        executed_quote = quote_spend
    else:
        base_size = amount
        available_base = float(updated.get(base, 0.0))
        if available_base + 1e-12 < base_size:
            raise ValueError(f"Insufficient {base} balance")
        quote_gross = base_size * rate
        fee_quote = quote_gross * fee_rate
        quote_received = quote_gross - fee_quote
        updated[base] = round(available_base - base_size, 12)
        updated[quote] = round(float(updated.get(quote, 0.0)) + quote_received, 12)
        fee_amount = fee_quote
        fee_coin = quote
        executed_base = base_size
        executed_quote = quote_received

    return {
        "before": before,
        "after": updated,
        "base_symbol": base,
        "quote_symbol": quote,
        "side": side_norm,
        "rate": round(rate, 12),
        "amount": amount,
        "executed_base": round(executed_base, 12),
        "executed_quote": round(executed_quote, 12),
        "fee_amount": round(fee_amount, 12),
        "fee_coin": fee_coin,
    }
