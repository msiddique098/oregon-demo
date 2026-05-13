import React from "react";
import { Link } from "react-router-dom";
import { Crown } from "lucide-react";

export default function Footer() {
    return (
        <footer className="border-t border-white/5 mt-24" data-testid="public-footer">
            <div className="max-w-7xl mx-auto px-6 lg:px-12 py-12 grid md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center neon-purple">
                            <Crown className="w-5 h-5 text-white" strokeWidth={1.6} />
                        </span>
                        <span className="font-display text-lg font-semibold">Royal<span className="gradient-text-gold">Crypto</span></span>
                    </div>
                    <p className="text-sm text-zinc-500 leading-relaxed">A luxury crypto rewards ecosystem crafted for elite earners. Built for visual experience.</p>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Platform</p>
                    <ul className="space-y-2 text-sm text-zinc-400">
                        <li><Link to="/plans" className="hover:text-white">Membership</Link></li>
                        <li><Link to="/about" className="hover:text-white">About</Link></li>
                        <li><Link to="/support" className="hover:text-white">Support</Link></li>
                    </ul>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Account</p>
                    <ul className="space-y-2 text-sm text-zinc-400">
                        <li><Link to="/login" className="hover:text-white">Login</Link></li>
                        <li><Link to="/register" className="hover:text-white">Register</Link></li>
                        <li><Link to="/forgot" className="hover:text-white">Forgot Password</Link></li>
                    </ul>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Legal</p>
                    <ul className="space-y-2 text-sm text-zinc-400">
                        <li><Link to="/terms" className="hover:text-white">Terms</Link></li>
                        <li><Link to="/privacy" className="hover:text-white">Privacy</Link></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-white/5 py-6 text-center text-xs text-zinc-600">
                © {new Date().getFullYear()} Royal Crypto Rewards. Visual rewards platform.
            </div>
        </footer>
    );
}
