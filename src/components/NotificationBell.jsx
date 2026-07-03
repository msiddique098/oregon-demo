import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Bell, X, Gift, Wallet, Crown, ShieldCheck, Megaphone, Headphones, Sparkles } from "lucide-react";
import { api } from "../lib/api";

const ICONS = {
    rewards: Gift, withdrawals: Wallet, membership: Crown, security: ShieldCheck,
    promotions: Megaphone, support: Headphones, system: Sparkles,
};
const COLORS = {
    rewards: "text-amber-300 bg-amber-500/10",
    withdrawals: "text-purple-300 bg-purple-500/10",
    membership: "text-amber-300 bg-amber-500/10",
    security: "text-emerald-300 bg-emerald-500/10",
    promotions: "text-rose-300 bg-rose-500/10",
    support: "text-cyan-300 bg-cyan-500/10",
    system: "text-zinc-300 bg-white/5",
};

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [count, setCount] = useState(0);
    const [items, setItems] = useState([]);
    const ref = useRef();

    const refresh = async () => {
        try {
            const c = await api.get("/user/notifications/unread-count");
            setCount(c.data.count);
            const list = await api.get("/user/notifications");
            setItems(list.data);
        } catch (e) { void e; }
    };

    useEffect(() => {
        refresh();
        const i = setInterval(refresh, 25000);
        return () => clearInterval(i);
    }, []);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const markAll = async () => {
        await api.post("/user/notifications/read-all");
        refresh();
    };

    return (
        <div className="relative" ref={ref} data-testid="notification-bell">
            <button onClick={() => setOpen(!open)} className="relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all flex items-center justify-center">
                <Bell className="w-4 h-4 text-zinc-300" strokeWidth={1.6} />
                {count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full gradient-gold text-black text-[10px] font-bold flex items-center justify-center neon-gold">
                        {count > 9 ? "9+" : count}
                    </span>
                )}
            </button>
            {open && (
                <div className="fixed left-3 right-3 top-[68px] max-h-[min(520px,calc(100vh-152px))] rounded-2xl border border-white/15 bg-[#050507] shadow-[0_24px_80px_rgba(0,0,0,0.92)] p-3 z-[120] animate-fade-up ring-1 ring-purple-500/20 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[360px] sm:max-w-[90vw] sm:max-h-none sm:p-4" data-testid="notification-dropdown">
                    <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-widest text-zinc-500">Eregon Inbox</p>
                            <p className="text-[11px] text-zinc-600 sm:hidden">{count} unread</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={markAll} className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200">Mark read</button>
                            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg border border-white/10 bg-[#15151a] flex items-center justify-center"><X className="w-4 h-4 text-zinc-400" /></button>
                        </div>
                    </div>
                    <div className="max-h-[min(400px,calc(100vh-244px))] overflow-y-auto overscroll-contain space-y-2 pr-1 sm:max-h-[400px]">
                        {items.length === 0 && <p className="text-sm text-zinc-500 py-5 sm:py-6 lg:py-8 text-center">No notifications yet.</p>}
                        {items.slice(0, 12).map(n => {
                            const Icon = ICONS[n.category] || Sparkles;
                            const color = COLORS[n.category] || COLORS.system;
                            return (
                                <div key={n.id} className={`p-3 rounded-xl border shadow-[0_10px_30px_rgba(0,0,0,0.35)] ${n.read ? "border-white/10 bg-[#0b0b10]" : "border-purple-500/35 bg-[#15101f]"}`}>
                                    <div className="flex gap-3">
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                                            <Icon className="w-4 h-4" strokeWidth={1.6} />
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{n.title}</p>
                                            <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed break-words">{n.body}</p>
                                            <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-widest">{n.category}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <Link to="/dashboard/notifications" onClick={() => setOpen(false)} className="block text-center text-xs text-purple-300 hover:text-purple-200 mt-3 py-2 border-t border-white/5">
                        View all notifications →
                    </Link>
                </div>
            )}
        </div>
    );
}
