import React from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import { Crown, LayoutDashboard, Users, Package, Wallet, ArrowUpFromLine, ArrowDownToLine, Megaphone, LogOut, ShieldCheck, History, MessageSquare, Activity, Zap, Radio, Target, Trophy, TicketCheck, SlidersHorizontal, ImageUp } from "lucide-react";
import { useAuth } from "../lib/auth";

const items = [
    { to: "/admin", label: "Overview", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/transactions", label: "Ledger", icon: History },
    { to: "/admin/tickets", label: "Tickets", icon: MessageSquare },
    { to: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpFromLine },
    { to: "/admin/deposits", label: "Deposits", icon: ArrowDownToLine },
    { to: "/admin/bulk", label: "Bulk Tools", icon: Zap },
    { to: "/admin/growth", label: "Growth", icon: Trophy },
    { to: "/admin/registration-codes", label: "Reg Codes", icon: TicketCheck },
    { to: "/admin/enterprise", label: "Enterprise", icon: SlidersHorizontal },
    { to: "/admin/tasks-v2", label: "Tasks", icon: Target },
    { to: "/admin/task-submissions", label: "Proof Review", icon: ImageUp },
    { to: "/admin/vip-levels", label: "VIP Levels", icon: Crown },
    { to: "/admin/feed", label: "Live Feed", icon: Radio },
    { to: "/admin/activity", label: "Activity", icon: Activity },
    { to: "/admin/packages", label: "Packages", icon: Package },
    { to: "/admin/wallets", label: "Wallets", icon: Wallet },
    { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
];

export default function AdminLayout({ children }) {
    const { user, logout } = useAuth();
    const nav = useNavigate();
    const handleLogout = async () => { await logout(); nav("/login"); };

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <div className="fixed inset-0 royal-radial pointer-events-none"></div>
            <div className="relative flex">
                <aside className="hidden lg:flex flex-col w-64 min-h-screen border-r border-amber-500/10 bg-black/40 backdrop-blur-xl" data-testid="admin-sidebar">
                    <Link to="/" className="flex items-center gap-2 px-6 py-6 border-b border-white/5">
                        <span className="w-9 h-9 rounded-xl gradient-gold flex items-center justify-center neon-gold">
                            <ShieldCheck className="w-5 h-5 text-black" strokeWidth={1.8} />
                        </span>
                        <span className="font-display text-lg font-semibold">Royal<span className="gradient-text-gold">Admin</span></span>
                    </Link>
                    <nav className="flex-1 px-3 py-4 space-y-1">
                        {items.map(({ to, label, icon: Icon }) => (
                            <NavLink key={to} to={to} end
                                data-testid={`admin-link-${label.toLowerCase()}`}
                                className={({ isActive }) =>
                                    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all ${isActive ? "bg-amber-500/10 text-amber-200 border border-amber-500/30 shadow-[0_0_18px_rgba(251,191,36,0.2)]" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}>
                                <Icon className="w-4 h-4" strokeWidth={1.6} /> {label}
                            </NavLink>
                        ))}
                    </nav>
                    <div className="p-4 border-t border-white/5">
                        <div className="glass p-3 mb-3 border-amber-500/20">
                            <p className="text-xs text-amber-400/70">Admin Console</p>
                            <p className="text-sm truncate">{user?.email}</p>
                        </div>
                        <button onClick={handleLogout} className="btn-ghost w-full text-sm py-2"><LogOut className="w-4 h-4" /> Logout</button>
                    </div>
                </aside>

                <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-black/70 backdrop-blur-xl border-b border-amber-500/10 px-4 py-3 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
                            <Crown className="w-4 h-4 text-black" />
                        </span>
                        <span className="font-display font-semibold">Royal<span className="gradient-text-gold">Admin</span></span>
                    </Link>
                    <button onClick={handleLogout} className="text-zinc-400"><LogOut className="w-5 h-5" /></button>
                </div>

                <main className="flex-1 min-h-screen pt-16 lg:pt-0">
                    <div className="lg:hidden overflow-x-auto border-b border-white/5 bg-black/40">
                        <div className="flex gap-2 px-4 py-3 min-w-max">
                            {items.map(({ to, label, icon: Icon }) => (
                                <NavLink key={to} to={to} end className={({ isActive }) =>
                                    `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap ${isActive ? "bg-amber-500/20 text-amber-200" : "text-zinc-400 bg-white/5"}`}>
                                    <Icon className="w-3.5 h-3.5" /> {label}
                                </NavLink>
                            ))}
                        </div>
                    </div>
                    <div className="px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">{children}</div>
                </main>
            </div>
        </div>
    );
}
