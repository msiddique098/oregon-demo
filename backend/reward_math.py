"""Deterministic plan spin reward calculations.

Plans do not pay daily rewards. Instead, each plan receives a fixed number of
spin attempts and the total queued spin value is exactly 1% of the plan value.
The queue is deterministic and stored server-side so users cannot influence the
reward outcomes.
"""
from __future__ import annotations

from typing import Any, Iterable

PLAN_SPIN_REWARD_RATE = 0.01
PLAN_SPIN_REWARD_PCT = 1.0
MAX_PLAN_SPINS = 100


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if number == number and number != float("inf") and number != float("-inf") else default


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def default_spin_count(plan_value: Any) -> int:
    """Return a professional default spin count based on the plan value.

    The count is intentionally capped and conservative so even low-value plans
    can receive meaningful, non-zero deterministic spin outcomes.
    """
    value = max(0.0, _to_float(plan_value))
    if value <= 0:
        return 0
    if value < 500:
        return 2
    if value < 2_000:
        return 5
    if value < 5_000:
        return 10
    if value < 15_000:
        return 20
    return 30


def _requested_spin_count(spin_tokens: Any = None, spin_reward_queue: Iterable[Any] | None = None, plan_value: Any = 0) -> int:
    count = _to_int(spin_tokens, 0)
    if count <= 0 and spin_reward_queue is not None:
        try:
            count = len(list(spin_reward_queue))
        except TypeError:
            count = 0
    if count <= 0:
        count = default_spin_count(plan_value)
    return max(0, min(MAX_PLAN_SPINS, count))


def build_deterministic_spin_rewards(plan_value: Any, spin_count: Any = None) -> list[float]:
    """Build a deterministic positive-value reward queue totaling 1%.

    Values are split in cents, so the returned list always sums to exactly the
    rounded 1% target. If a requested spin count is too high for the plan value,
    the count is reduced so no queued spin is worth $0.00.
    """
    value = max(0.0, _to_float(plan_value))
    total_cents = int(round(value * PLAN_SPIN_REWARD_RATE * 100))
    requested_count = _to_int(spin_count, 0) or default_spin_count(value)

    if total_cents <= 0 or requested_count <= 0:
        return []

    count = max(1, min(MAX_PLAN_SPINS, requested_count, total_cents))
    base_cents = total_cents // count
    remainder = total_cents % count

    rewards = []
    for idx in range(count):
        cents = base_cents + (1 if idx < remainder else 0)
        if cents > 0:
            rewards.append(round(cents / 100, 2))
    return rewards


def normalize_plan_spin_fields(plan: dict[str, Any]) -> dict[str, Any]:
    """Return canonical spin fields for a package/plan document."""
    investment = max(0.0, _to_float(plan.get("investment")))
    requested = _requested_spin_count(
        plan.get("spin_tokens"),
        plan.get("spin_reward_queue") if isinstance(plan.get("spin_reward_queue"), list) else None,
        investment,
    )
    queue = build_deterministic_spin_rewards(investment, requested)
    total = round(sum(queue), 2)
    return {
        "spin_tokens": len(queue),
        "spin_reward_queue": queue,
        "plan_spin_reward_total": total,
        "plan_spin_reward_pct": PLAN_SPIN_REWARD_PCT,
        "daily_profit_pct": 0.0,
    }


def plan_spin_summary(plan: dict[str, Any]) -> dict[str, Any]:
    """Compact public/admin summary for a plan spin reward pool."""
    fields = normalize_plan_spin_fields(plan)
    return {
        "spin_tokens": fields["spin_tokens"],
        "total_reward": fields["plan_spin_reward_total"],
        "reward_pct": fields["plan_spin_reward_pct"],
    }
