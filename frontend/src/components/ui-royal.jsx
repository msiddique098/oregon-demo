import React from "react";
import { Link } from "react-router-dom";

export function Card({ className = "", interactive = false, hover = true, children, ...rest }) {
    return (
        <div className={`glass-strong p-4 sm:p-6 relative overflow-hidden ${interactive ? "dashboard-card-interactive" : hover ? "royal-card-hover" : ""} ${className}`} {...rest}>
            {children}
        </div>
    );
}

export function StatCard({ label, value, sub, accent = "purple", icon: Icon, testId, to, onClick }) {
    const accentMap = {
        purple: { bar: "bg-purple-500/40", glow: "shadow-[0_0_30px_rgba(147,51,234,0.25)]", text: "gradient-text-purple" },
        gold: { bar: "bg-amber-500/40", glow: "shadow-[0_0_30px_rgba(251,191,36,0.20)]", text: "gradient-text-gold" },
        emerald: { bar: "bg-emerald-500/40", glow: "shadow-[0_0_30px_rgba(16,185,129,0.20)]", text: "text-emerald-300" },
        rose: { bar: "bg-rose-500/40", glow: "shadow-[0_0_30px_rgba(244,63,94,0.20)]", text: "text-rose-300" },
    };
    const a = accentMap[accent] || accentMap.purple;
    const Tag = to ? Link : onClick ? "button" : "div";
    const interactive = to || onClick;
    return (
        <Tag to={to} onClick={onClick} className={`glass-strong p-4 sm:p-6 relative overflow-hidden ${a.glow} ${interactive ? "dashboard-card-interactive block w-full text-left focus:outline-none focus:ring-2 focus:ring-amber-400/40" : "royal-card-hover"}`} data-testid={testId}>
            <div className={`absolute top-0 left-0 right-0 h-px ${a.bar}`}></div>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">{label}</p>
                    <p className={`text-2xl sm:text-3xl font-display font-semibold ${a.text}`}>{value}</p>
                    {sub && <p className="text-xs text-zinc-400 mt-2">{sub}</p>}
                </div>
                {Icon && <div className="dashboard-card-icon w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><Icon className="w-5 h-5 text-white/80" strokeWidth={1.5} /></div>}
            </div>
        </Tag>
    );
}

export function Badge({ children, color = "purple", className = "" }) {
    const map = {
        purple: "bg-purple-500/10 text-purple-300 border-purple-500/20",
        gold: "bg-amber-500/10 text-amber-300 border-amber-500/20",
        zinc: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
        emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
        rose: "bg-rose-500/10 text-rose-300 border-rose-500/20",
        slate: "bg-slate-400/10 text-slate-300 border-slate-400/20",
    };
    return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${map[color] || map.purple} ${className}`}>{children}</span>;
}
