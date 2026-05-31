# Eregon Marketing Rewards - Product Requirements Document

## Original Problem Statement
Build a modern, premium full-stack marketing rewards platform with a premium Eregon Marketing UI/UX. The platform is NOT a crypto exchange - all balances, rewards, profits, commissions, withdrawals and task progress are fully controlled manually by the admin from the admin panel. No real-time crypto API, live blockchain data, or auto-generated earnings should be used.

## User Choices (Locked)
- **Auth:** JWT-based custom (email/password) + separate admin auth, seeded admin
- **Email service:** Simulated for MVP (Resend/SendGrid ready to plug in)
- **File storage:** Local data-URL for MVP, abstracted for cloud migration
- **Color palette:** Black + Gold + Eregon Purple (luxury fintech)
- **Default admin:** `admin@eregon.online` / `Admin@123`
- **Demo user:** `member@eregon.online` / `User@123`

## Architecture
- **Frontend:** React 19 + Tailwind + shadcn + Recharts + Framer Motion + Outfit/Inter fonts
- **Backend:** FastAPI + Motor (async MongoDB) + bcrypt + PyJWT + slowapi
- **DB:** MongoDB (collections: users, packages, wallets, withdrawals, deposits, announcements, notifications, transactions, activity_logs, tickets, ticket_messages, live_feed, settings, password_resets)
- **Routing:** All backend routes under `/api`; frontend uses `REACT_APP_BACKEND_URL`

## User Personas
1. **Eregon Member (user):** Earns visual rewards, completes tasks, refers friends, withdraws.
2. **Eregon Admin (super_admin):** Full control - manually edits all user metrics, manages packages, approves withdrawals, runs bulk campaigns, curates live feed.
3. **Finance Manager (RBAC role):** Read users + manage withdrawals/deposits + bulk tools (backend-ready).
4. **Support Agent (RBAC role):** Read users + full ticket access + notifications.

## Implemented (as of Feb 2026)
### MVP (Iteration 1)
- JWT auth: register/login/logout/me, forgot-password (simulated)
- Admin seed on startup + demo user
- User dashboard with balance card, profit chart (recharts), tasks, membership
- Public pages: Home, About, Plans, Support, Terms, Privacy
- 5 default packages (Basic->Elite VIP)
- Admin: users CRUD with manual edit modal, packages CRUD, wallets CRUD, withdrawal approval, deposit approval, announcements, notifications
- Wallets, deposits with proof upload (data URL), withdrawal flow, referral page

### Phase 1 Enterprise (Iteration 2)
- **Transaction Ledger:** Auto-recorded on every balance change (admin adjust, withdrawal stages, deposit approve, bulk bonus). User history page + admin financial logs with filters (user/type/coin/date) + CSV export
- **Activity Tracking:** Login events captured (IP, user-agent), `last_active`/`last_ip` on users, admin Activity page
- **Live Activity Feed:** Admin-curated entries, 6 default seed items, frontend rotating widget (3-card) + ticker variant on home, settings (auto_enabled, interval_sec)
- **Support Ticket System:** Full chat-style threads, priority labels (low/normal/high/urgent), status (open/pending/resolved/closed), file attachments (data URL), unread counters for both sides, admin reply + status/priority management
- **Withdrawal Queue Stages:** Extended from 3 -> 6 statuses (pending, reviewing, approved, processing, completed, rejected) with stage history + animated timeline component
- **Bulk Reward Tools:** Bonus distribution by target (all/tier/ids), commission % adjustment, all auto-ledgered
- **Advanced Notification Center:** Categories (rewards/withdrawals/membership/security/promotions/support/system), dropdown bell with unread counter, read-all action
- **Mobile + Motion:** Bottom navigation (5-tab) on mobile, AnimatedCounter (eased), CinematicLoader, glassmorphism polish across all surfaces
- **RBAC Foundation:** `admin_role` field + PERMISSIONS map + `require_perm()` dep (super_admin/finance/support/moderator) - wired silently, UI in Phase 2

## Prioritized Backlog (Phase 2)
### P0
- Admin role management UI (assign roles to admins)
- KYC verification module (ID + selfie upload, admin approval)
- Theme/branding customizer (logo, colors, hero text from admin)

### P1
- Gamification: user levels, daily streaks, achievement badges
- CMS: FAQ editor, editable Terms/Privacy/Hero sections, promo popups
- Multi-language: EN/UR/AR with RTL support

### P2
- Interactive referral tree visualization
- Advanced analytics dashboard (revenue simulations, membership growth charts)
- WebSocket live system for notifications/feed
- Email integration (Resend/SendGrid hooks ready)

## Key Endpoints Quick Reference
- `POST /api/auth/login` `POST /api/auth/register` `GET /api/auth/me`
- `GET /api/user/dashboard` `GET /api/user/transactions` `GET /api/user/tickets`
- `POST /api/user/withdrawals` `POST /api/user/deposits` `POST /api/user/tickets`
- `GET /api/public/packages` `GET /api/public/feed`
- `PATCH /api/admin/users/{uid}` (auto-ledgered) `POST /api/admin/bulk/bonus` `POST /api/admin/bulk/commission`
- `PATCH /api/admin/withdrawals/{wid}` (6 stages) `PATCH /api/admin/deposits/{did}`
- `GET /api/admin/transactions` `GET /api/admin/transactions.csv` `GET /api/admin/activity`
- `POST /api/admin/feed` `GET /api/admin/feed/settings`
- `GET /api/admin/tickets` `PATCH /api/admin/tickets/{tid}`

## Test Credentials
See `/app/memory/test_credentials.md` for current login credentials.

## Test Suite
`/app/backend/tests/test_eregon_marketing_api.py` - 24 backend pytest cases, all passing.

## Dates
- Iteration 1 MVP: May 2026
- Iteration 2 Phase 1 Enterprise: May 2026
