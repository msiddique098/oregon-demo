import React from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import { Crown, LayoutDashboard, CheckSquare, ArrowDownToLine, ArrowUpFromLine, Users, ShieldCheck, LogOut, Bell, History, MessageSquare, Trophy, Gift } from "lucide-react";
import { useAuth } from "../lib/auth";
import BottomNav from "./BottomNav";
import NotificationBell from "./NotificationBell";
import RealtimeStatus from "./RealtimeStatus";

const items = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/dashboard/transactions", label: "Ledger", icon: History },
    { to: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
    { to: "/dashboard/rewards", label: "Rewards", icon: Gift },
    { to: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy },
    { to: "/dashboard/deposit", label: "Deposit", icon: ArrowDownToLine },
    { to: "/dashboard/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
    { to: "/dashboard/referral", label: "Referral", icon: Users },
    { to: "/dashboard/tickets", label: "Support", icon: MessageSquare },
    { to: "/dashboard/notifications", label: "Notifications", icon: Bell },
];

export default function DashboardLayout({ children }) {
    const { user, logout } = useAuth();
    const nav = useNavigate();

    const handleLogout = async () => {
        await logout();
        nav("/login");
    };

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <div className="fixed inset-0 royal-radial pointer-events-none"></div>
            <div className="relative flex">
                {/* Sidebar */}
                <aside className="hidden lg:flex flex-col w-64 min-h-screen border-r border-white/5 bg-black/40 backdrop-blur-xl" data-testid="dashboard-sidebar">
                    <Link to="/" className="flex items-center gap-2 px-6 py-6 border-b border-white/5">
                        <span className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center neon-purple">
                            <Crown className="w-5 h-5 text-white" strokeWidth={1.6} />
                        </span>
                        <span className="font-display text-lg font-semibold">Oregon<span className="gradient-text-gold">Tasks</span></span>
                    </Link>
                    <nav className="flex-1 px-3 py-4 space-y-1">
                        {items.map(({ to, label, icon: Icon }) => (
                            <NavLink key={to} to={to} end
                                data-testid={`sidebar-link-${label.toLowerCase()}`}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${isActive ? "bg-purple-500/15 text-white border border-purple-500/30 shadow-[0_0_18px_rgba(147,51,234,0.25)]" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}>
                                <Icon className="w-4 h-4" strokeWidth={1.6} /> {label}
                            </NavLink>
                        ))}
                        {user?.role === "admin" && (
                            <NavLink to="/admin" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 mt-3">
                                <ShieldCheck className="w-4 h-4" strokeWidth={1.6} /> Admin Panel
                            </NavLink>
                        )}
                        <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-rose-200 hover:bg-rose-500/10 border border-rose-500/20 mt-3 w-full text-left" data-testid="sidebar-logout-link">
                            <LogOut className="w-4 h-4" strokeWidth={1.6} /> Logout
                        </button>
                    </nav>
                    <div className="p-4 border-t border-white/5">
                        <div className="glass p-3 mb-3">
                            <p className="text-xs text-zinc-500">Signed in as</p>
                            <p className="text-sm truncate">{user?.name}</p>
                            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                        </div>
                        <button onClick={handleLogout} className="btn-ghost w-full text-sm py-2" data-testid="dashboard-logout-btn">
                            <LogOut className="w-4 h-4" /> Logout
                        </button>
                    </div>
                </aside>

                {/* Mobile top bar */}
                <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg gradient-purple flex items-center justify-center">
                            <Crown className="w-4 h-4 text-white" />
                        </span>
                        <span className="font-display font-semibold">Oregon<span className="gradient-text-gold">Tasks</span></span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <RealtimeStatus />
                        <NotificationBell />
                        <button onClick={handleLogout} className="text-zinc-400"><LogOut className="w-5 h-5" /></button>
                    </div>
                </div>

                <main className="flex-1 min-h-screen pt-16 lg:pt-0 pb-24 lg:pb-0">
                    <div className="hidden lg:flex items-center justify-end gap-3 px-8 pt-6">
                        <RealtimeStatus />
                        <NotificationBell />
                    </div>
                    {/* Mobile nav scroll */}
                    <div className="lg:hidden overflow-x-auto border-b border-white/5 bg-black/40">
                        <div className="flex gap-2 px-4 py-3 min-w-max">
                            {items.map(({ to, label, icon: Icon }) => (
                                <NavLink key={to} to={to} end
                                    className={({ isActive }) =>
                                        `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${isActive ? "bg-purple-500/20 text-white" : "text-zinc-400 bg-white/5"}`}>
                                    <Icon className="w-3.5 h-3.5" /> {label}
                                </NavLink>
                            ))}
                            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap text-rose-200 bg-rose-500/10 border border-rose-500/20"><LogOut className="w-3.5 h-3.5" /> Logout</button>
                        </div>
                    </div>
                    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
            <BottomNav />
        </div>
    );
}
