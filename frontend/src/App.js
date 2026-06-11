import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { RealtimeProvider } from "@/lib/realtime";
import { Toaster } from "sonner";

import Home from "@/pages/Home";
import About from "@/pages/About";
import Plans from "@/pages/Plans";
import Support from "@/pages/Support";
import { Terms, Privacy } from "@/pages/Legal";
import Login, { Register, Forgot } from "@/pages/Auth";

import Dashboard from "@/pages/Dashboard";
import Tasks from "@/pages/Tasks";
import { Deposit, Withdraw } from "@/pages/DepositWithdraw";
import { Referral, Notifications } from "@/pages/ReferralAndNotifications";
import Transactions from "@/pages/Transactions";
import Tickets from "@/pages/Tickets";
import Rewards from "@/pages/Rewards";
import Leaderboard from "@/pages/Leaderboard";
import ActivePlan from "@/pages/ActivePlan";

import AdminDashboard from "@/pages/AdminDashboard";
import AdminUsers from "@/pages/AdminUsers";
import { AdminPackages, AdminWallets, AdminWithdrawals, AdminDeposits, AdminAnnouncements } from "@/pages/AdminPages";
import { AdminFinancialLogs, AdminActivity } from "@/pages/AdminFinancial";
import { AdminTickets, AdminLiveFeed, AdminBulk } from "@/pages/AdminPhase1";
import { AdminGrowthEngine, AdminTasksV2, AdminTaskSubmissions, AdminVipLevels } from "@/pages/AdminPhase2";
import AdminRegistrationCodes from "@/pages/AdminRegistrationCodes";
import AdminEnterprise from "@/pages/AdminEnterprise";

function Protected({ children, role, adminRole }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Loading Eregon wallet...</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (role === "admin" && user.role !== "admin") return <Navigate to="/dashboard" replace />;
    if (adminRole && user.admin_role !== adminRole) return <Navigate to="/admin" replace />;
    return children;
}

function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <RealtimeProvider>
                <Toaster richColors position="top-right" theme="dark" />
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/plans" element={<Plans />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot" element={<Forgot />} />

                    <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
                    <Route path="/dashboard/active-plan" element={<Protected><ActivePlan /></Protected>} />
                    <Route path="/dashboard/tasks" element={<Protected><Tasks /></Protected>} />
                    <Route path="/dashboard/deposit" element={<Protected><Deposit /></Protected>} />
                    <Route path="/dashboard/withdraw" element={<Protected><Withdraw /></Protected>} />
                    <Route path="/dashboard/referral" element={<Protected><Referral /></Protected>} />
                    <Route path="/dashboard/notifications" element={<Protected><Notifications /></Protected>} />
                    <Route path="/dashboard/transactions" element={<Protected><Transactions /></Protected>} />
                    <Route path="/dashboard/tickets" element={<Protected><Tickets /></Protected>} />
                    <Route path="/dashboard/rewards" element={<Protected><Rewards /></Protected>} />
                    <Route path="/dashboard/leaderboard" element={<Protected><Leaderboard /></Protected>} />

                    <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
                    <Route path="/admin/users" element={<Protected role="admin"><AdminUsers /></Protected>} />
                    <Route path="/admin/packages" element={<Protected role="admin"><AdminPackages /></Protected>} />
                    <Route path="/admin/wallets" element={<Protected role="admin" adminRole="super_admin"><AdminWallets /></Protected>} />
                    <Route path="/admin/withdrawals" element={<Protected role="admin"><AdminWithdrawals /></Protected>} />
                    <Route path="/admin/deposits" element={<Protected role="admin"><AdminDeposits /></Protected>} />
                    <Route path="/admin/announcements" element={<Protected role="admin"><AdminAnnouncements /></Protected>} />
                    <Route path="/admin/transactions" element={<Protected role="admin"><AdminFinancialLogs /></Protected>} />
                    <Route path="/admin/activity" element={<Protected role="admin"><AdminActivity /></Protected>} />
                    <Route path="/admin/tickets" element={<Protected role="admin"><AdminTickets /></Protected>} />
                    <Route path="/admin/feed" element={<Protected role="admin"><AdminLiveFeed /></Protected>} />
                    <Route path="/admin/bulk" element={<Protected role="admin"><AdminBulk /></Protected>} />
                    <Route path="/admin/growth" element={<Protected role="admin"><AdminGrowthEngine /></Protected>} />
                    <Route path="/admin/registration-codes" element={<Protected role="admin"><AdminRegistrationCodes /></Protected>} />
                    <Route path="/admin/enterprise" element={<Protected role="admin"><AdminEnterprise /></Protected>} />
                    <Route path="/admin/tasks-v2" element={<Protected role="admin"><AdminTasksV2 /></Protected>} />
                    <Route path="/admin/task-submissions" element={<Protected role="admin"><AdminTaskSubmissions /></Protected>} />
                    <Route path="/admin/vip-levels" element={<Protected role="admin"><AdminVipLevels /></Protected>} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </RealtimeProvider>
            </BrowserRouter>
        </AuthProvider>
    );
}

export default App;
