import React from "react";
import { Crown } from "lucide-react";

export default function CinematicLoader({ label = "Summoning Eregon wallet..." }) {
    return (
        <div className="min-h-[40vh] flex flex-col items-center justify-center gap-5" data-testid="cinematic-loader">
            <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border border-amber-500/30 animate-ping"></div>
                <div className="absolute inset-1 rounded-full border-2 border-purple-500/40 animate-pulse"></div>
                <div className="absolute inset-3 rounded-full gradient-purple flex items-center justify-center animate-float neon-purple">
                    <Crown className="w-6 h-6 text-white" strokeWidth={1.6} />
                </div>
            </div>
            <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">{label}</p>
        </div>
    );
}
