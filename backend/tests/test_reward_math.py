from reward_math import build_deterministic_spin_rewards, normalize_plan_spin_fields


def test_deterministic_plan_spin_rewards_total_one_percent():
    queue = build_deterministic_spin_rewards(2000, 10)
    assert len(queue) == 10
    assert round(sum(queue), 2) == 20.00
    assert all(value > 0 for value in queue)


def test_low_value_plan_never_creates_zero_value_spins():
    queue = build_deterministic_spin_rewards(10, 50)
    assert len(queue) == 10
    assert round(sum(queue), 2) == 0.10
    assert all(value == 0.01 for value in queue)


def test_normalize_plan_ignores_frontend_reward_values_and_sets_daily_zero():
    plan = {"investment": 500, "spin_tokens": 5, "spin_reward_queue": [100, 100, 100]}
    normalized = normalize_plan_spin_fields(plan)
    assert normalized["daily_profit_pct"] == 0.0
    assert normalized["spin_tokens"] == 5
    assert round(sum(normalized["spin_reward_queue"]), 2) == 5.00
    assert normalized["plan_spin_reward_total"] == 5.00
    assert normalized["plan_spin_reward_pct"] == 1.0
