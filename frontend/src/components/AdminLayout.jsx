import React, { useState } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import { Crown, LayoutDashboard, Users, Package, Wallet, ArrowUpFromLine, ArrowDownToLine, Megaphone, LogOut, ShieldCheck, History, MessageSquare, Activity, Zap, Radio, Target, Trophy, TicketCheck, SlidersHorizontal, ImageUp, Menu, X } from "lucide-react";
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
    const [open, setOpen] = useState(false);
    const handleLogout = async () => { await logout(); nav("/login"); };

    const SidebarContent = ({ mobile = false }) => (
        <>
            <Link to="/" onClick={() => mobile && setOpen(false)} className="flex items-center gap-2 px-5 sm:px-6 py-5 sm:py-6 border-b border-white/5">
                <span className="w-9 h-9 rounded-xl gradient-gold flex items-center justify-center neon-gold shrink-0">
                    <ShieldCheck className="w-5 h-5 text-black" strokeWidth={1.8} />
                </span>
                <span className="font-display text-lg font-semibold truncate">Royal<span className="gradient-text-gold">Admin</span></span>
            </Link>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {items.map(({ to, label, icon: Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end
                        onClick={() => mobile && setOpen(false)}
                        data-testid={`admin-link-${label.toLowerCase()}`}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all min-w-0 ${isActive ? "bg-amber-500/10 text-amber-200 border border-amber-500/30 shadow-[0_0_18px_rgba(251,191,36,0.2)]" : "text-zinc-400 hover:text-white hover:bg-white/5"}`}
                    >
                        <Icon className="w-4 h-4 shrink-0" strokeWidth={1.6} />
                        <span className="truncate">{label}</span>
                    </NavLink>
                ))}
            </nav>
            <div className="p-4 border-t border-white/5">
                <div className="glass p-3 mb-3 border-amber-500/20 min-w-0">
                    <p className="text-xs text-amber-400/70">Admin Console</p>
                    <p className="text-sm truncate">{user?.email}</p>
                </div>
                <button onClick={handleLogout} className="btn-ghost w-full text-sm py-2"><LogOut className="w-4 h-4" /> Logout</button>
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
            <div className="fixed inset-0 royal-radial pointer-events-none"></div>

            <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-30 flex-col w-64 border-r border-amber-500/10 bg-black/40 backdrop-blur-xl" data-testid="admin-sidebar">
                <SidebarContent />
            </aside>

            <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur-xl border-b border-amber-500/10 px-4 py-3 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2 min-w-0">
                    <span className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center shrink-0">
                        <Crown className="w-4 h-4 text-black" />
                    </span>
                    <span className="font-display font-semibold truncate">Royal<span className="gradient-text-gold">Admin</span></span>
                </Link>
                <button onClick={() => setOpen(true)} className="w-10 h-10 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-zinc-200" aria-label="Open admin menu">
                    <Menu className="w-5 h-5" />
                </button>
            </header>

            {open && (
                <div className="lg:hidden fixed inset-0 z-50">
                    <button className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} aria-label="Close admin menu" />
                    <aside className="absolute left-0 top-0 bottom-0 w-[86vw] max-w-[340px] bg-[#08080a]/95 border-r border-amber-500/15 backdrop-blur-xl flex flex-col shadow-2xl">
                        <button onClick={() => setOpen(false)} className="absolute top-3 right-3 w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-zinc-300" aria-label="Close admin menu">
                            <X className="w-4 h-4" />
                        </button>
                        <SidebarContent mobile />
                    </aside>
                </div>
            )}

            <main className="relative min-h-screen pt-16 lg:pt-0 lg:ml-64">
                <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 max-w-7xl mx-auto min-w-0">
                    {children}
                </div>
            </main>
        </div>
    );
}
