import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { Badge } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { Trash2, Plus, Save, X, Edit3 } from "lucide-react";

const EMPTY = { name: "", tier: "Basic", investment: 100, daily_profit_pct: 0, commission_boost_pct: 0, task_boost_pct: 0, duration_days: 30, badge_color: "purple", perks: [], priority_withdrawal_hours: 24, spin_tokens: 2, spin_reward_queue: "" };

function spinValuesToText(values) {
    return Array.isArray(values) ? values.join(",") : (values || "");
}

function planRewardTotal(p) {
    const fromServer = Number(p.plan_spin_reward_total || 0);
    return fromServer > 0 ? fromServer : Number(p.investment || 0) * 0.01;
}

export function AdminPackages() {
    const [items, setItems] = useState([]);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(EMPTY);
    const [err, setErr] = useState("");
    const load = () => api.get("/admin/packages").then(r => setItems(r.data));
    useEffect(() => { load(); }, []);

    const save = async () => {
        setErr("");
        try {
            const payload = { ...form, perks: typeof form.perks === "string" ? form.perks.split("\n").filter(Boolean) : form.perks };
            ["investment", "daily_profit_pct", "commission_boost_pct", "task_boost_pct"].forEach(k => payload[k] = parseFloat(payload[k] || 0));
            payload.daily_profit_pct = 0;
            payload.spin_tokens = parseInt(payload.spin_tokens || 0);
            delete payload.spin_reward_queue;
            ["duration_days", "priority_withdrawal_hours"].forEach(k => payload[k] = parseInt(payload[k] || 0));
            if (editing === "new") await api.post("/admin/packages", payload);
            else await api.patch(`/admin/packages/${editing}`, payload);
            setEditing(null); setForm(EMPTY); load();
        } catch (e) { setErr(formatApiError(e)); }
    };

    const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/admin/packages/${id}`); load(); };

    return (
        <AdminLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-3">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Membership Packages</p>
                    <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Eregon Plans</h1>
                </div>
                <button className="btn-gold" onClick={() => { setForm(EMPTY); setEditing("new"); }} data-testid="add-package-btn"><Plus className="w-4 h-4" /> New Package</button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
                {items.map(p => (
                    <div key={p.id} className="glass-strong p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div>
                                <Badge color="gold">{p.tier}</Badge>
                                <h3 className="mt-2 font-display text-xl">{p.name}</h3>
                            </div>
                            <p className="font-display text-2xl gradient-text-gold">${p.investment}</p>
                        </div>
                        <ul className="text-sm text-zinc-400 mt-3 space-y-1">
                            <li>Plan spin pool: <span className="text-emerald-300">${planRewardTotal(p).toFixed(2)} ({Number(p.plan_spin_reward_pct || 1)}%)</span></li>
                            <li>Commission +{p.commission_boost_pct}% · Task +{p.task_boost_pct}%</li>
                            <li>{p.duration_days} days · WD {p.priority_withdrawal_hours}h</li>
                            <li><span className="text-amber-300">{p.spin_tokens || 0} spins</span> included with this plan</li>
                            <li className="text-xs text-zinc-500">Admin outcomes configured: {(p.spin_reward_queue || []).length || 0}</li>
                        </ul>
                        <div className="flex flex-wrap gap-2 mt-4">
                            <button onClick={() => { setEditing(p.id); setForm({ ...p, perks: (p.perks || []).join("\n"), spin_reward_queue: spinValuesToText(p.spin_reward_queue) }); }} className="btn-ghost text-xs py-1.5 px-3"><Edit3 className="w-3.5 h-3.5" /> Edit</button>
                            <button onClick={() => del(p.id)} className="btn-ghost text-xs py-1.5 px-3 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                ))}
            </div>

            {editing && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="glass-strong max-w-2xl w-full p-6 max-h-[90vh] overflow-auto">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <h3 className="font-display text-xl">{editing === "new" ? "New Package" : "Edit Package"}</h3>
                            <button onClick={() => setEditing(null)}><X className="w-5 h-5 text-zinc-400" /></button>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <F label="Name" v={form.name} on={v => setForm({...form, name: v})} />
                            <F label="Tier" v={form.tier} on={v => setForm({...form, tier: v})} />
                            <F label="Investment" type="number" v={form.investment} on={v => setForm({...form, investment: v})} />
                            <F label="Commission Boost %" type="number" v={form.commission_boost_pct} on={v => setForm({...form, commission_boost_pct: v})} />
                            <F label="Task Boost %" type="number" v={form.task_boost_pct} on={v => setForm({...form, task_boost_pct: v})} />
                            <F label="Duration (days)" type="number" v={form.duration_days} on={v => setForm({...form, duration_days: v})} />
                            <F label="Withdrawal Hours" type="number" v={form.priority_withdrawal_hours} on={v => setForm({...form, priority_withdrawal_hours: v})} />
                            <F label="Plan Spins" type="number" v={form.spin_tokens} on={v => setForm({...form, spin_tokens: v})} />
                            <F label="Badge Color" v={form.badge_color} on={v => setForm({...form, badge_color: v})} />
                            <label className="sm:col-span-2 block">
                                <span className="text-xs text-zinc-500 uppercase tracking-widest">Server-calculated deterministic spin values</span>
                                <textarea className="input-eregon mt-1 min-h-[90px]" readOnly value={spinValuesToText(form.spin_reward_queue)} placeholder="Saved plans show calculated values here" />
                                <span className="text-[11px] text-zinc-500">Set only the spin count. The backend calculates outcomes so their total is exactly 1% of the plan value.</span>
                            </label>
                        </div>
                        <label className="block mt-3">
                            <span className="text-xs text-zinc-500 uppercase tracking-widest">Perks (one per line)</span>
                            <textarea className="input-eregon mt-1 min-h-[100px]" value={typeof form.perks === "string" ? form.perks : form.perks.join("\n")} onChange={e => setForm({...form, perks: e.target.value})} />
                        </label>
                        {err && <p className="text-sm text-rose-400 mt-2">{err}</p>}
                        <div className="flex justify-end gap-2 mt-5">
                            <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
                            <button onClick={save} className="btn-gold"><Save className="w-4 h-4" /> Save</button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}

function F({ label, v, on, type = "text" }) {
    return (
        <div>
            <label className="text-xs text-zinc-500 uppercase tracking-widest">{label}</label>
            <input type={type} step="any" className="input-eregon mt-1" value={v ?? ""} onChange={e => on(e.target.value)} />
        </div>
    );
}

export function AdminWallets() {
    const [items, setItems] = useState([]);
    const [form, setForm] = useState({ coin: "USDT", network: "TRC20", address: "", note: "" });
    const load = () => api.get("/admin/wallets").then(r => setItems(r.data));
    useEffect(() => { load(); }, []);
    const add = async (e) => { e.preventDefault(); await api.post("/admin/wallets", form); setForm({ coin: "USDT", network: "TRC20", address: "", note: "" }); load(); };
    const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/admin/wallets/${id}`); load(); };
    return (
        <AdminLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Deposit Wallets</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Wallet Vaults</h1>
            <form className="glass-strong p-6 mt-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-3" onSubmit={add}>
                <input className="input-eregon" placeholder="Coin" value={form.coin} onChange={e => setForm({...form, coin: e.target.value})} />
                <input className="input-eregon" placeholder="Network" value={form.network} onChange={e => setForm({...form, network: e.target.value})} />
                <input className="input-eregon lg:col-span-2" placeholder="Address" value={form.address} onChange={e => setForm({...form, address: e.target.value})} required />
                <input className="input-eregon" placeholder="Note" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
                <button className="btn-gold lg:col-span-5"><Plus className="w-4 h-4" /> Add Wallet</button>
            </form>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {items.map(w => (
                    <div key={w.id} className="glass-strong p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                            <Badge color="gold">{w.coin}</Badge>
                            <span className="text-xs text-zinc-500">{w.network}</span>
                        </div>
                        <code className="text-xs text-amber-200 break-all block">{w.address}</code>
                        {w.note && <p className="text-xs text-zinc-400 mt-2">{w.note}</p>}
                        <button onClick={() => del(w.id)} className="btn-ghost text-xs py-1.5 px-3 mt-3 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                    </div>
                ))}
            </div>
        </AdminLayout>
    );
}

