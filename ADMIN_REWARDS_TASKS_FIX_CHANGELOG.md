# Admin Rewards & Task Cleanup Update

## Fixed user Reward Hub
- Removed user-facing daily check-in copy from the active Reward Hub source.
- Kept the old `/api/rewards/checkin` endpoint as a silent no-op for old cached frontends so users do not see a red error if their browser cache still calls it.
- Removed stale daily check-in event handling from the realtime client.

## Fixed registration-code rewards
- Registration-code reward amount is now credited immediately to the new user's wallet balance.
- The signup user still receives 2 welcome spins totaling exactly 13.10 USDT.
- Added ledger entries with type `registration_code_reward` so the signup reward appears in the user's transaction history.
- Added a startup backfill migration that credits the registration-code reward to existing users who registered before this fix and did not receive the code amount.

## Task management updates
- User task list already hides any task the user has submitted or completed.
- Admin can now permanently delete a task from Task Management instead of only enabling/disabling it.
- Existing submission and transaction history remains for audit purposes.

## Manual user reward tool
- Added `/api/admin/user-rewards`.
- Admin can credit any amount to one specific user by user ID, email, exact name, or referral code.
- Admin can write a custom message explaining the reward.
- The custom message appears in the user's ledger.
- The user's wallet balance and bonus balance are updated immediately.
- User receives a reward notification.

## Validation
- Backend Python files compile successfully.
- Existing reward math tests pass.
