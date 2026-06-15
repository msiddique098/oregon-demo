import React, { useEffect, useState } from "react";
import { Crown, Medal, Trophy } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge, Card } from "../components/ui-eregon";
import { api } from "../lib/api";

const tabs = ["balance"];

export default function Leaderboard() {
    const [metric, setMetric] = useState("balance");
    const [rows, setRows] = useState(null);
    useEffect(() => { setRows(null); api.get(`/leaderboard?metric=${metric}`).then(r => setRows(r.data)).catch(() => setRows([])); }, [metric]);
    return <DashboardLayout>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-3 mb-8">
            <div><p className="text-xs uppercase tracking-widest text-amber-400/80">Community summary</p><h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Eregon Marketing Total Rewards</h1></div>
            <div className="flex flex-wrap gap-2">{tabs.map(t => <button key={t} onClick={() => setMetric(t)} className={`px-4 py-2 rounded-xl text-sm border capitalize ${metric === t ? "bg-amber-500/10 border-amber-500/30 text-amber-200" : "bg-white/5 border-white/10 text-zinc-400"}`}>{t}</button>)}</div>
        </div>
        {!rows ? <CinematicLoader /> : <div className="grid lg:grid-cols-3 gap-5">
            {rows.slice(0, 1).map((r) => <Card key={r.id} className="text-center lg:col-span-3"><div className="mx-auto w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center neon-gold"><Medal className="w-7 h-7 text-black" /></div><p className="mt-4 text-xs text-zinc-500 uppercase tracking-widest">Community member accounts</p><h2 className="text-3xl sm:text-5xl font-display gradient-text-gold mt-2">{Number(r.member_count || 115000).toLocaleString()}</h2><Badge color="gold" className="mt-3">{r.name}</Badge><div className="mt-5 rounded-2xl bg-black/35 border border-white/5 p-4"><p className="text-xs uppercase tracking-widest text-zinc-500">Approved community balance</p><p className="text-2xl sm:text-3xl font-display gradient-text-gold mt-2">${Number(r.score || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div><p className="text-xs text-zinc-500 mt-3">Individual names, plans, join dates, and balances are hidden from member view.</p></Card>)}
            <div className="lg:col-span-3 glass-strong p-5 overflow-hidden"><div className="flex items-center gap-2 mb-4"><Trophy className="w-4 h-4 text-amber-300" /><p className="text-xs uppercase tracking-widest text-zinc-500">Approved total to date</p></div><p className="text-sm text-zinc-400">Only the combined approved member balance is shown here. Detailed member records remain available in the admin area.</p></div>
        </div>}
        <div className="fixed right-5 bottom-24 md:bottom-5 w-12 h-12 rounded-full gradient-purple neon-purple flex items-center justify-center"><Crown className="w-5 h-5" /></div>
    </DashboardLayout>;
}
