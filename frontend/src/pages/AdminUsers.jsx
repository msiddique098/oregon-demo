import React, { useEffect, useState, useCallback } from "react";
import AdminLayout from "../components/AdminLayout";
import { Badge } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { Search, Edit3, Trash2, X, Save, RefreshCw } from "lucide-react";

const initialFilters = {
    min_balance: "",
    max_balance: "",
    signup_from: "",
    signup_to: "",
    activity_from: "",
    activity_to: "",
    sort_by: "created_at",
    sort_dir: "desc",
};

function dateParam(value, endOfDay = false) {
    if (!value) return undefined;
    return `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`;
}

function formatDate(value) {
    if (!value) return "Never";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Never";
    return date.toLocaleString();
}

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [packages, setPackages] = useState([]);
    const [q, setQ] = useState("");
    const [filters, setFilters] = useState(initialFilters);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({});
    const [err, setErr] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setErr("");
        try {
            const params = {
                limit: 5000,
                sort_by: filters.sort_by,
                sort_dir: filters.sort_dir,
            };
            if (q.trim()) params.q = q.trim();
            if (filters.min_balance !== "") params.min_balance = filters.min_balance;
            if (filters.max_balance !== "") params.max_balance = filters.max_balance;
            if (filters.signup_from) params.signup_from = dateParam(filters.signup_from);
            if (filters.signup_to) params.signup_to = dateParam(filters.signup_to, true);
            if (filters.activity_from) params.activity_from = dateParam(filters.activity_from);
            if (filters.activity_to) params.activity_to = dateParam(filters.activity_to, true);
            const { data } = await api.get("/admin/users", { params });
            setUsers(Array.isArray(data) ? data : []);
        } catch (e) {
            setErr(formatApiError(e));
        } finally {
            setLoading(false);
        }
    }, [q, filters]);

    useEffect(() => {
        load();
        api.get("/admin/packages").then(r => setPackages(r.data)).catch(() => setPackages([]));
    }, [load]);

    const startEdit = (u) => {
        setEditing(u.id);
        setForm({
            name: u.name, coin_symbol: u.coin_symbol, balance: u.balance, daily_profit: u.daily_profit,
            total_earnings: u.total_earnings, referral_earnings: u.referral_earnings, task_progress: u.task_progress,
            tasks_completed: u.tasks_completed, tasks_pending: u.tasks_pending, commission_rate: u.commission_rate,
            status: u.status, membership_id: u.membership_id || "", withdrawal_processing_hours: u.withdrawal_processing_hours,
        });
    };

    const save = async () => {
        setErr("");
        try {
            const payload = { ...form };
            if (payload.membership_id === "") payload.membership_id = null;
            ["balance", "daily_profit", "total_earnings", "referral_earnings", "task_progress", "commission_rate"].forEach(k => { if (payload[k] !== undefined) payload[k] = parseFloat(payload[k]); });
            ["tasks_completed", "tasks_pending", "withdrawal_processing_hours"].forEach(k => { if (payload[k] !== undefined) payload[k] = parseInt(payload[k]); });
            await api.patch(`/admin/users/${editing}`, payload);
            setEditing(null);
            load();
        } catch (e) { setErr(formatApiError(e)); }
    };

    const del = async (id) => {
        if (!window.confirm("Delete this user?")) return;
        await api.delete(`/admin/users/${id}`);
        load();
    };

    const setFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
    const clearFilters = () => {
        setQ("");
        setFilters(initialFilters);
    };

    return (
        <AdminLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">User Management</p>
                    <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Eregon Members</h1>
                </div>
                <div className="relative w-full sm:w-auto">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input className="input-eregon pl-9 w-full sm:w-80" placeholder="Search by name, email, or user ID" value={q} onChange={e => setQ(e.target.value)} data-testid="admin-user-search" />
                </div>
            </div>

            <div className="glass-strong mt-6 p-4">
                <div className="grid md:grid-cols-4 xl:grid-cols-8 gap-3">
                    <FilterField label="Min balance" type="number" value={filters.min_balance} onChange={v => setFilter("min_balance", v)} />
                    <FilterField label="Max balance" type="number" value={filters.max_balance} onChange={v => setFilter("max_balance", v)} />
                    <FilterField label="Signup from" type="date" value={filters.signup_from} onChange={v => setFilter("signup_from", v)} />
                    <FilterField label="Signup to" type="date" value={filters.signup_to} onChange={v => setFilter("signup_to", v)} />
                    <FilterField label="Active from" type="date" value={filters.activity_from} onChange={v => setFilter("activity_from", v)} />
                    <FilterField label="Active to" type="date" value={filters.activity_to} onChange={v => setFilter("activity_to", v)} />
                    <div>
                        <label className="text-xs text-zinc-500 uppercase tracking-widest">Sort by</label>
                        <select className="input-eregon mt-1" value={filters.sort_by} onChange={e => setFilter("sort_by", e.target.value)}>
                            <option value="created_at">Signup date</option>
                            <option value="last_active">Latest activity</option>
                            <option value="balance">Balance</option>
                            <option value="email">Email</option>
                            <option value="name">Name</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-zinc-500 uppercase tracking-widest">Direction</label>
                        <select className="input-eregon mt-1" value={filters.sort_dir} onChange={e => setFilter("sort_dir", e.target.value)}>
                            <option value="desc">Newest/highest</option>
                            <option value="asc">Oldest/lowest</option>
                        </select>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-3 mt-4">
                    <p className="text-xs text-zinc-500">{loading ? "Loading users..." : `${users.length.toLocaleString()} users shown`}</p>
                    <div className="flex gap-2">
                        <button onClick={clearFilters} className="btn-ghost py-2 px-3 text-xs"><X className="w-3.5 h-3.5" /> Clear</button>
                        <button onClick={load} className="btn-ghost py-2 px-3 text-xs"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
                    </div>
                </div>
            </div>

            <div className="glass-strong mt-6 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[980px]">
                        <thead className="bg-black/40">
                            <tr className="text-xs uppercase tracking-widest text-zinc-500">
                                <th className="text-left px-5 py-3">User</th><th className="text-left">Coin</th><th className="text-left">Balance</th><th className="text-left">Signup</th><th className="text-left">Latest activity</th><th className="text-left">Spins</th><th className="text-left">Tasks</th><th className="text-left">Membership</th><th className="text-left">Status</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                                    <td className="px-5 py-3"><div><p className="font-medium">{u.name}</p><p className="text-xs text-zinc-500">{u.email}</p><p className="text-[10px] text-amber-300/80 break-all">ID: {u.id}</p></div></td>
                                    <td>{u.coin_symbol}</td>
                                    <td className="gradient-text-gold font-semibold">{Number(u.balance || 0).toLocaleString()}</td>
                                    <td className="text-xs text-zinc-400">{formatDate(u.created_at)}</td>
                                    <td className="text-xs text-zinc-400">{formatDate(u.last_active)}</td>
                                    <td className="text-emerald-300">{Number(u.spin_tokens || 0).toLocaleString()}</td>
                                    <td>{Number(u.tasks_completed || 0)}/{Number(u.tasks_completed || 0) + Number(u.tasks_pending || 0)}</td>
                                    <td><Badge color="purple">{u.membership_name || "Free"}</Badge></td>
                                    <td><Badge color={u.status === "active" ? "emerald" : "rose"}>{u.status}</Badge></td>
                                    <td className="pr-5">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => startEdit(u)} className="btn-ghost py-1 px-2 text-xs" data-testid={`edit-user-${u.email}`}><Edit3 className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => del(u.id)} className="btn-ghost py-1 px-2 text-xs hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && <tr><td colSpan={10} className="text-center py-10 text-zinc-500">{loading ? "Loading users..." : "No users found."}</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
            {err && !editing && <p className="text-sm text-rose-400 mt-3">{err}</p>}

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-strong max-w-2xl w-full p-6 max-h-[90vh] overflow-auto">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <h3 className="font-display text-xl">Edit user</h3>
                            <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-zinc-400" /></button>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <Field label="Name" value={form.name} onChange={v => setForm({...form, name: v})} />
                            <Field label="Coin symbol" value={form.coin_symbol} onChange={v => setForm({...form, coin_symbol: v})} />
                            <Field label="Balance" type="number" value={form.balance} onChange={v => setForm({...form, balance: v})} />
                            <Field label="Total Earnings" type="number" value={form.total_earnings} onChange={v => setForm({...form, total_earnings: v})} />
                            <Field label="Referral Earnings" type="number" value={form.referral_earnings} onChange={v => setForm({...form, referral_earnings: v})} />
                            <Field label="Task Progress %" type="number" value={form.task_progress} onChange={v => setForm({...form, task_progress: v})} />
                            <Field label="Tasks Completed" type="number" value={form.tasks_completed} onChange={v => setForm({...form, tasks_completed: v})} />
                            <Field label="Tasks Pending" type="number" value={form.tasks_pending} onChange={v => setForm({...form, tasks_pending: v})} />
                            <Field label="Commission Rate %" type="number" value={form.commission_rate} onChange={v => setForm({...form, commission_rate: v})} />
                            <Field label="Withdrawal Hours" type="number" value={form.withdrawal_processing_hours} onChange={v => setForm({...form, withdrawal_processing_hours: v})} />
                            <div>
                                <label className="text-xs text-zinc-500 uppercase tracking-widest">Membership</label>
                                <select className="input-eregon mt-1" value={form.membership_id || ""} onChange={e => setForm({...form, membership_id: e.target.value})}>
                                    <option value="">None / Free</option>
                                    {packages.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-zinc-500 uppercase tracking-widest">Status</label>
                                <select className="input-eregon mt-1" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                                    <option value="active">Active</option><option value="suspended">Suspended</option>
                                </select>
                            </div>
                        </div>
                        {err && <p className="text-sm text-rose-400 mt-3">{err}</p>}
                        <div className="flex justify-end gap-2 mt-5">
                            <button onClick={() => setEditing(null)} className="btn-ghost"><X className="w-4 h-4" /> Cancel</button>
                            <button onClick={save} className="btn-eregon"><Save className="w-4 h-4" /> Save</button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}

function Field({ label, value, onChange, type = "text" }) {
    return <div><label className="text-xs text-zinc-500 uppercase tracking-widest">{label}</label><input className="input-eregon mt-1" type={type} value={value ?? ""} onChange={e => onChange(e.target.value)} /></div>;
}

function FilterField({ label, value, onChange, type = "text" }) {
    return <div><label className="text-xs text-zinc-500 uppercase tracking-widest">{label}</label><input className="input-eregon mt-1" type={type} value={value} onChange={e => onChange(e.target.value)} /></div>;
}
