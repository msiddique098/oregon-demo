import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, ShieldCheck, TrendingUp, Users, Zap } from "lucide-react";
import { api } from "../lib/api";

function timeLeftLabel(endsAt) {
    if (!endsAt) return "Always on";
    const diff = new Date(endsAt).getTime() - Date.now();
    if (diff <= 0) return "Ended";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m left`;
}

export default function EnterpriseWidgets() {
    const [data, setData] = useState(null);

    useEffect(() => {
        let alive = true;
        const load = async () => {
            try {
                const { data } = await api.get("/enterprise/user-engagement");
                if (alive) setData(data);
            } catch (_) {}
        };
        load();
        const id = setInterval(load, 30000);
        return () => { alive = false; clearInterval(id); };
    }, []);

    const activeCampaign = useMemo(() => (data?.campaigns || []).find((c) => c.active), [data]);
    if (!data) return null;

    const progress = data.withdrawal_progress || { current: 0, target: 25, percent: 0 };
    const failedRules = data.withdrawal_rules?.failed || [];
    const activity = data.real_activity || [];

    return (
        <div className="grid lg:grid-cols-3 gap-5 mt-6">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-strong border-amber-500/20 overflow-hidden relative transition hover:-translate-y-0.5 hover:border-amber-400/30">
                <Link to="/dashboard/withdraw" className="block p-5 focus:outline-none focus:ring-2 focus:ring-amber-400/40">
                <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-amber-400/10 blur-2xl" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Withdrawal Progress</p>
                        <h3 className="font-display text-xl mt-1">Minimum Target</h3>
                    </div>
                    <ShieldCheck className="w-6 h-6 text-amber-300" />
                </div>
                <div className="mt-5 flex items-end justify-between text-sm">
                    <span className="text-zinc-400">Current ${Number(progress.current || 0).toFixed(2)}</span>
                    <span className="text-amber-200">Target ${Number(progress.target || 0).toFixed(2)}</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden mt-3 border border-white/5">
                    <motion.div className="h-full gradient-gold" initial={{ width: 0 }} animate={{ width: `${Math.min(100, progress.percent || 0)}%` }} />
                </div>
                <p className="text-xs text-zinc-500 mt-3">{Number(progress.percent || 0).toFixed(0)}% complete. Rules are transparent and admin-configured.</p>
                {failedRules.length > 0 && <div className="mt-4 space-y-2">{failedRules.slice(0, 2).map((r) => <div key={r.id} className="text-xs bg-rose-500/10 border border-rose-400/20 rounded-xl p-2 text-rose-100">{r.message}</div>)}</div>}
                </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-strong border-purple-500/20 overflow-hidden relative transition hover:-translate-y-0.5 hover:border-purple-400/30">
                <Link to="/dashboard/rewards" className="block p-5 focus:outline-none focus:ring-2 focus:ring-purple-400/40">
                <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-purple-500/10 blur-2xl" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Active Campaign</p>
                        <h3 className="font-display text-xl mt-1">{activeCampaign?.name || "No active campaign"}</h3>
                    </div>
                    <Clock className="w-6 h-6 text-purple-300" />
                </div>
                <div className="mt-5 rounded-2xl bg-black/30 border border-white/5 p-4">
                    <p className="text-2xl font-display text-purple-200">{timeLeftLabel(activeCampaign?.ends_at)}</p>
                    <p className="text-sm text-zinc-400 mt-2">{activeCampaign?.content?.message || "Admin can create countdowns, deposit incentives, referral boosts, and announcements."}</p>
                </div>
                </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-strong border-emerald-500/20 overflow-hidden relative transition hover:-translate-y-0.5 hover:border-emerald-400/30">
                <Link to="/dashboard/transactions" className="block p-5 focus:outline-none focus:ring-2 focus:ring-emerald-400/40">
                <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-emerald-500/10 blur-2xl" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Real Activity</p>
                        <h3 className="font-display text-xl mt-1">Live Ledger Signals</h3>
                    </div>
                    <Users className="w-6 h-6 text-emerald-300" />
                </div>
                <div className="mt-4 space-y-2 max-h-40 overflow-hidden">
                    {activity.length === 0 ? <p className="text-sm text-zinc-500">No recent activity yet.</p> : activity.slice(0, 4).map((a) => (
                        <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2">
                            <span className="text-zinc-300">{a.user_label} · {String(a.type || "activity").replaceAll("_", " ")}</span>
                            <span className="text-emerald-200">{Number(a.amount || 0).toFixed(2)} {a.coin}</span>
                        </div>
                    ))}
                </div>
                </Link>
            </motion.div>
        </div>
    );
}

export function StickyMobileCTA() {
    return (
        <div className="lg:hidden fixed left-3 right-3 bottom-20 z-40 flex gap-2">
            <a href="/dashboard/tasks" className="flex-1 btn-gold justify-center"><Zap className="w-4 h-4" /> Earn</a>
            <a href="/dashboard/deposit" className="flex-1 btn-ghost justify-center"><TrendingUp className="w-4 h-4" /> Deposit</a>
        </div>
    );
}
