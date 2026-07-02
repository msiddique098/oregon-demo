import React from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useRealtime } from "../lib/realtime";

export default function RealtimeStatus() {
    const { connected } = useRealtime();
    return (
        <span className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs ${connected ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-zinc-500/10 border-zinc-500/20 text-zinc-400"}`}>
            {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {connected ? "Live" : "Offline"}
        </span>
    );
}
