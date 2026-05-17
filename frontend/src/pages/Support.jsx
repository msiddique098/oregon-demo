import React from "react";
import PublicNav from "../components/PublicNav";
import Footer from "../components/Footer";
import { Mail, MessageSquare, Clock } from "lucide-react";

export default function Support() {
    return (
        <div className="min-h-screen bg-[#050505] text-white">
            <PublicNav />
            <section className="max-w-4xl mx-auto px-6 lg:px-12 py-16 md:py-20">
                <p className="text-xs uppercase tracking-widest text-amber-400/80 mb-3">RoyalMarketing Support</p>
                <h1 className="text-2xl sm:text-4xl md:text-3xl sm:text-5xl font-display font-semibold">We&rsquo;re here, we can help.</h1>
                <p className="text-zinc-400 mt-4">Reach out and our concierge desk will return with support.</p>
                <div className="grid md:grid-cols-3 gap-4 mt-10">
                    <div className="glass-strong p-6"><Mail className="w-5 h-5 text-amber-300 mb-3" /><p className="font-semibold">Email</p><p className="text-sm text-zinc-400 mt-1">support@royalmarketing.com</p></div>
                    <div className="glass-strong p-6"><MessageSquare className="w-5 h-5 text-purple-300 mb-3" /><p className="font-semibold">Live Chat</p><p className="text-sm text-zinc-400 mt-1">Available for eligible members</p></div>
                    <div className="glass-strong p-6"><Clock className="w-5 h-5 text-emerald-300 mb-3" /><p className="font-semibold">Hours</p><p className="text-sm text-zinc-400 mt-1">24/7 support coverage</p></div>
                </div>
                <form className="glass-strong p-6 md:p-8 mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); alert("Message received. Support will respond."); }}>
                    <h3 className="font-display text-xl font-semibold">Send a message</h3>
                    <input className="input-royal" placeholder="Your name" />
                    <input type="email" className="input-royal" placeholder="Your email" />
                    <textarea className="input-royal min-h-[120px]" placeholder="How can we help?" />
                    <button className="btn-royal" type="submit">Send to Support</button>
                </form>
            </section>
            <Footer />
        </div>
    );
}
