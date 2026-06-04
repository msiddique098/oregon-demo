# Plan Spin Rewards Update

Implemented changes:

- Removed user-facing daily check-in rewards.
- Disabled `POST /api/rewards/checkin` with HTTP 410 so old clients cannot claim daily rewards.
- Added deterministic plan spin reward calculation in `backend/reward_math.py`.
- Every plan/package is normalized so its queued spin rewards total exactly 1% of the plan investment.
- Added package fields: `spin_tokens`, `spin_reward_queue`, `plan_spin_reward_total`, `plan_spin_reward_pct`.
- Existing package records are migrated on startup by `_migrate_packages_to_plan_spins()`.
- New package create/update requests are normalized server-side. Admin can set the spin count, but cannot override reward totals away from 1%.
- Assigning a package to a user queues that plan’s deterministic spins once for that package.
- New users no longer receive default free spin tokens or old `[0.20, 19.00]` signup spin rewards.
- Legacy free users with the old default spin queue are cleaned during Phase 2 startup.
- Updated user/admin UI text to show plan spin rewards instead of daily rewards/profit.
- Added backend unit tests for deterministic reward math.

Validation performed in this sandbox:

- `python -m py_compile backend/reward_math.py backend/server.py backend/extensions.py backend/enterprise_extensions.py`
- `PYTHONPATH=backend pytest -q backend/tests/test_reward_math.py` → passed

Not completed in this sandbox:

- Frontend production build was not generated because `frontend/node_modules` is not included in the uploaded zip. `npm run build` fails with `craco: not found` until dependencies are installed with `yarn install` or `npm install`.


## Follow-up UI cleanup
- Removed user-facing technical/deterministic reward wording from public/user pages.
- Made Reward Hub task cards auto-fit so a small number of cards fills the available width instead of leaving a large blank area.
- Reduced unnecessary task-card reserved height and made task cards fit their content.
