import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Crown, ShieldCheck, Sparkles } from "lucide-react";
import PublicNav from "../components/PublicNav";
import Footer from "../components/Footer";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

function formatMoney(value) {
    return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatHours(hours) {
    const value = Number(hours || 0);
    if (value >= 24 && value % 24 === 0) return `${value / 24}d review`;
    return `${value}h review`;
}

function planPerks(plan) {
    const signals = Number(plan.signals_per_day || 0);
    const base = [
        `${signals} daily option trade signal${signals === 1 ? "" : "s"}`,
        "9% daily plan-owner reward",
        "12% deposit bonus eligibility",
        formatHours(plan.priority_withdrawal_hours),
        `${plan.duration_days || 30} days membership`,
    ];
    const merged = [...base, ...(plan.perks || [])];
    const seen = new Set();
    return merged.filter((perk) => {
        const key = String(perk).toLowerCase().replace(/\s+/g, " ").trim();
        if (!key || seen.has(key) || key.includes("spin") || key.includes("wheel")) return false;
        seen.add(key);
        return true;
    });
}

export default function Plans() {
    const { user } = useAuth();
    const [packages, setPackages] = useState([]);

    useEffect(() => { api.get("/public/packages").then(r => setPackages(r.data)).catch(() => {}); }, []);
    const sortedPackages = useMemo(() => [...packages].sort((a, b) => Number(a.investment || 0) - Number(b.investment || 0)), [packages]);

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <PublicNav />
            <section className="relative max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
                <div className="absolute inset-0 eregon-radial pointer-events-none"></div>
                <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5 mb-8">
                    <div className="max-w-3xl">
                        <p className="text-xs uppercase tracking-widest text-amber-400/80 mb-3">Eregon Membership</p>
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-semibold leading-tight">Choose a plan that gives you <span className="gradient-text-gold">real daily value</span></h1>
                        <p className="text-zinc-400 mt-4 max-w-2xl">Each tier bundles option trade signals, plan-owner rewards, deposit boosts, referral perks, task boosts, and faster withdrawal review.</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
                        <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2"><p className="text-emerald-200 font-semibold">Signals</p><p className="text-zinc-400">daily</p></div>
                        <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2"><p className="text-amber-200 font-semibold">9%</p><p className="text-zinc-400">daily</p></div>
                        <div className="rounded-xl border border-purple-400/20 bg-purple-500/10 px-3 py-2"><p className="text-purple-200 font-semibold">12%</p><p className="text-zinc-400">bonus</p></div>
                    </div>
                </div>
                <div className="relative grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
                    {sortedPackages.map((p, idx) => {
                        const isFeatured = idx === sortedPackages.length - 1;
                        const signals = Number(p.signals_per_day || 0);
                        const perks = planPerks(p);
                        const visiblePerks = perks.slice(0, isFeatured ? 10 : 8);
                        const joinPath = user
                            ? `/dashboard/deposit?package_id=${encodeURIComponent(p.id)}&amount=${encodeURIComponent(p.investment || 0)}`
                            : "/register";
                        return (
                            <article key={p.id} data-testid={`plan-card-${p.tier}`}
                                className={`glass-strong p-5 relative overflow-hidden flex flex-col min-h-full ${isFeatured ? "border-amber-500/45 shadow-[0_0_40px_rgba(251,191,36,.22)]" : ""}`}>
                                <div className={`absolute top-0 left-0 right-0 h-px ${isFeatured ? "bg-amber-400/70" : "bg-purple-500/35"}`}></div>
                                <div className="flex items-center justify-between gap-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        {isFeatured ? <Crown className="w-4 h-4 text-amber-300" /> : <Sparkles className="w-4 h-4 text-purple-300" />}
                                        <p className="text-xs uppercase tracking-widest text-zinc-500">{p.tier}</p>
                                    </div>
                                    {isFeatured && <span className="text-[10px] rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">Best bundle</span>}
                                </div>
                                <h3 className={`text-3xl font-display font-semibold ${isFeatured ? "gradient-text-gold" : "text-white"}`}>{formatMoney(p.investment)}</h3>
                                <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
                                    <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1.5 text-emerald-200">{signals} signals/day</span>
                                    <span className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-1.5 text-amber-200">9% daily</span>
                                    <span className="rounded-lg border border-purple-400/20 bg-purple-500/10 px-2 py-1.5 text-purple-200">Task +{Number(p.task_boost_pct || 0)}%</span>
                                    <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-zinc-300">{formatHours(p.priority_withdrawal_hours)}</span>
                                </div>
                                <div className="my-4 h-px bg-white/5"></div>
                                <p className="text-[11px] uppercase tracking-widest text-zinc-500 mb-3">Included bundle</p>
                                <ul className="space-y-2 text-sm text-zinc-300 flex-1">
                                    {visiblePerks.map((perk, i) => (
                                        <li key={i} className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" /> <span>{perk}</span></li>
                                    ))}
                                    {perks.length > visiblePerks.length && <li className="text-xs text-zinc-500 pl-6">+{perks.length - visiblePerks.length} more included perks</li>}
                                </ul>
                                <Link to={joinPath} className={`${isFeatured ? "btn-gold" : "btn-eregon"} w-full mt-5 text-sm py-2.5`}>
                                    Join {p.tier} <ArrowRight className="w-4 h-4" />
                                </Link>
                            </article>
                        );
                    })}
                </div>
                <div className="relative mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 text-emerald-300 mt-0.5" />
                        <div>
                            <p className="font-display text-lg">All plans activate after deposit approval</p>
                            <p className="text-sm text-zinc-400 mt-1">Your selected plan is linked directly to the deposit page when you are logged in.</p>
                        </div>
                    </div>
                    <Link to={user ? "/dashboard/active-plan" : "/register"} className="btn-ghost shrink-0">{user ? "Manage Active Plan" : "Create account"}</Link>
                </div>
            </section>
            <Footer />
        </div>
    );
}
