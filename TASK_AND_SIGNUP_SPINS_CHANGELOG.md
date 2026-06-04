# Task and Signup Spin Updates

## User-facing rewards cleanup
- Removed the user-facing daily check-in card from the Reward Hub source UI.
- Kept the daily check-in API disabled, but removed technical wording from its error response.
- Removed stale prebuilt frontend files so old daily-check-in UI is not shipped accidentally; rebuild the frontend locally/deployment-side after installing dependencies.

## Signup / referral-code spins
- New users registering with a valid registration code now receive 2 welcome spin tokens.
- The two queued welcome spin outcomes are split randomly per user but always total exactly 13.10 USDT.
- Signup rewards are no longer credited directly to the wallet at registration; rewards are credited through the spin flow when each token is used.

## Task assignment workflow
- Admin can assign or remove users from an existing task using user ID, email, exact name, or referral code.
- Admin task creation now blocks duplicate task links.
- If an admin tries to create a task with a link that already exists, the API returns the existing task ID and the admin UI scrolls/highlights that task so users can be added there.
- User task list hides tasks once the user has submitted them, so the same task is not repeatedly available to the same user.

## Backend safety
- Added normalized task-link indexing and migration for existing task links.
- Added server-side validation for duplicate task links and target user resolution.
- Added a dedicated admin endpoint for task user add/remove operations.

## Validation
- Python backend files compile.
- Reward math tests pass.
