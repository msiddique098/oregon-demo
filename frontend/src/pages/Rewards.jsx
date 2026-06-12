import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, RotateCcw, CheckCircle2, Lock, Timer, Crown, Zap, Wallet, ArrowRight } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import AnimatedCounter from "../components/AnimatedCounter";
import { Badge, Card } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const FALLBACK_WHEEL = [
    { label: "Lucky Drop", value: 0.20, type: "cash_reward" },
    { label: "Boost Win", value: 0.50, type: "cash_reward" },
    { label: "Gold Spark", value: 1.00, type: "cash_reward" },
    { label: "Wallet Lift", value: 2.00, type: "cash_reward" },
    { label: "Crown Drop", value: 5.00, type: "cash_reward" },
    { label: "VIP Boost", value: 10.00, type: "cash_reward" },
    { label: "Reward Pop", value: 15.00, type: "cash_reward" },
    { label: "Prime Hit", value: 19.00, type: "cash_reward" },
    { label: "Gold Burst", value: 25.00, type: "cash_reward" },
    { label: "Royal Win", value: 50.00, type: "cash_reward" },
    { label: "Elite Drop", value: 75.00, type: "cash_reward" },
    { label: "Mega Boost", value: 100.00, type: "cash_reward" },
    { label: "Bonus Task", value: 0, type: "bonus_task" },
    { label: "Try Again", value: 0, type: "no_reward" },
];

function ConfettiBurst({ active }) {
    if (!active) return null;
    return <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {Array.from({ length: 34 }).map((_, i) => (
            <motion.span key={i} initial={{ y: -20, x: `${Math.random() * 100}vw`, opacity: 1, rotate: 0 }} animate={{ y: "105vh", rotate: 360, opacity: 0 }} transition={{ duration: 1.4 + Math.random(), ease: "easeOut" }} className="absolute top-0 h-2 w-2 rounded-sm bg-amber-300 shadow-[0_0_12px_rgba(251,191,36,.75)]" />
        ))}
    </div>;
}

function SpinWheel({ prizes, spinning, result }) {
    const labels = FALLBACK_WHEEL;
    const resultIndex = result ? Math.max(0, labels.findIndex(p => p.label === result.label || Number(p.value) === Number(result.value))) : 0;
    const segment = 360 / labels.length;
    const finalRotation = spinning ? 1440 : result ? 1440 + (360 - resultIndex * segment) : 0;
    return <div className="relative mx-auto w-48 h-48 xs:w-56 xs:h-56 sm:w-72 sm:h-72 flex items-center justify-center">
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,.8)]" />
        <motion.div
            animate={{ rotate: finalRotation }}
            transition={{ duration: spinning ? 2.4 : 0.7, ease: spinning ? "easeInOut" : "easeOut" }}
            className="relative w-full h-full rounded-full border border-amber-500/30 shadow-[0_0_35px_rgba(251,191,36,.22)] overflow-hidden bg-[conic-gradient(from_0deg,#f59e0b,#7c3aed,#111827,#fbbf24,#312e81,#f59e0b)]"
        >
            <div className="absolute inset-4 rounded-full bg-black/55 border border-white/10 backdrop-blur-sm" />
            {labels.map((p, i) => (
                <div key={`${p.label}-${i}`} className="absolute left-1/2 top-1/2 text-[10px] sm:text-xs font-semibold text-white/90 origin-left" style={{ transform: `rotate(${i * segment}deg) translate(42px, -50%)` }}>
                    <span className="inline-block -rotate-12 whitespace-nowrap">{p.label}</span>
                </div>
            ))}
            <div className="absolute inset-[34%] rounded-full gradient-gold flex items-center justify-center text-black font-display font-bold">SPIN</div>
        </motion.div>
        {result && !spinning && <div className="absolute -bottom-10 px-4 py-2 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-100 font-display">Won ${Number(result.value || 0).toFixed(2)}</div>}
    </div>;
}

