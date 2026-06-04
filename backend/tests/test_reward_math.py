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


def test_signup_spins_are_two_randomized_rewards_totaling_13_10():
    import random
    from reward_math import build_signup_spin_rewards

    queue = build_signup_spin_rewards(rng=random.Random(42))
    assert len(queue) == 2
    assert round(sum(queue), 2) == 13.10
    assert all(value > 0 for value in queue)


def test_signup_spins_can_differ_between_users_but_total_stays_fixed():
    import random
    from reward_math import build_signup_spin_rewards

    queue_a = build_signup_spin_rewards(rng=random.Random(1))
    queue_b = build_signup_spin_rewards(rng=random.Random(2))
    assert queue_a != queue_b
    assert round(sum(queue_a), 2) == 13.10
    assert round(sum(queue_b), 2) == 13.10
