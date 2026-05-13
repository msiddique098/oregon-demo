import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { StatCard, Badge } from "../components/ui-royal";
import { Users, Wallet, ArrowUpFromLine, ArrowDownToLine, TrendingUp, Crown } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { api } from "../lib/api";

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    useEffect(() => { api.get("/admin/stats").then(r => setStats(r.data)); }, []);
    if (!stats) return <AdminLayout><div className="text-zinc-400">Loading...</div></AdminLayout>;

    return (
        <AdminLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Royal Admin</p>
            <h1 className="text-3xl md:text-4xl font-display font-semibold mt-1">Console Overview</h1>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
                <StatCard testId="admin-stat-users" label="Total Users" value={stats.total_users} sub={`${stats.active_users} active`} icon={Users} accent="purple" />
                <StatCard testId="admin-stat-balance" label="Sum of Balances" value={`$${Number(stats.total_balance).toLocaleString()}`} icon={Wallet} accent="gold" />
                <StatCard testId="admin-stat-wpending" label="Pending Withdrawals" value={stats.pending_withdrawals} icon={ArrowUpFromLine} accent="rose" />
                <StatCard testId="admin-stat-dpending" label="Pending Deposits" value={stats.pending_deposits} icon={ArrowDownToLine} accent="emerald" />
            </div>

            <div className="grid lg:grid-cols-3 gap-5 mt-6">
                <div className="lg:col-span-2 glass-strong p-6">
                    <p className="text-xs uppercase tracking-widest text-zinc-500">Last 7 days flow</p>
                    <h3 className="font-display text-lg">Deposits & Withdrawals</h3>
                    <div className="h-64 mt-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.chart}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                                <YAxis stroke="#71717a" fontSize={11} />
                                <Tooltip contentStyle={{ background: "rgba(15,15,19,0.9)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                                <Line type="monotone" dataKey="deposits" stroke="#10B981" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="withdrawals" stroke="#FBBF24" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-strong p-6">
                    <p className="text-xs uppercase tracking-widest text-zinc-500">Daily Profit Sum</p>
                    <div className="flex items-center gap-3 mt-3">
                        <TrendingUp className="w-6 h-6 text-emerald-300" />
                        <h3 className="text-2xl font-display font-semibold gradient-text-gold">${Number(stats.total_daily_profit).toLocaleString()}</h3>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Curated across all user accounts</p>
                    <div className="mt-5 bg-black/40 border border-white/5 rounded-xl p-4 flex items-center gap-3">
                        <Crown className="w-6 h-6 text-amber-300 text-glow-gold" />
                        <div>
                            <p className="text-xs text-zinc-500 uppercase tracking-widest">Packages</p>
                            <p className="font-display text-lg">{stats.total_packages} active tiers</p>
                        </div>
                    </div>
                    <Badge color="gold" className="mt-4">All values manually controlled</Badge>
                </div>
            </div>
        </AdminLayout>
    );
}
