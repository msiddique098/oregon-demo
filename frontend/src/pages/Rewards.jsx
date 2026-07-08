import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, CheckCircle2, Lock, Timer, Crown, Zap, Wallet, ArrowRight, Radio } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import AnimatedCounter from "../components/AnimatedCounter";
import { Badge, Card } from "../components/ui-eregon";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function Rewards() {
    const navigate = useNavigate();
    const [overview, setOverview] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [vipLevels, setVipLevels] = useState([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        const [o, t, a, v] = await Promise.all([
            api.get("/phase2/overview"),
            api.get("/tasks-v2"),
            api.get("/achievements"),
            api.get("/vip/levels"),
        ]);
        setOverview(o.data); setTasks(t.data); setAchievements(a.data); setVipLevels(v.data); setLoading(false);
    };

    useEffect(() => { load().catch(() => setLoading(false)); }, []);

    const complete = async () => {
        toast.message("YouTube tasks require screenshot proof before rewards are credited.");
        navigate("/dashboard/tasks");
    };

    const nextVip = useMemo(() => {
        if (!overview || !vipLevels.length) return null;
        const bal = overview.wallet.total_balance || 0;
        return vipLevels.find(v => Number(v.required_balance || 0) > bal) || vipLevels[vipLevels.length - 1];
    }, [overview, vipLevels]);

    if (loading) return <DashboardLayout><CinematicLoader /><div className="h-6 lg:hidden" /></DashboardLayout>;

    const target = Number(overview?.minimum_target || 100);
    const balance = Number(overview?.wallet?.total_balance || 0);
    const targetPct = Math.min(100, Math.round((balance / Math.max(1, target)) * 100));
    const signalsPerDay = Number(overview?.trade_signals?.signals_per_day || overview?.signals_per_day || 0);

    return <DashboardLayout>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-8">
            <div>
                <h1 className="text-2xl sm:text-4xl font-display font-semibold mt-1">Rewards & Signals</h1>
                <p className="text-sm sm:text-base text-zinc-400 mt-2">Track task rewards, daily plan rewards, deposit boosts, and your option trade signal access.</p>
            </div>
            <Badge color="gold">{signalsPerDay} signals/day</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 mb-4 sm:mb-6">
            <Card className="shadow-[0_0_35px_rgba(16,185,129,.15)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Daily Trade Signals</p>
                        <h2 className="text-xl sm:text-2xl font-display mt-2"><span className="block text-sm text-zinc-400 font-body mb-1">Included with your plan</span><span className="text-emerald-300">{signalsPerDay}/day</span></h2>
                        <p className="text-xs text-zinc-500 mt-2">Signals are delivered as plan guidance for option trading opportunities.</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/15 border border-emerald-400/20 flex items-center justify-center"><Radio className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-300" /></div>
                </div>
            </Card>

            <Card>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Current Reward Balance</p>
                        <h2 className="text-2xl sm:text-3xl font-display mt-2 gradient-text-gold">$<AnimatedCounter value={balance} decimals={2} /></h2>
                        <p className="text-xs sm:text-sm text-zinc-400 mt-2">This is your real updated balance after approved tasks, daily plan rewards, referral rewards, option winnings, and deposit bonuses.</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl gradient-purple flex items-center justify-center neon-purple"><Wallet className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4 text-xs">
                    <div className="rounded-xl bg-black/35 border border-white/5 p-3"><span className="text-zinc-500">Bonus Balance</span><p className="text-amber-200 font-semibold">${Number(overview?.wallet?.bonus_balance || 0).toFixed(2)}</p></div>
                    <div className="rounded-xl bg-black/35 border border-white/5 p-3"><span className="text-zinc-500">First Task Bonus</span><p className="text-amber-200 font-semibold">{overview?.first_task_reward?.claimed ? "Claimed" : `$${Number(overview?.first_task_reward?.amount || 10).toFixed(2)} pending`}</p></div>
                </div>
                <div className="h-2 bg-white/5 rounded-full mt-5 overflow-hidden"><div className="h-full gradient-gold" style={{ width: `${targetPct}%` }} /></div>
                <p className="text-xs text-zinc-500 mt-2">${balance.toFixed(2)} / ${target} minimum target reached</p>
            </Card>

            <Card className="relative overflow-hidden border-amber-400/20 shadow-[0_0_35px_rgba(251,191,36,.12)]">
                <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-amber-400/20 blur-3xl" />
                <div className="flex items-start justify-between gap-4 relative z-10">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Limited Deposit Boost</p>
                        <h2 className="text-xl sm:text-2xl font-display mt-2">Get <span className="gradient-text-gold">12% extra bonus</span></h2>
                    </div>
                    <Zap className="w-8 h-8 text-amber-300" />
                </div>
                <button onClick={() => navigate('/dashboard/deposit')} className="btn-gold w-full mt-4 md:mt-5 relative z-10">Deposit & Unlock Bonus <ArrowRight className="w-4 h-4" /></button>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 mb-4 sm:mb-6">
            <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><h2 className="text-lg sm:text-xl font-display">Available Tasks</h2><Badge>{tasks.length} tasks</Badge></div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 sm:gap-4">
                    <AnimatePresence>
                        {tasks.map(task => <motion.div key={task.id} layout initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass-strong p-4 sm:p-5 group hover:border-amber-500/30 transition-all h-fit">
                            <div className="flex items-start justify-between gap-3">
                                <div><Badge color={task.type === "vip" ? "gold" : "purple"}>{task.type}</Badge><h3 className="font-display text-lg mt-3">{task.title}</h3></div>
                                {task.status === "locked" ? <Lock className="w-5 h-5 text-zinc-500" /> : task.status === "cooldown" ? <Timer className="w-5 h-5 text-amber-300" /> : <CheckCircle2 className="w-5 h-5 text-emerald-300" />}
                            </div>
                            <p className="text-sm text-zinc-400 mt-2">{task.description || "Complete the task and submit screenshot proof in the Task Center."}</p>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
                                <span className="text-2xl font-display gradient-text-gold">+{task.reward}</span>
                                <button disabled={task.status !== "available"} onClick={() => complete(task)} className={`px-4 py-2 rounded-xl text-sm ${task.status === "available" ? "btn-gold" : "bg-white/5 text-zinc-500 border border-white/10"}`}>{task.status === "available" ? "submit proof" : task.status}</button>
                            </div>
                        </motion.div>)}
                    </AnimatePresence>
                </div>
            </div>

            <Card>
                <div className="flex items-center gap-2 mb-4"><Trophy className="w-4 h-4 text-amber-300" /><p className="text-xs uppercase tracking-widest text-zinc-500">Achievements</p></div>
                <div className="space-y-3">{achievements.map(a => <div key={a.id} className="p-3 rounded-xl bg-black/35 border border-white/5"><div className="flex justify-between text-sm"><span>{a.title}</span><span className={a.unlocked ? "text-emerald-300" : "text-zinc-500"}>{a.progress}/{a.goal}</span></div><div className="h-2 bg-white/5 rounded-full mt-2 overflow-hidden"><div className="h-full gradient-gold" style={{ width: `${Math.min(100, a.progress / Math.max(1, a.goal) * 100)}%` }} /></div></div>)}</div>
            </Card>
        </div>

        <Card>
            <div className="flex items-center gap-2 mb-3"><Crown className="w-4 h-4 text-amber-300" /><p className="text-xs uppercase tracking-widest text-zinc-500">Next VIP Target</p></div>
            <h3 className="text-2xl font-display gradient-text-gold">{nextVip?.name}</h3>
            <p className="text-xs sm:text-sm text-zinc-400 mt-2">Required balance: {nextVip?.required_balance || 0} USDT</p>
            <div className="h-2 bg-white/5 rounded-full mt-4 overflow-hidden"><div className="h-full gradient-purple" style={{ width: `${Math.min(100, ((overview?.wallet?.total_balance || 0) / Math.max(1, nextVip?.required_balance || 1)) * 100)}%` }} /></div>
        </Card>
    <div className="h-6 lg:hidden" />
    </DashboardLayout>;
}
