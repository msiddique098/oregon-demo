import React, { useEffect, useState, useMemo } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { Badge } from "../components/ui-eregon";
import { api } from "../lib/api";
import { Filter, ArrowUpRight, ArrowDownRight, History, Search } from "lucide-react";

const TYPE_LABELS = {
    admin_credit: { label: "Admin Credit", color: "emerald", up: true },
    admin_debit:  { label: "Admin Debit",  color: "rose", up: false },
    admin_adjust_daily_profit: { label: "Legacy Daily Adjust", color: "purple", up: true },
    admin_adjust_total_earnings: { label: "Earnings Adjust", color: "purple", up: true },
    admin_adjust_referral: { label: "Referral Adjust", color: "purple", up: true },
    withdrawal_debit: { label: "Withdrawal", color: "rose", up: false },
    withdrawal_refund: { label: "Withdrawal Refund", color: "emerald", up: true },
    deposit_credit: { label: "Deposit", color: "emerald", up: true },
    deposit_bonus_30: { label: "30% Deposit Bonus", color: "gold", up: true },
    bulk_bonus: { label: "Bulk Bonus", color: "gold", up: true },
    admin_user_reward: { label: "Admin Reward", color: "gold", up: true },
    registration_code_reward: { label: "Signup Code Reward", color: "gold", up: true },
    referral_commission: { label: "Referral Bonus", color: "gold", up: true },
    task_reward: { label: "Task Reward", color: "gold", up: true },
    membership_bonus: { label: "Membership Bonus", color: "gold", up: true },
    spin_reward: { label: "Spin Reward", color: "gold", up: true },
    trading_buy: { label: "Trading Buy", color: "rose", up: false },
    trading_sell: { label: "Trading Sell", color: "emerald", up: true },
    options_stake: { label: "Options Stake", color: "rose", up: false },
    options_payout: { label: "Options Payout", color: "emerald", up: true },
    achievement_reward: { label: "Achievement Reward", color: "gold", up: true },
    first_task_reward: { label: "First Task Reward", color: "gold", up: true },
};

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const getTxDelta = (tx) => {
    if (isFiniteNumber(tx.before_balance) && isFiniteNumber(tx.after_balance)) {
        return Number(tx.after_balance) - Number(tx.before_balance);
    }
    const fallbackUp = TYPE_LABELS[tx.type]?.up ?? true;
    const amount = Math.abs(Number(tx.amount || 0));
    return fallbackUp ? amount : -amount;
};

const getTxMeta = (tx) => {
    const delta = getTxDelta(tx);
    const fallback = TYPE_LABELS[tx.type] || {
        label: tx.type?.replaceAll("_", " ") || "Transaction",
        color: delta >= 0 ? "emerald" : "rose",
        up: delta >= 0,
    };
    return { ...fallback, up: delta >= 0 };
};

const formatAmount = (value) => Math.abs(Number(value || 0)).toLocaleString(undefined, {
    maximumFractionDigits: 8,
});

export default function Transactions() {
    const [items, setItems] = useState([]);
    const [typeFilter, setTypeFilter] = useState("");
    const [coinFilter, setCoinFilter] = useState("");
    const [search, setSearch] = useState("");

    const load = () => {
        const params = {};
        if (typeFilter) params.type_filter = typeFilter;
        if (coinFilter) params.coin = coinFilter;
        api.get("/user/transactions", { params }).then(r => setItems(r.data));
    };
    useEffect(load, [typeFilter, coinFilter]);

    const filtered = useMemo(() => {
        if (!search) return items;
        const s = search.toLowerCase();
        return items.filter(t =>
            (t.note || "").toLowerCase().includes(s) ||
            (t.reference_id || "").toLowerCase().includes(s) ||
            t.type.toLowerCase().includes(s)
        );
    }, [items, search]);

    const totals = useMemo(() => {
        let inflow = 0, outflow = 0;
        items.forEach(t => {
            const delta = getTxDelta(t);
            if (delta >= 0) inflow += Math.abs(delta);
            else outflow += Math.abs(delta);
        });
        return { inflow, outflow };
    }, [items]);

    return (
        <DashboardLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Eregon Wallet Ledger</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Transaction History</h1>

            <div className="grid sm:grid-cols-3 gap-4 mt-6">
                <div className="glass-strong p-5"><p className="text-xs uppercase tracking-widest text-zinc-500">Total Inflow</p><p className="text-2xl font-display font-semibold text-emerald-300 mt-1">+{formatAmount(totals.inflow)}</p></div>
                <div className="glass-strong p-5"><p className="text-xs uppercase tracking-widest text-zinc-500">Total Outflow</p><p className="text-2xl font-display font-semibold text-rose-300 mt-1">-{formatAmount(totals.outflow)}</p></div>
                <div className="glass-strong p-5"><p className="text-xs uppercase tracking-widest text-zinc-500">Entries</p><p className="text-2xl font-display font-semibold gradient-text-gold mt-1">{items.length}</p></div>
            </div>

            <div className="glass-strong p-4 mt-6 flex flex-wrap items-center gap-3">
                <Filter className="w-4 h-4 text-zinc-500" />
                <select className="input-eregon w-auto py-2 px-3 text-xs" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} data-testid="tx-type-filter">
                    <option value="">All types</option>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select className="input-eregon w-auto py-2 px-3 text-xs" value={coinFilter} onChange={e => setCoinFilter(e.target.value)}>
                    <option value="">All coins</option><option>USDT</option><option>BTC</option><option>ETH</option><option>BNB</option>
                </select>
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input className="input-eregon pl-9 py-2 text-xs" placeholder="Search notes or reference id..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="glass-strong mt-4 overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="p-10 text-center text-zinc-500"><History className="w-8 h-8 mx-auto mb-3 opacity-40" /><p className="text-sm">No transactions yet.</p></div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {filtered.map(t => {
                            const delta = getTxDelta(t);
                            const tl = getTxMeta(t);
                            return (
                                <div key={t.id} className="px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-all">
                                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tl.up ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
                                        {tl.up ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold capitalize">{tl.label}</p>
                                            <Badge color={tl.color}>{t.coin}</Badge>
                                        </div>
                                        <p className="text-xs text-zinc-500 mt-1 truncate">{t.note || "—"}</p>
                                        {t.reference_id && <p className="text-[10px] text-zinc-600 mt-0.5 truncate">ref: {t.reference_id}</p>}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`text-sm font-semibold ${tl.up ? "text-emerald-300" : "text-rose-300"}`}>
                                            {tl.up ? "+" : "-"}{formatAmount(delta || t.amount)}
                                        </p>
                                        <p className="text-[10px] text-zinc-500 mt-0.5">Bal: {Number(t.after_balance || 0).toLocaleString()}</p>
                                        <p className="text-[10px] text-zinc-600 mt-0.5">{new Date(t.created_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
