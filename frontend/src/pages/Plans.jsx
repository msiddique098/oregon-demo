import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Crown } from "lucide-react";
import PublicNav from "../components/PublicNav";
import Footer from "../components/Footer";
import { api } from "../lib/api";

export default function Plans() {
    const [packages, setPackages] = useState([]);

    useEffect(() => { api.get("/public/packages").then(r => setPackages(r.data)).catch(() => {}); }, []);

    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <PublicNav />
            <section className="relative max-w-7xl mx-auto px-6 lg:px-12 py-16 md:py-20">
                <div className="absolute inset-0 eregon-radial pointer-events-none"></div>
                <div className="relative text-center max-w-3xl mx-auto mb-12">
                    <p className="text-xs uppercase tracking-widest text-amber-400/80 mb-3">Eregon Membership</p>
                    <h1 className="text-2xl sm:text-4xl md:text-6xl font-display font-semibold">Choose your <span className="gradient-text-gold">growth plan</span></h1>
                    <p className="text-zinc-400 mt-4">Choose a membership plan and unlock spin-wheel attempts, priority withdrawals, and referral perks.</p>
                </div>
                <div className="relative grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                    {packages.map((p, idx) => {
                        const isFeatured = idx === packages.length - 1;
                        return (
                            <div key={p.id} data-testid={`plan-card-${p.tier}`}
                                className={`glass-strong p-6 relative overflow-hidden ${isFeatured ? "border-amber-500/40 neon-gold" : ""}`}>
                                <div className={`absolute top-0 left-0 right-0 h-px ${isFeatured ? "bg-amber-400/60" : "bg-purple-500/40"}`}></div>
                                <div className="flex items-center gap-2 mb-2">
                                    {isFeatured && <Crown className="w-4 h-4 text-amber-300" />}
                                    <p className="text-xs uppercase tracking-widest text-zinc-500">{p.tier}</p>
                                </div>
                                <h3 className={`text-2xl sm:text-3xl font-display font-semibold ${isFeatured ? "gradient-text-gold" : "text-white"}`}>${p.investment}</h3>
                                <p className="text-sm text-emerald-300 mt-1">{p.spin_tokens || 0} included spins</p>
                                <div className="my-4 h-px bg-white/5"></div>
                                <ul className="space-y-2 text-sm text-zinc-300">
                                    {p.perks.map((perk, i) => (
                                        <li key={i} className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" /> {perk}</li>
                                    ))}
                                    <li className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" /> {p.duration_days} days duration</li>
                                    <li className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" /> Withdrawal in {p.priority_withdrawal_hours}h</li>
                                    <li className="flex items-start gap-2"><Check className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" /> {p.spin_tokens || 0} included spin attempts</li>
                                </ul>
                                <Link to="/register" className={`${isFeatured ? "btn-gold" : "btn-eregon"} w-full mt-6 text-sm py-2.5`}>
                                    Join {p.tier}
                                </Link>
                            </div>
                        );
                    })}
                </div>
            </section>
            <Footer />
        </div>
    );
}
