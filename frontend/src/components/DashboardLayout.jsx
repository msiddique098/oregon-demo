import React, { useState } from "react";
import { NavLink, useNavigate, Link, useLocation } from "react-router-dom";
import { Crown, LayoutDashboard, CheckSquare, ArrowDownToLine, ArrowUpFromLine, Users, ShieldCheck, LogOut, Bell, History, MessageSquare, Trophy, Gift, Menu, X } from "lucide-react";
import { useAuth } from "../lib/auth";
import BottomNav from "./BottomNav";
import NotificationBell from "./NotificationBell";
import RealtimeStatus from "./RealtimeStatus";

const items = [
    { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
    { to: "/dashboard/active-plan", label: "Active Plan", icon: Crown },
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

function currentTitle(pathname) {
    const match = [...items].sort((a, b) => b.to.length - a.to.length).find((item) => pathname === item.to || pathname.startsWith(item.to + "/"));
    return match?.label || "Dashboard";
}

export default function DashboardLayout({ children }) {
    const { user, logout } = useAuth();
    const nav = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = async () => {
        await logout();
        nav("/login");
    };

    const navLinkClass = ({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${
            isActive
                ? "bg-purple-500/15 text-white border border-purple-500/30 shadow-[0_0_18px_rgba(147,51,234,0.25)]"
                : "text-zinc-400 hover:text-white hover:bg-white/5"
        }`;

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
            <div className="fixed inset-0 eregon-radial pointer-events-none"></div>

            <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-30 flex-col w-64 border-r border-white/5 bg-black/40 backdrop-blur-xl" data-testid="dashboard-sidebar">
                <Link to="/" className="flex items-center gap-2 px-6 py-6 border-b border-white/5">
                    <span className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center neon-purple">
                        <Crown className="w-5 h-5 text-white" strokeWidth={1.6} />
                    </span>
                    <span className="font-display text-lg font-semibold">Eregon<span className="gradient-text-gold">Marketing</span></span>
                </Link>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    {items.map(({ to, label, icon: Icon }) => (
                        <NavLink key={to} to={to} end data-testid={`sidebar-link-${label.toLowerCase()}`} className={navLinkClass}>
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

            <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-black/85 backdrop-blur-2xl border-b border-white/10 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                    <button onClick={() => setMobileOpen(true)} className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center" aria-label="Open menu">
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <Link to="/" className="inline-flex items-center gap-2 max-w-full">
                            <span className="w-7 h-7 rounded-lg gradient-purple flex items-center justify-center shrink-0">
                                <Crown className="w-3.5 h-3.5 text-white" />
                            </span>
                            <span className="font-display font-semibold truncate">Eregon<span className="gradient-text-gold">Marketing</span></span>
                        </Link>
                        <p className="text-[11px] uppercase tracking-widest text-zinc-500 truncate">{currentTitle(location.pathname)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <NotificationBell />
                        <button onClick={handleLogout} className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 flex items-center justify-center" aria-label="Logout">
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {mobileOpen && (
                <div className="lg:hidden fixed inset-0 z-[70]">
                    <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} aria-label="Close menu"></button>
                    <aside className="absolute left-0 top-0 bottom-0 w-[84vw] max-w-[340px] bg-[#09090d] border-r border-white/10 shadow-2xl p-4 overflow-y-auto">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center neon-purple">
                                    <Crown className="w-5 h-5 text-white" strokeWidth={1.6} />
                                </span>
                                <div className="min-w-0">
                                    <p className="font-display font-semibold truncate">Eregon Marketing</p>
                                    <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setMobileOpen(false)} className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <nav className="space-y-1">
                            {items.map(({ to, label, icon: Icon }) => (
                                <NavLink key={to} to={to} end onClick={() => setMobileOpen(false)} className={navLinkClass}>
                                    <Icon className="w-4 h-4" strokeWidth={1.6} /> {label}
                                </NavLink>
                            ))}
                            {user?.role === "admin" && (
                                <NavLink to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 mt-3">
                                    <ShieldCheck className="w-4 h-4" strokeWidth={1.6} /> Admin Panel
                                </NavLink>
                            )}
                            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-rose-200 bg-rose-500/10 border border-rose-500/20 mt-3 w-full text-left">
                                <LogOut className="w-4 h-4" strokeWidth={1.6} /> Logout
                            </button>
                        </nav>
                    </aside>
                </div>
            )}

            <main className="relative min-h-screen pt-[72px] lg:pt-0 pb-24 lg:pb-0 lg:ml-64 min-w-0">
                <div className="hidden lg:flex items-center justify-end gap-3 px-4 sm:px-6 lg:px-8 pt-6">
                    <RealtimeStatus />
                    <NotificationBell />
                </div>
                <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto min-w-0">
                    {children}
                </div>
            </main>

            <BottomNav />
            <div className="hidden" data-dashboard-mobile-hotfix="phone-first-v2"></div>
        </div>
    );
}
