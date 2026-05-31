import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { StatCard, Badge } from "../components/ui-eregon";
import { Users, Wallet, ArrowUpFromLine, ArrowDownToLine, TrendingUp, Crown } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { api } from "../lib/api";

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        api.get("/admin/stats").then((r) => setStats(r.data));
    }, []);

    if (!stats) {
        return (
            <AdminLayout>
                <div className="text-zinc-400">Loading...</div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="mobile-safe">
                <p className="text-[11px] sm:text-xs uppercase tracking-widest text-amber-400/80">Eregon Admin</p>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-semibold mt-1">Console Overview</h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 mt-6 sm:mt-8">
                <StatCard testId="admin-stat-users" label="Total Users" value={stats.total_users} sub={`${stats.active_users} active`} icon={Users} accent="purple" />
                <StatCard testId="admin-stat-balance" label="Sum of Balances" value={`$${Number(stats.total_balance).toLocaleString()}`} icon={Wallet} accent="gold" />
                <StatCard testId="admin-stat-wpending" label="Pending Withdrawals" value={stats.pending_withdrawals} icon={ArrowUpFromLine} accent="rose" />
                <StatCard testId="admin-stat-dpending" label="Pending Deposits" value={stats.pending_deposits} icon={ArrowDownToLine} accent="emerald" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mt-5 sm:mt-6">
                <div className="lg:col-span-2 glass-strong p-4 sm:p-6 overflow-hidden">
                    <p className="text-[11px] sm:text-xs uppercase tracking-widest text-zinc-500">Last 7 days flow</p>
                    <h3 className="font-display text-base sm:text-lg">Deposits & Withdrawals</h3>
                    <div className="h-56 sm:h-64 mt-3 min-w-0">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.chart} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickMargin={8} />
                                <YAxis stroke="#71717a" fontSize={10} width={34} />
                                <Tooltip contentStyle={{ background: "rgba(15,15,19,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 12 }} />
                                <Line type="monotone" dataKey="deposits" stroke="#10B981" strokeWidth={2} dot={false} />
                                <Line type="monotone" dataKey="withdrawals" stroke="#FBBF24" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-strong p-4 sm:p-6 mobile-safe">
                    <p className="text-[11px] sm:text-xs uppercase tracking-widest text-zinc-500">Daily Profit Sum</p>
                    <div className="flex items-center gap-3 mt-3">
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300 shrink-0" />
                        <h3 className="text-xl sm:text-2xl font-display font-semibold gradient-text-gold">${Number(stats.total_daily_profit).toLocaleString()}</h3>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">Curated across all user accounts</p>
                    <div className="mt-5 bg-black/40 border border-white/5 rounded-xl p-4 flex items-center gap-3 min-w-0">
                        <Crown className="w-6 h-6 text-amber-300 text-glow-gold shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs text-zinc-500 uppercase tracking-widest">Packages</p>
                            <p className="font-display text-base sm:text-lg truncate">{stats.total_packages} active tiers</p>
                        </div>
                    </div>
                    <Badge color="gold" className="mt-4">All values manually controlled</Badge>
                </div>
            </div>
        </AdminLayout>
    );
}