export function AdminWithdrawals() {
    const [items, setItems] = useState([]);
    const [filter, setFilter] = useState("");
    const load = () => api.get("/admin/withdrawals", { params: filter ? { status_filter: filter } : {} }).then(r => setItems(r.data));
    useEffect(() => { load(); }, [filter]);
    const decide = async (id, status, processing_hours) => {
        await api.patch(`/admin/withdrawals/${id}`, { status, processing_hours: processing_hours ? parseInt(processing_hours) : undefined });
        load();
    };
    return (
        <AdminLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-3">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Withdrawals</p>
                    <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Approval Center</h1>
                </div>
                <select className="input-eregon w-40" value={filter} onChange={e => setFilter(e.target.value)}>
                    <option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
                </select>
            </div>
            <div className="glass-strong mt-6 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead className="bg-black/40"><tr className="text-xs uppercase text-zinc-500">
                            <th className="text-left px-5 py-3">User</th><th className="text-left">Amount</th><th className="text-left">Coin</th><th className="text-left">Address</th><th className="text-left">Status</th><th className="text-left">SLA</th><th></th>
                        </tr></thead>
                        <tbody>
                            {items.map(w => (
                                <tr key={w.id} className="border-t border-white/5">
                                    <td className="px-5 py-3"><p>{w.user_name}</p><p className="text-xs text-zinc-500">{w.user_email}</p></td>
                                    <td className="gradient-text-gold font-semibold">{w.amount}</td>
                                    <td>{w.coin}</td>
                                    <td className="truncate max-w-[180px]">{w.address}</td>
                                    <td><Badge color={w.status === "approved" ? "emerald" : w.status === "rejected" ? "rose" : "gold"}>{w.status}</Badge></td>
                                    <td>
                                        <input className="input-eregon w-16 py-1" defaultValue={w.processing_hours} onBlur={(e) => decide(w.id, w.status, e.target.value)} />
                                    </td>
                                    <td className="pr-5">
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <button onClick={() => decide(w.id, "approved")} className="btn-ghost text-xs py-1 px-2 hover:bg-emerald-500/10 hover:text-emerald-300" data-testid={`wd-approve-${w.id}`}>Approve</button>
                                            <button onClick={() => decide(w.id, "rejected")} className="btn-ghost text-xs py-1 px-2 hover:bg-rose-500/10 hover:text-rose-300">Reject</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-zinc-500">No withdrawals.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}

export function AdminDeposits() {
    const [items, setItems] = useState([]);
    const [spinInputs, setSpinInputs] = useState({});
    const load = () => api.get("/admin/deposits").then(r => setItems(r.data));
    useEffect(() => { load(); }, []);
    const decide = async (id, status) => {
        const payload = { status };
        if (status === "approved") payload.deterministic_spin_values = parseSpinValues(spinInputs[id]);
        await api.patch(`/admin/deposits/${id}`, payload);
        load();
    };
    return (
        <AdminLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Deposits</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Eregon Wallet Inflows</h1>
            <div className="glass-strong mt-6 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                        <thead className="bg-black/40"><tr className="text-xs uppercase text-zinc-500">
                            <th className="text-left px-5 py-3">User</th><th className="text-left">Amount</th><th className="text-left">Coin</th><th className="text-left">Tx</th><th className="text-left">Proof</th><th className="text-left">Spin Values</th><th className="text-left">Status</th><th></th>
                        </tr></thead>
                        <tbody>
                            {items.map(d => (
                                <tr key={d.id} className="border-t border-white/5">
                                    <td className="px-5 py-3">{d.user_email}</td>
                                    <td className="gradient-text-gold">{d.amount}</td>
                                    <td>{d.coin}</td>
                                    <td className="truncate max-w-[140px] text-zinc-400">{d.tx_hash || "—"}</td>
                                    <td>{d.proof_data_url ? <a href={d.proof_data_url} target="_blank" rel="noreferrer" className="text-purple-300 underline text-xs">view</a> : "—"}</td>
                                    <td className="min-w-[180px]">
                                        {d.status === "pending" ? (
                                            <input className="input-eregon text-xs py-2" placeholder="0.50,25,5" value={spinInputs[d.id] || ""} onChange={e => setSpinInputs({...spinInputs, [d.id]: e.target.value})} />
                                        ) : <span className="text-xs text-zinc-500">locked</span>}
                                    </td>
                                    <td><Badge color={d.status === "approved" ? "emerald" : d.status === "rejected" ? "rose" : "gold"}>{d.status}</Badge></td>
                                    <td className="pr-5">
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <button onClick={() => decide(d.id, "approved")} className="btn-ghost text-xs py-1 px-2 hover:bg-emerald-500/10 hover:text-emerald-300">Approve</button>
                                            <button onClick={() => decide(d.id, "rejected")} className="btn-ghost text-xs py-1 px-2 hover:bg-rose-500/10 hover:text-rose-300">Reject</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {items.length === 0 && <tr><td colSpan={8} className="text-center py-10 text-zinc-500">No deposits.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </AdminLayout>
    );
}

export function AdminAnnouncements() {
    const [items, setItems] = useState([]);
    const [form, setForm] = useState({ title: "", body: "", pinned: false });
    const load = () => api.get("/admin/announcements").then(r => setItems(r.data));
    useEffect(() => { load(); }, []);
    const add = async (e) => { e.preventDefault(); await api.post("/admin/announcements", form); setForm({ title: "", body: "", pinned: false }); load(); };
    const del = async (id) => { if (!window.confirm("Delete?")) return; await api.delete(`/admin/announcements/${id}`); load(); };
    return (
        <AdminLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">CMS</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Eregon Announcements</h1>
            <form className="glass-strong p-6 mt-6 space-y-3" onSubmit={add}>
                <input className="input-eregon" placeholder="Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
                <textarea className="input-eregon min-h-[100px]" placeholder="Body" value={form.body} onChange={e => setForm({...form, body: e.target.value})} required />
                <label className="flex items-center gap-2 text-sm text-zinc-400">
                    <input type="checkbox" checked={form.pinned} onChange={e => setForm({...form, pinned: e.target.checked})} /> Pin announcement
                </label>
                <button className="btn-gold"><Plus className="w-4 h-4" /> Publish</button>
            </form>
            <div className="space-y-3 mt-6">
                {items.map(a => (
                    <div key={a.id} className="glass-strong p-5 flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2"><h3 className="font-display text-lg">{a.title}</h3>{a.pinned && <Badge color="gold">pinned</Badge>}</div>
                            <p className="text-sm text-zinc-400 mt-1">{a.body}</p>
                            <p className="text-xs text-zinc-600 mt-2">{new Date(a.created_at).toLocaleString()}</p>
                        </div>
                        <button onClick={() => del(a.id)} className="btn-ghost text-xs py-1.5 px-3 hover:bg-rose-500/10 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                ))}
            </div>
        </AdminLayout>
    );
}
