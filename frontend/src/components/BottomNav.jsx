import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, History, Users } from "lucide-react";

const items = [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/dashboard/transactions", label: "Ledger", icon: History },
    { to: "/dashboard/deposit", label: "Deposit", icon: ArrowDownToLine },
    { to: "/dashboard/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
    { to: "/dashboard/referral", label: "Team", icon: Users },
];

export default function BottomNav() {
    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50" data-testid="mobile-bottom-nav">
            <div className="mx-3 mb-3 backdrop-blur-2xl bg-black/70 border border-white/10 rounded-2xl shadow-[0_0_40px_rgba(147,51,234,0.25)]">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                    {items.map(({ to, label, icon: Icon, end }) => (
                        <NavLink key={to} to={to} end={end}
                            data-testid={`bottom-nav-${label.toLowerCase()}`}
                            className={({ isActive }) =>
                                `flex flex-col items-center gap-1 py-3 transition-all ${isActive ? "text-amber-300" : "text-zinc-400"}`}>
                            {({ isActive }) => (
                                <>
                                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isActive ? "gradient-gold neon-gold" : "bg-white/5"}`}>
                                        <Icon className={`w-4 h-4 ${isActive ? "text-black" : ""}`} strokeWidth={1.6} />
                                    </span>
                                    <span className="text-[10px] uppercase tracking-widest">{label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </div>
        </nav>
    );
}
