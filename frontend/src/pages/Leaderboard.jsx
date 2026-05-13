import React, { useEffect, useState } from "react";
import { Crown, Medal, Trophy, Users } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge, Card } from "../components/ui-royal";
import { api } from "../lib/api";

const tabs = ["balance", "tasks", "referrals"];

export default function Leaderboard() {
    const [metric, setMetric] = useState("balance");
    const [rows, setRows] = useState(null);
    useEffect(() => { setRows(null); api.get(`/leaderboard?metric=${metric}`).then(r => setRows(r.data)).catch(() => setRows([])); }, [metric]);
    return <DashboardLayout>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
            <div><p className="text-xs uppercase tracking-widest text-amber-400/80">Community competition</p><h1 className="text-3xl md:text-4xl font-display font-semibold mt-1">Royal Leaderboard</h1></div>
            <div className="flex gap-2">{tabs.map(t => <button key={t} onClick={() => setMetric(t)} className={`px-4 py-2 rounded-xl text-sm border capitalize ${metric === t ? "bg-amber-500/10 border-amber-500/30 text-amber-200" : "bg-white/5 border-white/10 text-zinc-400"}`}>{t}</button>)}</div>
        </div>
        {!rows ? <CinematicLoader /> : <div className="grid lg:grid-cols-3 gap-5">
            {rows.slice(0, 3).map((r, idx) => <Card key={r.id} className="text-center"><div className="mx-auto w-14 h-14 rounded-2xl gradient-gold flex items-center justify-center neon-gold"><Medal className="w-7 h-7 text-black" /></div><p className="mt-4 text-xs text-zinc-500 uppercase tracking-widest">Rank #{idx + 1}</p><h2 className="text-2xl font-display mt-1">{r.name}</h2><Badge color="gold" className="mt-3">{r.membership_name || "Free"}</Badge><p className="text-3xl font-display gradient-text-gold mt-4">{Number(r.score || 0).toLocaleString()}</p></Card>)}
            <div className="lg:col-span-3 glass-strong p-5 overflow-hidden"><div className="flex items-center gap-2 mb-4"><Trophy className="w-4 h-4 text-amber-300" /><p className="text-xs uppercase tracking-widest text-zinc-500">Live rankings</p></div><div className="space-y-2">{rows.map((r, idx) => <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-black/35 border border-white/5"><div className="flex items-center gap-3"><span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-sm">{idx + 1}</span><div><p className="font-medium">{r.name}</p><p className="text-xs text-zinc-500">{r.membership_name || "Free"}</p></div></div><div className="flex items-center gap-2 text-amber-300"><Users className="w-4 h-4" /> {Number(r.score || 0).toLocaleString()}</div></div>)}</div></div>
        </div>}
        <div className="fixed right-5 bottom-24 md:bottom-5 w-12 h-12 rounded-full gradient-purple neon-purple flex items-center justify-center"><Crown className="w-5 h-5" /></div>
    </DashboardLayout>;
}
