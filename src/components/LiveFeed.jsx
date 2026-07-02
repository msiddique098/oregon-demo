import React, { useEffect, useMemo, useState } from "react";
import { Sparkles, TrendingUp, Crown, Wallet, Users, CheckCircle, Diamond } from "lucide-react";
import { api } from "../lib/api";

const ICONS = {
    sparkles: Sparkles,
    trending: TrendingUp,
    crown: Crown,
    wallet: Wallet,
    users: Users,
    check: CheckCircle,
    diamond: Diamond,
};

const VISIBLE_COUNT = 5;

export default function LiveFeed({ variant = "default" }) {
    const [items, setItems] = useState([]);
    const [cursor, setCursor] = useState(0);

    useEffect(() => {
        const load = () => api.get("/public/feed?limit=50").then((r) => setItems(r.data || [])).catch(() => {});
        load();
        const refresh = setInterval(load, 60000);
        return () => clearInterval(refresh);
    }, []);

    useEffect(() => {
        if (items.length <= 1) return;
        const i = setInterval(() => setCursor((c) => (c + 1) % items.length), 3500);
        return () => clearInterval(i);
    }, [items.length]);

    const visible = useMemo(() => {
        if (items.length === 0) return [];
        const count = variant === "ticker" ? 1 : Math.min(VISIBLE_COUNT, items.length);
        return items.slice(cursor, cursor + count).concat(items.slice(0, Math.max(0, cursor + count - items.length)));
    }, [items, cursor, variant]);

    if (items.length === 0) return null;

    if (variant === "ticker") {
        const current = visible[0] || items[0];
        const Icon = ICONS[current.icon] || Sparkles;
        return (
            <div className="glass px-4 py-2.5 flex items-center gap-3 overflow-hidden" data-testid="live-feed-ticker">
                <span className="relative flex w-2 h-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400"></span>
                </span>
                <Icon className="w-4 h-4 text-amber-300 shrink-0" strokeWidth={1.6} />
                <p key={current.id} className="text-xs text-zinc-300 truncate animate-fade-up">{current.message}</p>
            </div>
        );
    }

    return (
        <div className="glass-strong p-5 relative overflow-hidden" data-testid="live-feed-widget">
            <div className="absolute top-0 left-0 right-0 h-px bg-emerald-400/40"></div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                    <span className="relative flex w-2 h-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                        <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400"></span>
                    </span>
                    <p className="text-xs uppercase tracking-widest text-zinc-500">Eregon Marketing Updates</p>
                </div>
                <span className="text-[10px] text-zinc-600 uppercase">50+ recent</span>
            </div>

            <div className="space-y-2.5 min-h-[340px]">
                {visible.map((it, idx) => {
                    const Icon = ICONS[it.icon] || Sparkles;
                    return (
                        <div
                            key={`${it.id}-${idx}`}
                            className="flex items-start gap-3 p-2.5 rounded-xl bg-black/30 border border-white/5 animate-fade-up"
                            style={{ animationDelay: `${idx * 60}ms` }}
                        >
                            <span className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                                <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
                            </span>
                            <p className="text-xs text-zinc-300 leading-relaxed">{it.message}</p>
                        </div>
                    );
                })}
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Updated automatically</span>
                <span>{items.length}+ activity items loaded</span>
            </div>
        </div>
    );
}
