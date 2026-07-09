import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownToLine, ArrowRight, BadgePercent, Check, Crown, Radio, ShieldCheck, Sparkles, Zap } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge } from "../components/ui-eregon";
import { api } from "../lib/api";

function money(value) {
    return `$${Number(value || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatProcessingTime(hours) {
    const value = Number(hours || 0);
    if (value >= 24 && value % 24 === 0) return `${value / 24} ${value === 24 ? "day" : "days"}`;
    return `${value}h`;
}

function compactMoney(value) {
    return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function planPerks(plan) {
    const signals = Number(plan.signals_per_day || 0);
    const base = [
        `${signals} daily option trade signal${signals === 1 ? "" : "s"}`,
        "9% daily plan-owner reward",
        "12% deposit bonus eligibility",
        `${formatProcessingTime(plan.priority_withdrawal_hours)} withdrawal review`,
        `Task rewards +${Number(plan.task_boost_pct || 0)}%`,
        `Referral boost +${Number(plan.commission_boost_pct || 0)}%`,
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

export default function ActivePlan() {
    const navigate = useNavigate();
    const [dashboard, setDashboard] = useState(null);
    const [packages, setPackages] = useState([]);
    const [showPlans, setShowPlans] = useState(true);

    useEffect(() => {
        api.get("/user/dashboard").then((r) => setDashboard(r.data)).catch(() => setDashboard({}));
        api.get("/public/packages").then((r) => setPackages(r.data || [])).catch(() => setPackages([]));
    }, []);

    const user = dashboard?.user;
    const activePlan = dashboard?.membership;
    const hasActivePlan = Boolean(activePlan?.id || user?.membership_id) && !["free", "none", ""].includes(String(activePlan?.name || user?.membership_name || "").toLowerCase());
    const signalsPerDay = hasActivePlan ? Number(activePlan?.signals_per_day || user?.signals_per_day || 0) : 0;
    const sortedPackages = useMemo(
        () => [...packages].sort((a, b) => Number(a.investment || 0) - Number(b.investment || 0)),
        [packages]
    );
    const activeInvestment = Number(activePlan?.investment || 0);
    const subscribe = (plan) => {
        const params = new URLSearchParams({
            package_id: plan.id,
            amount: String(plan.investment || 0),
        });
        navigate(`/dashboard/deposit?${params.toString()}`);
    };

    if (!dashboard || !user) {
        return (
            <DashboardLayout>
                <CinematicLoader />
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6" data-testid="active-plan-header">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Membership status</p>
                    <h1 className="text-2xl sm:text-4xl font-display font-semibold mt-1">Active Plan</h1>
                </div>
                <div className="flex items-center gap-2">
                    <Badge color={hasActivePlan ? "gold" : "purple"}>{hasActivePlan ? activePlan?.name || user.membership_name : "No active plan"}</Badge>
                    <button type="button" onClick={() => setShowPlans((value) => !value)} className="btn-ghost text-xs py-2 px-3">
                        {showPlans ? "Hide plans" : "Subscribe now"}
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
                <section className={`lg:col-span-2 glass-strong p-6 relative overflow-hidden ${hasActivePlan ? "border-amber-500/25" : "border-purple-500/25"}`}>
                    <div className={`absolute top-0 left-0 right-0 h-px ${hasActivePlan ? "bg-amber-400/60" : "bg-purple-400/60"}`}></div>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="w-12 h-12 rounded-2xl gradient-purple flex items-center justify-center neon-purple">
                                    {hasActivePlan ? <Crown className="w-6 h-6 text-white" strokeWidth={1.6} /> : <Sparkles className="w-6 h-6 text-white" strokeWidth={1.6} />}
                                </span>
                                <div>
                                    <p className="text-xs uppercase tracking-widest text-zinc-500">Current plan</p>
                                    <h2 className="text-3xl font-display font-semibold gradient-text-gold">{hasActivePlan ? activePlan?.name || user.membership_name : "No Active Plan"}</h2>
                                </div>
                            </div>
                            <p className="text-sm text-zinc-400 mt-5 max-w-2xl">
                                {hasActivePlan
                                    ? "Your active plan controls daily option trade signals, plan-owner rewards, priority withdrawal timing, task boosts, and referral commission benefits."
                                    : "Subscribe to a plan to unlock daily option trade signals, daily plan-owner rewards, deposit boosts, faster withdrawal review, and referral/task boosts."}
                            </p>
                            {!hasActivePlan && <button type="button" onClick={() => setShowPlans(true)} className="btn-gold mt-5">Browse plans <ArrowRight className="w-4 h-4" /></button>}
                        </div>
                        <div className="grid grid-cols-2 gap-3 min-w-[220px]">
                            <div className="rounded-xl bg-black/35 border border-white/5 p-3">
                                <p className="text-xs text-zinc-500">Balance</p>
                                <p className="text-lg font-display text-emerald-300">{money(user.balance)}</p>
                            </div>
                            <div className="rounded-xl bg-black/35 border border-white/5 p-3">
                                <p className="text-xs text-zinc-500">Signals / Day</p>
                                <p className="text-lg font-display text-amber-300">{signalsPerDay}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-6">
                        <PlanStat icon={Radio} label="Daily Signals" value={`${signalsPerDay}/day`} />
                        <PlanStat icon={BadgePercent} label="Daily Reward" value={hasActivePlan ? "+9%" : "Locked"} />
                        <PlanStat icon={Zap} label="Task Boost" value={hasActivePlan ? `+${Number(activePlan?.task_boost_pct || 0)}%` : "Locked"} />
                        <PlanStat icon={ShieldCheck} label="Referral Boost" value={hasActivePlan ? `+${Number(activePlan?.commission_boost_pct || 0)}%` : "Locked"} />
                        <PlanStat icon={ArrowDownToLine} label="Withdrawal SLA" value={hasActivePlan ? formatProcessingTime(activePlan?.priority_withdrawal_hours || user.withdrawal_processing_hours || 144) : "6 days"} />
                    </div>
                </section>

                <section className="glass-strong p-6">
                    <p className="text-xs uppercase tracking-widest text-zinc-500">Plan progress</p>
                    <div className="mt-5">
                        <div className="flex justify-between text-xs text-zinc-400 mb-2">
                            <span>Task progress</span>
                            <span className="text-amber-300">{Number(user.task_progress || 0)}%</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full gradient-gold" style={{ width: `${Math.min(100, Number(user.task_progress || 0))}%` }}></div>
                        </div>
                    </div>
                    <div className="mt-5 space-y-3 text-sm text-zinc-300">
                        <InfoRow label="Tasks completed" value={user.tasks_completed || 0} />
                        <InfoRow label="Tasks pending" value={user.tasks_pending || 0} />
                        <InfoRow label="Referral rate" value={`${Number(user.commission_rate || 0)}%`} />
                        <InfoRow label="Account status" value={user.status || "active"} />
                    </div>
                </section>
            </div>

            {showPlans && <section className="mt-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Available memberships</p>
                        <h2 className="font-display text-xl font-semibold">Choose a plan bundle</h2>
                    </div>
                    {!hasActivePlan && <p className="text-sm text-zinc-400">No active plan yet. Pick any bundle below to subscribe.</p>}
                </div>
                <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-4 items-stretch">
                    {sortedPackages.map((plan) => {
                        const isCurrent = hasActivePlan && (activePlan?.id === plan.id || user.membership_id === plan.id);
                        const isLower = hasActivePlan && Number(plan.investment || 0) < activeInvestment;
                        const perks = planPerks(plan);
                        const visiblePerks = perks.slice(0, isCurrent ? 7 : 6);
                        return (
                            <article key={plan.id} className={`glass-strong p-5 relative overflow-hidden flex flex-col ${isCurrent ? "border-amber-500/45 shadow-[0_0_34px_rgba(251,191,36,.18)]" : ""}`}>
                                <div className={`absolute top-0 left-0 right-0 h-px ${isCurrent ? "bg-amber-400/70" : "bg-purple-500/30"}`}></div>
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs uppercase tracking-widest text-zinc-500">{plan.tier}</p>
                                    {isCurrent && <Badge color="gold">Active</Badge>}
                                </div>
                                <h3 className="text-2xl font-display font-semibold mt-2">{compactMoney(plan.investment)}</h3>
                                <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                                    <span className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-emerald-200">{Number(plan.signals_per_day || 0)} signals/day</span>
                                    <span className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-amber-200">9% daily</span>
                                </div>
                                <ul className="mt-4 space-y-2 text-sm text-zinc-300 flex-1">
                                    {visiblePerks.map((perk, index) => (
                                        <li key={index} className="flex items-start gap-2">
                                            <Check className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" /> <span>{perk}</span>
                                        </li>
                                    ))}
                                    {perks.length > visiblePerks.length && <li className="text-xs text-zinc-500 pl-6">+{perks.length - visiblePerks.length} more perks</li>}
                                </ul>
                                <div className="mt-5 text-xs text-zinc-500">
                                    {isCurrent ? "Currently assigned" : isLower ? "Lower tier available" : hasActivePlan ? "Available upgrade" : "Ready to subscribe"}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => subscribe(plan)}
                                    disabled={isCurrent}
                                    className={`mt-4 w-full ${isCurrent ? "btn-ghost opacity-60 cursor-not-allowed" : "btn-eregon"}`}
                                >
                                    {isCurrent ? "Active" : isLower ? "Subscribe Again" : "Subscribe"}
                                </button>
                            </article>
                        );
                    })}
                </div>
            </section>}
        </DashboardLayout>
    );
}

function PlanStat({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl bg-black/35 border border-white/5 p-4">
            <Icon className="w-4 h-4 text-purple-300 mb-3" strokeWidth={1.7} />
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-lg font-display font-semibold mt-1">{value}</p>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
            <span className="text-zinc-500">{label}</span>
            <span className="text-white">{value}</span>
        </div>
    );
}
