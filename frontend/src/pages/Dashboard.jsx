import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, TrendingUp, Crown, CheckSquare, Users, Bell, ArrowUpRight, ArrowDownRight } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import { StatCard, Badge } from "../components/ui-royal";
import AnimatedCounter from "../components/AnimatedCounter";
import CinematicLoader from "../components/CinematicLoader";
import LiveFeed from "../components/LiveFeed";
import { ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";
import { api } from "../lib/api";
import EnterpriseWidgets, { StickyMobileCTA } from "../components/EnterpriseWidgets";

const COIN_SYMBOLS = { USDT: "$", BTC: "₿", ETH: "Ξ", BNB: "BNB " };

export default function Dashboard() {
    const [data, setData] = useState(null);

    useEffect(() => {
        api.get("/user/dashboard").then(r => setData(r.data)).catch(() => {});
    }, []);

    if (!data) return <DashboardLayout><CinematicLoader /></DashboardLayout>;

    const u = data.user;
    const coin = u.coin_symbol;
    const sym = COIN_SYMBOLS[coin] || "";

    // Simulated 14-day visual chart based on daily_profit (admin-controlled)
    const chartData = Array.from({ length: 14 }, (_, i) => ({
        d: `D${i + 1}`,
        profit: Number((u.daily_profit * (0.7 + 0.6 * Math.sin(i * 0.7))).toFixed(2)),
    }));

    return (
        <DashboardLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-3 mb-8" data-testid="dashboard-header">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Welcome back, {u.name}</p>
                    <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Royal Overview</h1>
                </div>
                <div className="flex items-center gap-3">
                    <Badge color="gold">{u.membership_name || "Free"}</Badge>
                    <Badge color={u.status === "active" ? "emerald" : "rose"}>{u.status}</Badge>
                </div>
            </div>

            {/* Top stat cards */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <Link to="/dashboard/transactions" className="dashboard-card-interactive glass-strong p-6 relative overflow-hidden shadow-[0_0_30px_rgba(251,191,36,0.20)] focus:outline-none focus:ring-2 focus:ring-amber-400/40" data-testid="stat-balance">
                    <div className="absolute top-0 left-0 right-0 h-px bg-amber-500/40"></div>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Total Balance</p>
                            <p className="text-2xl sm:text-3xl font-display font-semibold gradient-text-gold">
                                <AnimatedCounter value={u.balance} decimals={2} prefix={sym} />
                            </p>
                            <p className="text-xs text-zinc-400 mt-2">Display coin: {coin}</p>
                        </div>
                        <div className="dashboard-card-icon w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center"><Wallet className="w-5 h-5 text-white/80" /></div>
                    </div>
                </Link>
                <Link to="/dashboard/transactions" className="dashboard-card-interactive glass-strong p-6 relative overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.20)] focus:outline-none focus:ring-2 focus:ring-emerald-400/40" data-testid="stat-daily">
                    <div className="absolute top-0 left-0 right-0 h-px bg-emerald-500/40"></div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Daily Profit</p>
                    <p className="text-2xl sm:text-3xl font-display font-semibold text-emerald-300">
                        <AnimatedCounter value={u.daily_profit} decimals={2} prefix={sym} />
                    </p>
                    <p className="text-xs text-zinc-400 mt-2">Curated by RoyalMarketing Admin</p>
                </Link>
                <StatCard testId="stat-tasks" label="Tasks Done" accent="purple" icon={CheckSquare}
                    to="/dashboard/tasks"
                    value={`${u.tasks_completed}/${u.tasks_completed + u.tasks_pending}`} sub={`${u.task_progress}% royal progress`} />
                <Link to="/dashboard/referral" className="dashboard-card-interactive glass-strong p-6 relative overflow-hidden shadow-[0_0_30px_rgba(147,51,234,0.20)] focus:outline-none focus:ring-2 focus:ring-purple-400/40" data-testid="stat-referral">
                    <div className="absolute top-0 left-0 right-0 h-px bg-purple-500/40"></div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Referral Earnings</p>
                    <p className="text-2xl sm:text-3xl font-display font-semibold gradient-text-purple">
                        <AnimatedCounter value={u.referral_earnings} decimals={2} prefix={sym} />
                    </p>
                    <p className="text-xs text-zinc-400 mt-2">Commission rate {u.commission_rate}%</p>
                </Link>
            </div>

            <EnterpriseWidgets />
            <StickyMobileCTA />

            {/* Chart + Membership */}
            <div className="grid lg:grid-cols-3 gap-5 mt-6">
                <div className="lg:col-span-2 glass-strong p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-zinc-500">Profit Analytics</p>
                            <h3 className="font-display text-lg">Last 14 days</h3>
                        </div>
                        <Badge color="purple">visual</Badge>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gpurple" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#9333EA" stopOpacity={0.6} />
                                        <stop offset="95%" stopColor="#9333EA" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="d" stroke="#71717a" fontSize={11} />
                                <YAxis stroke="#71717a" fontSize={11} />
                                <Tooltip contentStyle={{ background: "rgba(15,15,19,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, backdropFilter: "blur(12px)" }} />
                                <Area type="monotone" dataKey="profit" stroke="#9333EA" fill="url(#gpurple)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-strong p-6 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-px bg-amber-400/60"></div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500">Membership</p>
                    <div className="flex items-center gap-3 mt-3">
                        <Crown className="w-7 h-7 text-amber-300 text-glow-gold" />
                        <h3 className="text-2xl font-display font-semibold gradient-text-gold">{u.membership_name || "Free"}</h3>
                    </div>
                    {data.membership ? (
                        <ul className="mt-4 space-y-2 text-sm text-zinc-300">
                            <li className="flex justify-between"><span>Daily rate</span><span className="text-amber-300">{data.membership.daily_profit_pct}%</span></li>
                            <li className="flex justify-between"><span>Commission boost</span><span>+{data.membership.commission_boost_pct}%</span></li>
                            <li className="flex justify-between"><span>Task boost</span><span>+{data.membership.task_boost_pct}%</span></li>
                            <li className="flex justify-between"><span>Withdrawal SLA</span><span>{data.membership.priority_withdrawal_hours}h</span></li>
                        </ul>
                    ) : (
                        <p className="text-sm text-zinc-400 mt-4">No active membership yet. Visit the Royal Plans to unlock elite perks.</p>
                    )}
                    <div className="mt-5 bg-black/40 border border-white/5 rounded-xl p-3">
                        <div className="flex justify-between text-xs text-zinc-400 mb-2">
                            <span>Royal Task Progress</span><span className="text-amber-300">{u.task_progress}%</span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full gradient-gold" style={{ width: `${u.task_progress}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Announcements + Recent activity */}
            <div className="grid lg:grid-cols-3 gap-5 mt-6">
                <div className="space-y-5">
                    <LiveFeed />
                    <div className="glass-strong p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <Bell className="w-4 h-4 text-purple-300" />
                            <p className="text-xs uppercase tracking-widest text-zinc-500">Announcements</p>
                        </div>
                        {data.announcements.length === 0 && <p className="text-sm text-zinc-500">No announcements yet.</p>}
                        {data.announcements.map(a => (
                            <div key={a.id} className="mb-3 last:mb-0">
                                <p className="text-sm font-semibold text-white">{a.title}</p>
                                <p className="text-xs text-zinc-400 mt-1">{a.body}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 glass-strong p-6">
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Recent Withdrawals</p>
                    {data.withdrawals.length === 0 ? (
                        <p className="text-sm text-zinc-500">No withdrawals yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {data.withdrawals.slice(0, 5).map(w => (
                                <div key={w.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-black/40 border border-white/5 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <span className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center"><ArrowUpRight className="w-4 h-4 text-rose-300" /></span>
                                        <div>
                                            <p className="text-sm font-medium">{w.amount} {w.coin}</p>
                                            <p className="text-xs text-zinc-500">{new Date(w.created_at).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <Badge color={w.status === "approved" ? "emerald" : w.status === "rejected" ? "rose" : "gold"}>{w.status}</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
