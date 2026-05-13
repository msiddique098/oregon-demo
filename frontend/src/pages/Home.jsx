import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ClipboardCheck, ImageUp, ShieldCheck, Wallet, Youtube } from "lucide-react";
import PublicNav from "../components/PublicNav";
import Footer from "../components/Footer";
import { useAuth } from "../lib/auth";

const steps = [
    ["Sign up", "Create your account and open the dashboard."],
    ["Complete a YouTube task", "Open the assigned channel or video and follow the exact instructions."],
    ["Upload screenshot proof", "Submit a clear screenshot showing the completed action."],
    ["Wait for review", "Admins approve valid proof and reject unclear, duplicate, or edited screenshots."],
    ["Earn and withdraw", "Approved rewards appear in your wallet and become withdrawable when rules are met."],
];

export default function Home() {
    const { user } = useAuth();
    const primaryPath = user ? (user.role === "admin" ? "/admin" : "/dashboard") : "/register";
    const secondaryPath = user ? (user.role === "admin" ? "/dashboard" : "/dashboard/rewards") : "/login";
    const primaryLabel = user ? (user.role === "admin" ? "Open admin" : "Go to dashboard") : "Start earning";
    const secondaryLabel = user ? (user.role === "admin" ? "User dashboard" : "Reward hub") : "Login";
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <PublicNav />

            <section className="relative overflow-hidden">
                <div className="absolute inset-0 royal-grid opacity-40 pointer-events-none"></div>
                <div className="absolute inset-0 royal-radial pointer-events-none"></div>
                <div className="relative max-w-7xl mx-auto px-6 lg:px-12 pt-20 lg:pt-28 pb-24">
                    <div className="grid lg:grid-cols-12 gap-12 items-center">
                        <div className="lg:col-span-7 animate-fade-up">
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border-red-500/30 mb-6">
                                <Youtube className="w-4 h-4 text-red-400" />
                                <span className="text-xs tracking-wider uppercase text-zinc-300">Verified YouTube task rewards</span>
                            </div>
                            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-semibold leading-[1.05] tracking-tight">
                                Complete tasks.
                                <span className="block gradient-text-gold text-glow-gold">Upload proof.</span>
                                Earn approved rewards.
                            </h1>
                            <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-2xl mt-6">
                                Oregon is a task-based reward platform where users complete simple YouTube promotional assignments, submit screenshot proof, and receive wallet rewards after admin approval.
                            </p>
                            <div className="flex flex-wrap gap-3 mt-8">
                                <Link to={primaryPath} className="btn-royal">{primaryLabel} <ArrowRight className="w-4 h-4" /></Link>
                                <Link to={secondaryPath} className="btn-ghost">{secondaryLabel}</Link>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-3 mt-10 max-w-2xl text-xs text-zinc-400">
                                <div className="flex items-center gap-2"><ClipboardCheck className="w-4 h-4 text-purple-300" /> Admin-reviewed proof</div>
                                <div className="flex items-center gap-2"><Wallet className="w-4 h-4 text-amber-300" /> Clear wallet balance</div>
                                <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-300" /> Transparent rules</div>
                            </div>
                        </div>

                        <div className="lg:col-span-5">
                            <div className="glass-strong p-6 relative animate-float">
                                <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"></div>
                                <p className="text-xs uppercase tracking-widest text-zinc-500">Example task card</p>
                                <h2 className="text-2xl font-display mt-3">Subscribe to campaign channel</h2>
                                <p className="text-sm text-zinc-400 mt-2">Open the YouTube channel, subscribe, then upload a screenshot showing the channel name and Subscribed button.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
                                    <div className="bg-black/40 border border-white/5 rounded-xl p-4"><p className="text-[10px] text-zinc-500 uppercase tracking-widest">Reward</p><p className="text-2xl font-display gradient-text-gold">+2.00 USDT</p></div>
                                    <div className="bg-black/40 border border-white/5 rounded-xl p-4"><p className="text-[10px] text-zinc-500 uppercase tracking-widest">Status</p><p className="text-lg text-amber-300">Pending review</p></div>
                                </div>
                                <div className="mt-5 rounded-xl border border-dashed border-white/10 bg-black/35 p-5 flex items-center gap-3"><ImageUp className="w-6 h-6 text-purple-300" /><div><p className="text-sm">Screenshot proof required</p><p className="text-xs text-zinc-500">Rewards are credited only after approval.</p></div></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
                <div className="text-center max-w-3xl mx-auto mb-12">
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">How it works</p>
                    <h2 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-2">A clear proof-based earning flow</h2>
                    <p className="text-zinc-400 mt-3">Every reward is linked to a task submission and review decision.</p>
                </div>
                <div className="grid md:grid-cols-5 gap-4">
                    {steps.map(([title, text], i) => <div key={title} className="glass-strong p-5"><div className="w-9 h-9 rounded-xl gradient-gold text-black flex items-center justify-center font-semibold">{i + 1}</div><h3 className="font-display text-lg mt-4">{title}</h3><p className="text-sm text-zinc-400 mt-2">{text}</p></div>)}
                </div>
            </section>

            <section className="max-w-7xl mx-auto px-6 lg:px-12 py-16">
                <div className="grid lg:grid-cols-3 gap-5">
                    <div className="glass-strong p-6"><CheckCircle2 className="w-6 h-6 text-emerald-300" /><h3 className="font-display text-xl mt-4">Accepted proof</h3><p className="text-sm text-zinc-400 mt-2">Screenshots should clearly show the YouTube channel/video, action completed, and relevant button state.</p></div>
                    <div className="glass-strong p-6"><ShieldCheck className="w-6 h-6 text-amber-300" /><h3 className="font-display text-xl mt-4">Review rules</h3><p className="text-sm text-zinc-400 mt-2">Duplicate, edited, blurry, incomplete, or unrelated screenshots may be rejected with a reason.</p></div>
                    <div className="glass-strong p-6"><Wallet className="w-6 h-6 text-purple-300" /><h3 className="font-display text-xl mt-4">Withdrawals</h3><p className="text-sm text-zinc-400 mt-2">Withdrawals require minimum balance, no conflicting pending withdrawal, and admin review before processing.</p></div>
                </div>
            </section>

            <section className="max-w-5xl mx-auto px-6 lg:px-12 py-16 text-center">
                <div className="glass-strong p-4 sm:p-6 lg:p-8 md:p-10">
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Important transparency note</p>
                    <h2 className="text-2xl sm:text-3xl font-display mt-3">Rewards are not guaranteed until proof is approved.</h2>
                    <p className="text-zinc-400 mt-4">Task availability, reward amounts, approval decisions, account levels, and withdrawal eligibility are controlled by platform rules. Always read task instructions before submitting proof.</p>
                    <Link to={primaryPath} className="btn-royal mt-6 inline-flex">{user ? primaryLabel : "Create account"} <ArrowRight className="w-4 h-4" /></Link>
                </div>
            </section>

            <Footer />
        </div>
    );
}
