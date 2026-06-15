import React, { useEffect, useState, useMemo } from "react";
import AdminLayout from "../components/AdminLayout";
import { Badge, Card } from "../components/ui-eregon";
import { API, api, formatApiError } from "../lib/api";
import { Download, Filter, Gift, History, Search } from "lucide-react";
import { toast } from "sonner";

const TYPE_OPTIONS = [
    "admin_credit", "admin_debit", "admin_adjust_daily_profit", "admin_adjust_total_earnings",
    "admin_adjust_referral", "withdrawal_debit", "withdrawal_refund", "deposit_credit",
    "bulk_bonus", "admin_user_reward", "registration_code_reward", "referral_commission", "task_reward", "membership_bonus",
    "spin_reward", "achievement_reward", "first_task_reward",
];

export function AdminFinancialLogs() {
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [f, setF] = useState({ user_id: "", type: "", coin: "", date_from: "", date_to: "" });
    const [search, setSearch] = useState("");
    const [rewardForm, setRewardForm] = useState({ user_identifier: "", amount: "", coin: "USDT", message: "" });
    const [rewardSaving, setRewardSaving] = useState(false);

    const load = () => {
        const params = {};
        if (f.user_id) params.user_id = f.user_id;
        if (f.type) params.type_filter = f.type;
        if (f.coin) params.coin = f.coin;
        if (f.date_from) params.date_from = f.date_from;
        if (f.date_to) params.date_to = f.date_to;
        api.get("/admin/transactions", { params }).then(r => setItems(r.data));
    };
    useEffect(load, [f]);
    useEffect(() => { api.get("/admin/users").then(r => setUsers(r.data)); }, []);

    const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);

    const filtered = useMemo(() => {
        if (!search) return items;
        const s = search.toLowerCase();
        return items.filter(t =>
            (t.note || "").toLowerCase().includes(s) ||
            (t.reference_id || "").toLowerCase().includes(s) ||
            (userMap[t.user_id]?.email || "").toLowerCase().includes(s)
        );
    }, [items, search, userMap]);

    const exportCsv = async () => {
        const token = localStorage.getItem("eregon_token");
        const params = new URLSearchParams();
        if (f.user_id) params.set("user_id", f.user_id);
        if (f.type) params.set("type_filter", f.type);
        if (f.coin) params.set("coin", f.coin);
        const res = await fetch(`${API}/admin/transactions.csv?${params}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `eregon-transactions-${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const grantUserReward = async (e) => {
        e.preventDefault();
        setRewardSaving(true);
        try {
            await api.post("/admin/user-rewards", {
                user_identifier: rewardForm.user_identifier.trim(),
                amount: Number(rewardForm.amount),
                coin: rewardForm.coin || "USDT",
                message: rewardForm.message.trim() || "Manual reward from Eregon Admin",
            });
            toast.success("Reward credited and ledger entry created");
            setRewardForm({ user_identifier: "", amount: "", coin: "USDT", message: "" });
            load();
        } catch (err) { toast.error(formatApiError(err)); }
        finally { setRewardSaving(false); }
    };

    return (
        <AdminLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-3">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Financial Logs</p>
                    <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Eregon Ledger</h1>
                </div>
                <button onClick={exportCsv} className="btn-gold" data-testid="export-csv-btn"><Download className="w-4 h-4" /> Export CSV</button>
            </div>

            <Card className="mt-6 border-amber-500/20">
                <form onSubmit={grantUserReward} className="grid lg:grid-cols-[1.2fr_.6fr_.5fr_1.4fr_auto] gap-3 items-end">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-amber-400/80 mb-2">Manual user reward</p>
                        <p className="text-xs text-zinc-500 mb-2">Available to every admin. The user receives the message as a notification and ledger note.</p>
                        <input className="input-eregon" placeholder="User ID, email, exact name, or referral code" value={rewardForm.user_identifier} onChange={e => setRewardForm({ ...rewardForm, user_identifier: e.target.value })} required />
                    </div>
                    <input className="input-eregon" type="number" min="0.01" step="0.01" placeholder="Amount" value={rewardForm.amount} onChange={e => setRewardForm({ ...rewardForm, amount: e.target.value })} required />
                    <select className="input-eregon" value={rewardForm.coin} onChange={e => setRewardForm({ ...rewardForm, coin: e.target.value })}>
                        <option>USDT</option><option>BTC</option><option>ETH</option><option>BNB</option>
                    </select>
                    <input className="input-eregon" placeholder="Notification and ledger message" value={rewardForm.message} onChange={e => setRewardForm({ ...rewardForm, message: e.target.value })} />
                    <button disabled={rewardSaving} className={`btn-gold ${rewardSaving ? "opacity-60" : ""}`}><Gift className="w-4 h-4" /> {rewardSaving ? "Crediting..." : "Credit Reward"}</button>
                </form>
            </Card>

            <div className="glass-strong p-4 mt-6 flex flex-wrap items-center gap-2">
                <Filter className="w-4 h-4 text-zinc-500 ml-2" />
                <select className="input-eregon w-auto py-2 px-3 text-xs" value={f.user_id} onChange={e => setF({...f, user_id: e.target.value})}>
                    <option value="">All users</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                </select>
                <select className="input-eregon w-auto py-2 px-3 text-xs" value={f.type} onChange={e => setF({...f, type: e.target.value})}>
                    <option value="">All types</option>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="input-eregon w-auto py-2 px-3 text-xs" value={f.coin} onChange={e => setF({...f, coin: e.target.value})}>
                    <option value="">All coins</option><option>USDT</option><option>BTC</option><option>ETH</option><option>BNB</option>
                </select>
                <input type="date" className="input-eregon w-auto py-2 px-3 text-xs" value={f.date_from} onChange={e => setF({...f, date_from: e.target.value})} />
                <input type="date" className="input-eregon w-auto py-2 px-3 text-xs" value={f.date_to} onChange={e => setF({...f, date_to: e.target.value})} />
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input className="input-eregon pl-9 py-2 text-xs" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>

            <div className="glass-strong mt-4 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead className="bg-black/40">
                            <tr className="text-xs uppercase text-zinc-500">
                                <th className="text-left px-5 py-3">User</th><th className="text-left">Type</th><th className="text-left">Amount</th><th className="text-left">Coin</th><th className="text-left">Before → After</th><th className="text-left">Note</th><th className="text-left">When</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(t => {
                                const u = userMap[t.user_id];
                                return (
                                    <tr key={t.id} className="border-t border-white/5">
                                        <td className="px-5 py-3"><p className="text-xs">{u?.email || t.user_id.slice(0, 8)}</p></td>
                                        <td><Badge color="purple">{t.type}</Badge></td>
                                        <td className="gradient-text-gold font-semibold">{t.amount}</td>
                                        <td>{t.coin}</td>
                                        <td className="text-zinc-400 text-xs">{t.before_balance} → {t.after_balance}</td>
                                        <td className="text-zinc-400 text-xs truncate max-w-[200px]">{t.note}</td>
                                        <td className="text-zinc-500 text-xs">{new Date(t.created_at).toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                            {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-zinc-500"><History className="w-6 h-6 mx-auto mb-2 opacity-40" /> No transactions found.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}

export function AdminActivity() {
    const [items, setItems] = useState([]);
    const [users, setUsers] = useState([]);
    const [userId, setUserId] = useState("");

    useEffect(() => { api.get("/admin/users").then(r => setUsers(r.data)); }, []);
    useEffect(() => {
        const params = userId ? { user_id: userId } : {};
        api.get("/admin/activity", { params }).then(r => setItems(r.data));
    }, [userId]);

    const userMap = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])), [users]);

    return (
        <AdminLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-3">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Activity Logs</p>
                    <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">User Activity</h1>
                </div>
                <select className="input-eregon w-auto py-2 px-3 text-xs" value={userId} onChange={e => setUserId(e.target.value)}>
                    <option value="">All users</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.email}</option>)}
                </select>
            </div>
            <div className="glass-strong mt-6 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead className="bg-black/40"><tr className="text-xs uppercase text-zinc-500">
                            <th className="text-left px-5 py-3">User</th><th className="text-left">Action</th><th className="text-left">IP</th><th className="text-left">User Agent</th><th className="text-left">When</th>
                        </tr></thead>
                        <tbody>
                            {items.map(a => (
                                <tr key={a.id} className="border-t border-white/5">
                                    <td className="px-5 py-3 text-xs">{userMap[a.user_id]?.email || a.user_id.slice(0, 8)}</td>
                                    <td><Badge color="emerald">{a.action}</Badge></td>
                                    <td className="text-zinc-400 text-xs">{a.ip}</td>
                                    <td className="text-zinc-500 text-xs truncate max-w-[300px]">{a.user_agent}</td>
                                    <td className="text-zinc-500 text-xs">{new Date(a.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                            {items.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-zinc-500">No activity yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}
