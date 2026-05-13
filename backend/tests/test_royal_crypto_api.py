"""
Royal Crypto Rewards - Comprehensive backend regression suite.
Covers: Auth, Transaction Ledger, Withdrawal lifecycle, Deposit approval,
Activity tracking, Support tickets, Live feed, Bulk tools, Notifications.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://crown-crypto.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- AUTH ----------
class TestAuth:
    def test_admin_login(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "admin@royalcrypto.com", "password": "Admin@123"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and data["access_token"]
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "admin@royalcrypto.com"

    def test_user_login(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "user@royalcrypto.com", "password": "User@123"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "user"

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"email": "user@royalcrypto.com", "password": "wrong"})
        assert r.status_code == 401

    def test_me_endpoint(self, user_token):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {user_token}"})
        assert r.status_code == 200
        assert r.json()["email"] == "user@royalcrypto.com"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_and_logout(self):
        email = f"test_{uuid.uuid4().hex[:8]}@royal.com"
        r = requests.post(f"{API}/auth/register",
                          json={"email": email, "password": "Pass1234!", "name": "TEST User"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user"]["email"] == email
        assert body["user"]["role"] == "user"
        assert "access_token" in body
        # logout
        lo = requests.post(f"{API}/auth/logout")
        assert lo.status_code == 200

    def test_forgot_password(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": "user@royalcrypto.com"})
        assert r.status_code == 200
        # debug_token only present if email found
        assert "ok" in r.json()


# ---------- TRANSACTION LEDGER ----------
class TestTransactionLedger:
    def test_admin_balance_adjust_creates_tx(self, admin_headers, user_id, user_headers):
        # Get current balance
        me = requests.get(f"{API}/auth/me", headers=user_headers).json()
        cur = float(me["balance"])
        new_balance = round(cur + 1.23, 2)
        r = requests.patch(f"{API}/admin/users/{user_id}",
                           headers=admin_headers, json={"balance": new_balance})
        assert r.status_code == 200, r.text
        assert abs(r.json()["balance"] - new_balance) < 0.01

        # User transactions should include this
        tx = requests.get(f"{API}/user/transactions", headers=user_headers)
        assert tx.status_code == 200
        items = tx.json()
        assert any(t["type"] in ("admin_credit", "admin_debit") and abs(t["amount"] - 1.23) < 0.01
                   for t in items[:5]), f"No matching tx in last 5: {items[:5]}"

        # Restore
        requests.patch(f"{API}/admin/users/{user_id}",
                       headers=admin_headers, json={"balance": cur})

    def test_admin_transactions_filters(self, admin_headers, user_id):
        r = requests.get(f"{API}/admin/transactions",
                         headers=admin_headers,
                         params={"user_id": user_id, "type_filter": "admin_credit"})
        assert r.status_code == 200
        for t in r.json():
            assert t["user_id"] == user_id
            assert t["type"] == "admin_credit"

    def test_csv_export(self, admin_headers):
        r = requests.get(f"{API}/admin/transactions.csv", headers=admin_headers)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "id,user_id,type,amount" in r.text


# ---------- WITHDRAWAL LIFECYCLE ----------
class TestWithdrawalLifecycle:
    def test_full_lifecycle(self, admin_headers, user_headers, user_id):
        # Ensure balance
        requests.patch(f"{API}/admin/users/{user_id}",
                       headers=admin_headers, json={"balance": 5000.0})
        before_balance = 5000.0

        # Submit withdrawal
        r = requests.post(f"{API}/user/withdrawals", headers=user_headers,
                          json={"amount": 100.0, "coin": "USDT", "address": "TestAddr1"})
        assert r.status_code == 200, r.text
        wid = r.json()["id"]
        assert r.json()["status"] == "pending"

        # Cycle: reviewing (no debit)
        r1 = requests.patch(f"{API}/admin/withdrawals/{wid}", headers=admin_headers,
                            json={"status": "reviewing"})
        assert r1.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=user_headers).json()
        assert abs(me["balance"] - before_balance) < 0.01, "Balance should NOT change on reviewing"

        # approved (should debit ONCE)
        r2 = requests.patch(f"{API}/admin/withdrawals/{wid}", headers=admin_headers,
                            json={"status": "approved"})
        assert r2.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=user_headers).json()
        assert abs(me["balance"] - (before_balance - 100.0)) < 0.01, f"Expected debit, got {me['balance']}"

        # processing (no extra debit)
        requests.patch(f"{API}/admin/withdrawals/{wid}", headers=admin_headers,
                       json={"status": "processing"})
        me2 = requests.get(f"{API}/auth/me", headers=user_headers).json()
        assert abs(me2["balance"] - (before_balance - 100.0)) < 0.01, "Balance should not change going approved->processing"

        # completed
        requests.patch(f"{API}/admin/withdrawals/{wid}", headers=admin_headers,
                       json={"status": "completed"})
        me3 = requests.get(f"{API}/auth/me", headers=user_headers).json()
        assert abs(me3["balance"] - (before_balance - 100.0)) < 0.01

        # Verify withdrawal_debit tx exists
        txs = requests.get(f"{API}/user/transactions", headers=user_headers,
                           params={"type_filter": "withdrawal_debit"}).json()
        assert any(t["reference_id"] == wid for t in txs), "withdrawal_debit tx not found"

        # Cycle stages should have all entries
        wd = [w for w in requests.get(f"{API}/admin/withdrawals", headers=admin_headers).json() if w["id"] == wid][0]
        stages = [s["stage"] for s in wd.get("stages", [])]
        for s in ["reviewing", "approved", "processing", "completed"]:
            assert s in stages, f"Missing stage {s}: {stages}"

    def test_reject_after_approve_refunds(self, admin_headers, user_headers, user_id):
        # Reset balance
        requests.patch(f"{API}/admin/users/{user_id}",
                       headers=admin_headers, json={"balance": 3000.0})
        start = 3000.0
        r = requests.post(f"{API}/user/withdrawals", headers=user_headers,
                          json={"amount": 50.0, "coin": "USDT", "address": "TestRefund"})
        wid = r.json()["id"]
        # approve -> debit
        requests.patch(f"{API}/admin/withdrawals/{wid}", headers=admin_headers,
                       json={"status": "approved"})
        me = requests.get(f"{API}/auth/me", headers=user_headers).json()
        assert abs(me["balance"] - (start - 50.0)) < 0.01
        # reject -> refund
        requests.patch(f"{API}/admin/withdrawals/{wid}", headers=admin_headers,
                       json={"status": "rejected", "admin_note": "Cancelled"})
        me2 = requests.get(f"{API}/auth/me", headers=user_headers).json()
        assert abs(me2["balance"] - start) < 0.01, "Refund did not restore balance"
        txs = requests.get(f"{API}/user/transactions", headers=user_headers,
                           params={"type_filter": "withdrawal_refund"}).json()
        assert any(t["reference_id"] == wid for t in txs)


# ---------- DEPOSITS ----------
class TestDeposits:
    def test_deposit_approval_credits(self, admin_headers, user_headers, user_id):
        # set baseline
        requests.patch(f"{API}/admin/users/{user_id}",
                       headers=admin_headers, json={"balance": 1000.0})
        # submit
        r = requests.post(f"{API}/user/deposits", headers=user_headers,
                          json={"amount": 250.0, "coin": "USDT", "tx_hash": "0xTESTDEP"})
        assert r.status_code == 200
        did = r.json()["id"]
        # approve
        r2 = requests.patch(f"{API}/admin/deposits/{did}", headers=admin_headers,
                            json={"status": "approved"})
        assert r2.status_code == 200
        me = requests.get(f"{API}/auth/me", headers=user_headers).json()
        assert abs(me["balance"] - 1250.0) < 0.01
        # tx exists
        txs = requests.get(f"{API}/user/transactions", headers=user_headers,
                           params={"type_filter": "deposit_credit"}).json()
        assert any(t["reference_id"] == did for t in txs)


# ---------- ACTIVITY TRACKING ----------
class TestActivity:
    def test_login_creates_activity(self, admin_headers, user_id):
        # Trigger login
        requests.post(f"{API}/auth/login",
                      json={"email": "user@royalcrypto.com", "password": "User@123"})
        r = requests.get(f"{API}/admin/activity", headers=admin_headers,
                         params={"user_id": user_id})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert any(it["action"] == "login" for it in items)


# ---------- SUPPORT TICKETS ----------
class TestTickets:
    def test_full_ticket_flow(self, admin_headers, user_headers):
        # create
        r = requests.post(f"{API}/user/tickets", headers=user_headers,
                          json={"subject": "TEST Help needed", "body": "First message", "priority": "high"})
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        # list (user)
        ul = requests.get(f"{API}/user/tickets", headers=user_headers)
        assert any(t["id"] == tid for t in ul.json())
        # user reply
        r2 = requests.post(f"{API}/user/tickets/{tid}/messages", headers=user_headers,
                           json={"body": "Adding more info"})
        assert r2.status_code == 200
        # admin list
        al = requests.get(f"{API}/admin/tickets", headers=admin_headers)
        assert any(t["id"] == tid for t in al.json())
        # admin reply
        r3 = requests.post(f"{API}/admin/tickets/{tid}/messages", headers=admin_headers,
                           json={"body": "Admin response here"})
        assert r3.status_code == 200
        assert r3.json()["author_role"] == "admin"
        # admin update
        r4 = requests.patch(f"{API}/admin/tickets/{tid}", headers=admin_headers,
                            json={"status": "resolved", "priority": "low"})
        assert r4.status_code == 200
        assert r4.json()["status"] == "resolved"
        assert r4.json()["priority"] == "low"
        # messages thread length
        msgs = requests.get(f"{API}/admin/tickets/{tid}/messages", headers=admin_headers).json()
        assert len(msgs) >= 3


# ---------- LIVE FEED ----------
class TestLiveFeed:
    def test_public_feed(self):
        r = requests.get(f"{API}/public/feed")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_create_and_delete(self, admin_headers):
        r = requests.post(f"{API}/admin/feed", headers=admin_headers,
                          json={"message": "TEST feed item", "icon": "sparkles"})
        assert r.status_code == 200
        fid = r.json()["id"]
        # appears in public
        items = requests.get(f"{API}/public/feed").json()
        assert any(it["id"] == fid for it in items)
        # delete
        d = requests.delete(f"{API}/admin/feed/{fid}", headers=admin_headers)
        assert d.status_code == 200

    def test_feed_settings(self, admin_headers):
        r = requests.get(f"{API}/admin/feed/settings", headers=admin_headers)
        assert r.status_code == 200
        s = requests.post(f"{API}/admin/feed/settings", headers=admin_headers,
                          json={"auto_enabled": True, "interval_sec": 10})
        assert s.status_code == 200
        assert s.json()["interval_sec"] == 10


# ---------- BULK TOOLS ----------
class TestBulkTools:
    def test_bulk_bonus_all(self, admin_headers, user_headers):
        me_before = requests.get(f"{API}/auth/me", headers=user_headers).json()
        bal_before = float(me_before["balance"])
        r = requests.post(f"{API}/admin/bulk/bonus", headers=admin_headers,
                          json={"target": "all", "amount": 7.77, "note": "TEST bulk"})
        assert r.status_code == 200, r.text
        assert r.json()["ok"] is True
        assert r.json()["affected"] >= 1
        me_after = requests.get(f"{API}/auth/me", headers=user_headers).json()
        assert abs(float(me_after["balance"]) - (bal_before + 7.77)) < 0.01
        # tx record
        txs = requests.get(f"{API}/user/transactions", headers=user_headers,
                           params={"type_filter": "bulk_bonus"}).json()
        assert len(txs) >= 1

    def test_bulk_commission(self, admin_headers, user_headers):
        me_before = requests.get(f"{API}/auth/me", headers=user_headers).json()
        before = float(me_before["commission_rate"])
        r = requests.post(f"{API}/admin/bulk/commission", headers=admin_headers,
                          json={"target": "all", "delta_percent": 1.0})
        assert r.status_code == 200
        me_after = requests.get(f"{API}/auth/me", headers=user_headers).json()
        assert abs(float(me_after["commission_rate"]) - (before + 1.0)) < 0.01
        # rollback
        requests.post(f"{API}/admin/bulk/commission", headers=admin_headers,
                      json={"target": "all", "delta_percent": -1.0})


# ---------- NOTIFICATIONS ----------
class TestNotifications:
    def test_create_and_unread(self, admin_headers, user_headers):
        # Create with category
        r = requests.post(f"{API}/admin/notifications", headers=admin_headers,
                          json={"user_id": "all", "title": "TEST Notif",
                                "body": "hello", "category": "rewards"})
        assert r.status_code == 200, r.text
        assert r.json()["category"] == "rewards"
        # unread count
        c = requests.get(f"{API}/user/notifications/unread-count", headers=user_headers)
        assert c.status_code == 200
        assert c.json()["count"] >= 1
        # read all
        ra = requests.post(f"{API}/user/notifications/read-all", headers=user_headers)
        assert ra.status_code == 200
        c2 = requests.get(f"{API}/user/notifications/unread-count", headers=user_headers).json()
        assert c2["count"] == 0


# ---------- REGRESSION BASICS ----------
class TestRegression:
    def test_public_packages(self):
        r = requests.get(f"{API}/public/packages")
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_admin_stats(self, admin_headers):
        r = requests.get(f"{API}/admin/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        assert "total_users" in d and "chart" in d

    def test_admin_users_list(self, admin_headers):
        r = requests.get(f"{API}/admin/users", headers=admin_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
