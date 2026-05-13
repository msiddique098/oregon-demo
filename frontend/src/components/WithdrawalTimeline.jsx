import React from "react";
import { Clock, Eye, CheckCircle2, Cog, Send, XCircle } from "lucide-react";

const STAGES = [
    { key: "pending",    label: "Pending",    icon: Clock },
    { key: "reviewing",  label: "Reviewing",  icon: Eye },
    { key: "approved",   label: "Approved",   icon: CheckCircle2 },
    { key: "processing", label: "Processing", icon: Cog },
    { key: "completed",  label: "Completed",  icon: Send },
];

export default function WithdrawalTimeline({ status, processingHours, adminNote }) {
    const isRejected = status === "rejected";
    const currentIdx = STAGES.findIndex(s => s.key === status);

    return (
        <div className="bg-black/40 border border-white/5 rounded-xl p-4" data-testid="withdrawal-timeline">
            <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-widest text-zinc-500">Royal Processing Queue</p>
                {processingHours != null && (
                    <p className="text-xs text-amber-300">ETA ~{processingHours}h</p>
                )}
            </div>

            {isRejected ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <XCircle className="w-5 h-5 text-rose-300" />
                    <div>
                        <p className="text-sm font-semibold text-rose-200">Rejected</p>
                        <p className="text-xs text-zinc-400">{adminNote || "Funds refunded to your royal vault."}</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="relative">
                        <div className="absolute top-4 left-4 right-4 h-px bg-white/10"></div>
                        <div className="absolute top-4 left-4 h-px gradient-gold transition-all duration-700"
                             style={{ width: `calc(${(currentIdx / (STAGES.length - 1)) * 100}% - 32px * ${(currentIdx) / (STAGES.length - 1)})` }}></div>
                        <div className="relative grid grid-cols-5 gap-2">
                            {STAGES.map((s, i) => {
                                const Icon = s.icon;
                                const reached = i <= currentIdx;
                                const isCurrent = i === currentIdx;
                                return (
                                    <div key={s.key} className="flex flex-col items-center text-center">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                                            ${reached ? "gradient-gold text-black neon-gold" : "bg-white/5 border border-white/10 text-zinc-500"}
                                            ${isCurrent ? "animate-pulse-glow" : ""}`}>
                                            <Icon className="w-4 h-4" strokeWidth={1.8} />
                                        </div>
                                        <p className={`text-[10px] mt-1.5 uppercase tracking-widest ${reached ? "text-amber-300" : "text-zinc-500"}`}>{s.label}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {adminNote && (
                        <p className="text-xs text-zinc-400 mt-4 italic">Note: {adminNote}</p>
                    )}
                </>
            )}
        </div>
    );
}
