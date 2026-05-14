import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowDownToLine, ArrowUpFromLine, Gift, Users } from "lucide-react";

const items = [
    { to: "/dashboard", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/dashboard/rewards", label: "Rewards", icon: Gift },
    { to: "/dashboard/deposit", label: "Deposit", icon: ArrowDownToLine },
    { to: "/dashboard/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
    { to: "/dashboard/referral", label: "Team", icon: Users },
];

export default function BottomNav() {
    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]" data-testid="mobile-bottom-nav">
            <div className="mx-2 mb-2 backdrop-blur-2xl bg-black/85 border border-white/10 rounded-2xl shadow-[0_0_30px_rgba(147,51,234,0.20)] overflow-hidden">
                <div className="grid grid-cols-5">
                    {items.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            data-testid={`bottom-nav-${label.toLowerCase()}`}
                            className={({ isActive }) =>
                                `flex flex-col items-center justify-center gap-1 py-2.5 min-w-0 transition-all ${
                                    isActive ? "text-amber-300 bg-white/[0.04]" : "text-zinc-500"
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isActive ? "gradient-gold neon-gold" : "bg-white/5"}`}>
                                        <Icon className={`w-4 h-4 ${isActive ? "text-black" : ""}`} strokeWidth={1.6} />
                                    </span>
                                    <span className="text-[9px] uppercase tracking-wide truncate max-w-full px-1">{label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </div>
        </nav>
    );
}
