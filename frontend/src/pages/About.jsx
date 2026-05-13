import React from "react";
import PublicNav from "../components/PublicNav";
import Footer from "../components/Footer";
import { Crown, ShieldCheck, Globe, Trophy } from "lucide-react";

export default function About() {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <PublicNav />
            <section className="relative max-w-5xl mx-auto px-6 lg:px-12 py-16 md:py-24">
                <div className="absolute inset-0 royal-radial pointer-events-none"></div>
                <div className="relative">
                    <p className="text-xs uppercase tracking-widest text-amber-400/80 mb-3">About Royal Crypto</p>
                    <h1 className="text-2xl sm:text-4xl md:text-6xl font-display font-semibold leading-tight">
                        Built for a <span className="gradient-text-gold">premium</span> rewards generation.
                    </h1>
                    <p className="text-zinc-400 mt-6 max-w-2xl">
                        Royal Crypto Rewards is a luxury showcase platform that visualizes a fully admin-curated rewards ecosystem.
                        Every balance, profit, task, and commission is meticulously crafted from the Royal Admin Console — there is no live blockchain syncing here.
                        We deliver the elegance of a top-tier fintech experience for demonstrations, internal incentive systems and luxury rewards visualization.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4 mt-12">
                        {[
                            { icon: Crown, title: "Royal Aesthetic", desc: "Glassmorphism, gold halos and royal purple neon throughout every surface." },
                            { icon: ShieldCheck, title: "Vault-grade Auth", desc: "JWT tokens, bcrypt password vaults and role-based access for admins." },
                            { icon: Globe, title: "Multi-coin Display", desc: "Show rewards in USDT, BTC, ETH, BNB or any custom symbol you wish." },
                            { icon: Trophy, title: "Five Crown Tiers", desc: "From Basic to Royal VIP — each tier unlocks elite perks and faster withdrawals." },
                        ].map((it, i) => (
                            <div key={i} className="glass-strong p-6">
                                <div className="w-10 h-10 rounded-xl gradient-purple flex items-center justify-center mb-3 neon-purple">
                                    <it.icon className="w-5 h-5 text-white" strokeWidth={1.6} />
                                </div>
                                <h3 className="font-display text-lg font-semibold">{it.title}</h3>
                                <p className="text-sm text-zinc-400 mt-2">{it.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
            <Footer />
        </div>
    );
}