export default function Rewards() {
    const navigate = useNavigate();
    const [overview, setOverview] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [vipLevels, setVipLevels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [burst, setBurst] = useState(false);
    const [spinning, setSpinning] = useState(false);
    const [spinResult, setSpinResult] = useState(null);

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

    const celebrate = () => { setBurst(true); setTimeout(() => setBurst(false), 1800); };
    const spin = async () => {
        if (spinning) return;
        setSpinning(true); setSpinResult(null);
        try {
            const { data } = await api.post("/rewards/spin");
            setTimeout(async () => {
                setSpinResult({ label: "Spin reward", value: Number(data.reward || 0), type: "cash_reward" });
                setSpinning(false);
                toast.success(`Spin result: +$${Number(data.reward || 0).toFixed(2)}`);
                if (Number(data.reward || 0) > 0) celebrate();
                await load();
            }, 2500);
        } catch (e) { setSpinning(false); toast.error(formatApiError(e)); }
    };
    const complete = async () => {
        toast.message("YouTube tasks require screenshot proof before rewards are credited.");
        navigate("/dashboard/tasks");
    };

    const nextVip = useMemo(() => {
        if (!overview || !vipLevels.length) return null;
        const bal = overview.wallet.total_balance || 0;
        return vipLevels.find(v => Number(v.required_balance || 0) > bal) || vipLevels[vipLevels.length - 1];
    }, [overview, vipLevels]);

    if (loading) return <DashboardLayout><CinematicLoader /><div className="h-6 lg:hidden" />
    </DashboardLayout>;

    const target = Number(overview?.minimum_target || 100);
    const balance = Number(overview?.wallet?.total_balance || 0);
    const targetPct = Math.min(100, Math.round((balance / Math.max(1, target)) * 100));
    const planSpinReceived = Number(overview?.plan_spin_rewards?.received_reward || 0);
    const planSpinReceivedCount = Number(overview?.plan_spin_rewards?.received_count || 0);
    const remainingSpins = Number(overview?.plan_spin_rewards?.remaining_queue || overview?.spin_tokens || 0);

    return <DashboardLayout>
        <ConfettiBurst active={burst} />
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-8">
            <div>
                <h1 className="text-2xl sm:text-4xl font-display font-semibold mt-1">Reward Hub</h1>
                <p className="text-sm sm:text-base text-zinc-400 mt-2">Use spin tokens and approved task rewards to grow your wallet.</p>
            </div>
            <Badge color="gold">{overview?.spin_tokens || 0} spin tokens</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 mb-4 sm:mb-6">
            <Card className="shadow-[0_0_35px_rgba(251,191,36,.15)]">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Plan Spin Rewards</p>
                        <h2 className="text-xl sm:text-2xl font-display mt-2"><span className="block text-sm text-zinc-400 font-body mb-1">Received from spins</span><span className="gradient-text-gold">${planSpinReceived.toFixed(2)}</span></h2>
                        <p className="text-xs text-zinc-500 mt-2">{planSpinReceivedCount} completed spins · {remainingSpins} available</p>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl gradient-gold flex items-center justify-center neon-gold"><Zap className="w-5 h-5 sm:w-6 sm:h-6 text-black" /></div>
                </div>
            </Card>

            <Card>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Current Reward Balance</p>
                        <h2 className="text-2xl sm:text-3xl font-display mt-2 gradient-text-gold">$<AnimatedCounter value={balance} decimals={2} /></h2>
                        <p className="text-xs sm:text-sm text-zinc-400 mt-2">This is your real updated balance after approved tasks, plan spins, referral rewards, and deposit bonuses.</p>
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
                        <h2 className="text-xl sm:text-2xl font-display mt-2">Get <span className="gradient-text-gold">30% extra bonus</span></h2>
                    </div>
                    <Zap className="w-8 h-8 text-amber-300" />
                </div>
                <button onClick={() => navigate('/dashboard/deposit')} className="btn-gold w-full mt-4 md:mt-5 relative z-10">Deposit & Unlock Bonus <ArrowRight className="w-4 h-4" /></button>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-5 mb-4 sm:mb-6">
            <Card className="lg:col-span-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Lucky Event</p>
                        <h2 className="text-xl sm:text-2xl font-display mt-2">Reward Spin Wheel</h2>
                        <p className="text-xs sm:text-sm text-zinc-400 mt-2">Use your available spin tokens to unlock plan rewards.</p>
                    </div>
                    <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300" />
                </div>
                <SpinWheel spinning={spinning} result={spinResult} />
                <button disabled={spinning || Number(overview?.spin_tokens || 0) <= 0} onClick={spin} className={`btn-eregon w-full mt-10 sm:mt-14 ${spinning || Number(overview?.spin_tokens || 0) <= 0 ? "opacity-60 cursor-not-allowed" : ""}`}><Zap className="w-4 h-4" /> {spinning ? "Spinning..." : "Spin now"}</button>
            </Card>

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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
            <Card>
                <div className="flex items-center gap-2 mb-4"><Trophy className="w-4 h-4 text-amber-300" /><p className="text-xs uppercase tracking-widest text-zinc-500">Achievements</p></div>
                <div className="space-y-3">{achievements.map(a => <div key={a.id} className="p-3 rounded-xl bg-black/35 border border-white/5"><div className="flex justify-between text-sm"><span>{a.title}</span><span className={a.unlocked ? "text-emerald-300" : "text-zinc-500"}>{a.progress}/{a.goal}</span></div><div className="h-2 bg-white/5 rounded-full mt-2 overflow-hidden"><div className="h-full gradient-gold" style={{ width: `${Math.min(100, a.progress / a.goal * 100)}%` }} /></div></div>)}</div>
            </Card>
            <Card>
                <div className="flex items-center gap-2 mb-3"><Crown className="w-4 h-4 text-amber-300" /><p className="text-xs uppercase tracking-widest text-zinc-500">Next VIP Target</p></div>
                <h3 className="text-2xl font-display gradient-text-gold">{nextVip?.name}</h3>
                <p className="text-xs sm:text-sm text-zinc-400 mt-2">Required balance: {nextVip?.required_balance || 0} USDT</p>
                <div className="h-2 bg-white/5 rounded-full mt-4 overflow-hidden"><div className="h-full gradient-purple" style={{ width: `${Math.min(100, ((overview?.wallet?.total_balance || 0) / Math.max(1, nextVip?.required_balance || 1)) * 100)}%` }} /></div>
            </Card>
        </div>
    <div className="h-6 lg:hidden" />
    </DashboardLayout>;
}
