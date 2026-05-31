# Eregon Marketing Phase 2 Enterprise Upgrade

This upgrade preserves the existing React/CRACO/Tailwind/Radix frontend and FastAPI/Motor/Mongo backend while adding a scalable retention layer: categorized balances, Task Engine v2, daily check-in, spin wheel, achievements, VIP analytics, realtime notifications, WebSocket sync, and admin growth controls.

## Frontend architecture

Existing structure is retained:

```text
frontend/src
  App.js                         # route registry, protected routes, realtime provider
  lib/api.js                     # Axios JWT API client
  lib/auth.jsx                   # auth context and user state
  lib/realtime.jsx               # WebSocket client, reconnect, toast handling
  components/DashboardLayout.jsx # user shell, mobile nav, live status
  components/AdminLayout.jsx     # admin shell, new growth routes
  pages/Rewards.jsx              # daily check-in, spin, tasks v2, achievements, VIP progress
  pages/Leaderboard.jsx          # realtime-ready balance/task/referral leaderboards
  pages/AdminPhase2.jsx          # growth dashboard, tasks v2 admin, VIP levels admin
```

Design language is unchanged: black base, purple/gold gradients, glassmorphism cards, neon glow, rounded 2xl cards, mobile-first nav, sticky reward CTA, Framer Motion animations, Sonner realtime toasts, and Recharts-compatible dashboard data.

## Backend API structure

Existing `backend/server.py` remains the main app. Phase 2 is isolated in `backend/extensions.py` and mounted through:

```python
from extensions import build_router as _build_phase2
_phase2_router, _seed_phase2, _ws_manager = _build_phase2(...)
app.include_router(_phase2_router, prefix="/api")
```

This keeps Phase 1 routes stable and makes Phase 2 removable/testable as a module.

## Added API endpoints

### User

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/phase2/overview` | categorized wallet state, streaks, recent bonuses, recent ledger |
| `GET` | `/api/tasks-v2` | user-filtered task list with VIP locks and cooldown state |
| `POST` | `/api/tasks-v2/{task_id}/complete` | completes a task, grants bonus, records ledger, emits WebSocket |
| `POST` | `/api/rewards/checkin` | daily check-in, streak tracking, bonus reward, spin token |
| `POST` | `/api/rewards/spin` | lucky reward spin and jackpot record |
| `GET` | `/api/achievements` | achievement progress and unlock state |
| `GET` | `/api/leaderboard?metric=balance|tasks|referrals` | ranked leaderboard |
| `GET` | `/api/vip/levels` | VIP comparison data |
| `GET` | `/api/referrals/tree` | two-level referral tree |
| `GET` | `/api/payment-methods` | active deposit methods |
| `WS` | `/api/ws?token=<JWT>` | realtime dashboard sync |

### Admin

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/phase2/stats` | growth engine realtime metrics |
| `GET/POST/PATCH/DELETE` | `/api/admin/tasks-v2` | task engine management |
| `GET/POST` | `/api/admin/vip-levels` | VIP level management |
| `GET/POST` | `/api/admin/payment-methods` | TRC20/Binance Pay/manual payment method config |
| `GET/POST` | `/api/admin/jackpots` | jackpot/event campaign management |

## Database schema / Mongo collections

Existing collections are retained. Phase 2 adds or expands:

```text
users
  locked_balance: float
  bonus_balance: float
  current_streak: int
  longest_streak: int
  last_checkin_at: iso string|null
  spin_tokens: int
  last_spin_at: iso string|null
  achievement_count: int

tasks
  id, title, description, reward, type, vip_level, cooldown_hours, thumbnail, active, created_at

task_completions
  id, user_id, task_id, title, reward, proof, created_at

vip_levels
  id, name, level, required_balance, required_deposit, reward_multiplier,
  commission_boost_pct, badge_color, benefits, created_at

bonuses
  id, user_id, amount, source, note, created_at

balance_logs
  id, user_id, balance_type, amount, reason, reference_id, created_at

payment_methods
  id, name, type, coin, network, address, instructions, active, created_at

jackpots
  id, user_id, reward, type, created_at

jackpot_campaigns
  id, title, reward_min, reward_max, starts_at, ends_at, active, created_by, created_at

sessions
  id, user_id, device, ip, user_agent, created_at, last_seen_at

admin_logs
  id, admin_id, action, target_id, metadata, created_at

deposit_logs / withdrawal_logs
  id, deposit_id|withdrawal_id, status, note, admin_id, created_at
```

## Realtime events

The server broadcasts these event names:

```text
connected
transaction.created
balance.updated
notification.created
deposit.updated
withdrawal.updated
task.completed
task.created
task.updated
task.disabled
reward.checkin
reward.spin
feed.created
ticket.user_reply
ticket.admin_reply
user.updated
jackpot.created
```

The frontend `RealtimeProvider` updates local user balance, refreshes user state on reward events, and renders Sonner toasts without requiring manual page refresh.

## Security architecture

Implemented / preserved:

- JWT bearer auth
- bcrypt password hashing
- SlowAPI rate limiting
- admin-only dependencies
- audit-friendly transaction ledger
- admin_logs for Phase 2 admin actions
- WebSocket auth via JWT token
- role-aware WebSocket channels
- Mongo indexes for high-volume tables

Recommended next hardening before production:

- move access token from localStorage to httpOnly secure cookie for browser app
- add refresh-token rotation and session revocation
- add CSRF protection for cookie mode
- enforce strict CORS origin allowlist instead of `*`
- add KYC/AML checks before withdrawals
- add withdrawal velocity limits and fraud risk scoring
- encrypt payment proof uploads at rest
- add Sentry/OpenTelemetry logging

## Deployment guide

1. Configure backend env:

```bash
MONGO_URL=mongodb://mongo:27017
DB_NAME=eregon_marketing
JWT_SECRET=change-me
ADMIN_EMAIL=admin@eregon.online
ADMIN_PASSWORD=Admin@123
```

2. Configure frontend env:

```bash
REACT_APP_BACKEND_URL=https://api.yourdomain.com
```

3. Build and run:

```bash
docker compose up --build -d
```

4. Verify:

```bash
curl https://api.yourdomain.com/api/
curl https://api.yourdomain.com/api/public/packages
```

5. Test WebSocket:

```bash
wscat -c "wss://api.yourdomain.com/api/ws?token=<JWT>"
```

## Production optimization checklist

- Enable CDN for frontend static assets.
- Set image upload limits and compress proof thumbnails.
- Code split admin pages with `React.lazy` if bundle grows.
- Cache public packages, VIP levels, payment methods for 60 seconds.
- Add Redis pub/sub if scaling backend to multiple instances; current in-memory WebSocket manager is single-instance.
- Add Mongo compound indexes for deposit/withdrawal status dashboards.
- Put FastAPI behind Nginx/Traefik with WebSocket upgrade headers.
