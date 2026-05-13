import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout";
import { Badge } from "../components/ui-royal";
import { api } from "../lib/api";
import { TicketThread } from "./Tickets";
import { Filter, MessageSquare } from "lucide-react";

const PRIORITY_COLORS = { low: "zinc", normal: "purple", high: "gold", urgent: "rose" };
const STATUS_COLORS = { open: "emerald", pending: "gold", resolved: "purple", closed: "zinc" };

export function AdminTickets() {
    const [list, setList] = useState([]);
    const [active, setActive] = useState(null);
    const [messages, setMessages] = useState([]);
    const [f, setF] = useState({ status: "", priority: "" });

    const load = () => {
        const params = {};
        if (f.status) params.status_filter = f.status;
        if (f.priority) params.priority = f.priority;
        api.get("/admin/tickets", { params }).then(r => setList(r.data));
    };
    useEffect(load, [f]);

    const open = async (t) => {
        setActive(t);
        const { data } = await api.get(`/admin/tickets/${t.id}/messages`);
        setMessages(data);
        load();
    };

    const updateTicket = async (patch) => {
        const { data } = await api.patch(`/admin/tickets/${active.id}`, patch);
        setActive(data); load();
    };

    return (
        <AdminLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-3">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Royal Concierge</p>
                    <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Support Inbox</h1>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <Filter className="w-4 h-4 text-zinc-500" />
                    <select className="input-royal w-auto py-2 px-3 text-xs" value={f.status} onChange={e => setF({...f, status: e.target.value})}>
                        <option value="">All status</option><option>open</option><option>pending</option><option>resolved</option><option>closed</option>
                    </select>
                    <select className="input-royal w-auto py-2 px-3 text-xs" value={f.priority} onChange={e => setF({...f, priority: e.target.value})}>
                        <option value="">All priorities</option><option>low</option><option>normal</option><option>high</option><option>urgent</option>
                    </select>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-5 mt-6">
                <div className={`glass-strong p-4 ${active ? "hidden lg:block" : ""}`}>
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Inbox ({list.length})</p>
                    {list.length === 0 && <div className="py-10 text-center text-zinc-500"><MessageSquare className="w-8 h-8 mx-auto opacity-40 mb-2" /><p className="text-sm">No tickets.</p></div>}
                    <div className="space-y-2">
                        {list.map(t => (
                            <button key={t.id} onClick={() => open(t)}
                                className={`w-full text-left p-3 rounded-xl border transition-all ${active?.id === t.id ? "bg-amber-500/10 border-amber-500/30" : "bg-black/40 border-white/5 hover:bg-white/5"}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-semibold truncate flex-1">{t.subject}</p>
                                    {t.unread_for_admin > 0 && <span className="bg-rose-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">{t.unread_for_admin}</span>}
                                </div>
                                <p className="text-xs text-zinc-500 truncate mt-1">{t.user_email}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge color={STATUS_COLORS[t.status]}>{t.status}</Badge>
                                    <Badge color={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
                <div className={`lg:col-span-2 ${!active ? "hidden lg:block" : ""}`}>
                    {!active ? (
                        <div className="glass-strong p-10 text-center text-zinc-500">
                            <MessageSquare className="w-10 h-10 mx-auto opacity-40 mb-3" />
                            <p className="text-sm">Select a ticket from the inbox.</p>
                        </div>
                    ) : (
                        <div>
                            <div className="glass-strong p-3 mb-3 flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-zinc-500 uppercase tracking-widest mr-2">Manage:</span>
                                <select className="input-royal w-auto py-1.5 px-3 text-xs" value={active.status} onChange={e => updateTicket({ status: e.target.value })}>
                                    <option>open</option><option>pending</option><option>resolved</option><option>closed</option>
                                </select>
                                <select className="input-royal w-auto py-1.5 px-3 text-xs" value={active.priority} onChange={e => updateTicket({ priority: e.target.value })}>
                                    <option>low</option><option>normal</option><option>high</option><option>urgent</option>
                                </select>
                            </div>
                            <TicketThread role="admin" ticket={active} messages={messages} setMessages={setMessages}
                                onBack={() => setActive(null)} onUpdate={load} />
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}

export function AdminLiveFeed() {
    const [items, setItems] = useState([]);
    const [settings, setSettings] = useState({ auto_enabled: true, interval_sec: 8 });
    const [form, setForm] = useState({ message: "", icon: "sparkles" });

    const load = () => api.get("/public/feed").then(r => setItems(r.data));
    useEffect(() => {
        load();
        api.get("/admin/feed/settings").then(r => setSettings(r.data));
    }, []);

    const add = async (e) => { e.preventDefault(); await api.post("/admin/feed", form); setForm({ message: "", icon: "sparkles" }); load(); };
    const del = async (id) => { await api.delete(`/admin/feed/${id}`); load(); };
    const saveSettings = async () => { await api.post("/admin/feed/settings", settings); };

    return (
        <AdminLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Live Activity Feed</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Royal Feed Curator</h1>

            <div className="grid lg:grid-cols-3 gap-5 mt-6">
                <div className="glass-strong p-6">
                    <h3 className="font-display text-lg mb-3">Auto-feed settings</h3>
                    <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-xl bg-black/40 border border-white/5">
                        <span className="text-sm">Enable auto rotation</span>
                        <input type="checkbox" checked={settings.auto_enabled} onChange={e => setSettings({...settings, auto_enabled: e.target.checked})} />
                    </label>
                    <label className="block mt-3">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">Rotation interval (sec)</span>
                        <input type="number" min="3" max="120" className="input-royal mt-1" value={settings.interval_sec} onChange={e => setSettings({...settings, interval_sec: parseInt(e.target.value || "8")})} />
                    </label>
                    <button onClick={saveSettings} className="btn-gold w-full mt-4">Save Settings</button>
                </div>

                <form className="glass-strong p-6 lg:col-span-2 space-y-3" onSubmit={add}>
                    <h3 className="font-display text-lg">Add feed entry</h3>
                    <input className="input-royal" placeholder="Feed message" value={form.message} onChange={e => setForm({...form, message: e.target.value})} required />
                    <select className="input-royal" value={form.icon} onChange={e => setForm({...form, icon: e.target.value})}>
                        <option value="sparkles">Sparkles</option><option value="trending">Trending</option><option value="crown">Crown</option>
                        <option value="wallet">Wallet</option><option value="users">Users</option><option value="check">Check</option><option value="diamond">Diamond</option>
                    </select>
                    <button className="btn-royal">Publish Entry</button>
                </form>
            </div>

            <div className="glass-strong p-6 mt-6">
                <h3 className="font-display text-lg mb-4">Current feed ({items.length})</h3>
                <div className="space-y-2">
                    {items.map(it => (
                        <div key={it.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-black/40 border border-white/5 rounded-xl">
                            <div>
                                <p className="text-sm">{it.message}</p>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">{it.icon} · {it.source}</p>
                            </div>
                            <button onClick={() => del(it.id)} className="btn-ghost text-xs py-1.5 px-3 hover:bg-rose-500/10 hover:text-rose-300">Delete</button>
                        </div>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
}

export function AdminBulk() {
    const [form, setForm] = useState({ target: "all", tier: "Gold", amount: 5, note: "Weekly royal bonus" });
    const [cform, setCform] = useState({ target: "tier", tier: "Platinum", delta_percent: 2 });
    const [msg, setMsg] = useState("");

    const bonus = async (e) => {
        e.preventDefault();
        const payload = { target: form.target, amount: parseFloat(form.amount), note: form.note };
        if (form.target === "tier") payload.tier = form.tier;
        const { data } = await api.post("/admin/bulk/bonus", payload);
        setMsg(`✓ Bonus distributed to ${data.affected} users.`);
    };

    const commission = async (e) => {
        e.preventDefault();
        const payload = { target: cform.target, delta_percent: parseFloat(cform.delta_percent) };
        if (cform.target === "tier") payload.tier = cform.tier;
        const { data } = await api.post("/admin/bulk/commission", payload);
        setMsg(`✓ Commission updated for ${data.affected} users.`);
    };

    return (
        <AdminLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Bulk Reward Tools</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Mass Operations</h1>
            <p className="text-zinc-400 mt-2 max-w-2xl text-sm">Distribute bonuses, adjust commission rates, and run promotional campaigns across thousands of users in seconds. Every action is auto-logged in the Royal Ledger.</p>

            {msg && <div className="glass p-4 mt-6 border-emerald-500/30 text-emerald-300 text-sm">{msg}</div>}

            <div className="grid lg:grid-cols-2 gap-5 mt-6">
                <form className="glass-strong p-6 space-y-3" onSubmit={bonus}>
                    <h3 className="font-display text-lg">Bulk Bonus Distribution</h3>
                    <p className="text-xs text-zinc-500">Credit a fixed amount to a group of users. Auto-ledgered.</p>
                    <select className="input-royal" value={form.target} onChange={e => setForm({...form, target: e.target.value})} data-testid="bulk-bonus-target">
                        <option value="all">All Users</option><option value="tier">By Membership Tier</option>
                    </select>
                    {form.target === "tier" && (
                        <select className="input-royal" value={form.tier} onChange={e => setForm({...form, tier: e.target.value})}>
                            <option>Basic</option><option>Silver</option><option>Gold</option><option>Platinum</option><option>Royal VIP</option>
                        </select>
                    )}
                    <input type="number" step="any" min="0" className="input-royal" placeholder="Bonus amount" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
                    <input className="input-royal" placeholder="Note for ledger" value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
                    <button className="btn-gold w-full" data-testid="bulk-bonus-submit">Distribute Bonus</button>
                </form>

                <form className="glass-strong p-6 space-y-3" onSubmit={commission}>
                    <h3 className="font-display text-lg">Commission Adjustment</h3>
                    <p className="text-xs text-zinc-500">Increase or decrease commission % for a group.</p>
                    <select className="input-royal" value={cform.target} onChange={e => setCform({...cform, target: e.target.value})}>
                        <option value="all">All Users</option><option value="tier">By Membership Tier</option>
                    </select>
                    {cform.target === "tier" && (
                        <select className="input-royal" value={cform.tier} onChange={e => setCform({...cform, tier: e.target.value})}>
                            <option>Basic</option><option>Silver</option><option>Gold</option><option>Platinum</option><option>Royal VIP</option>
                        </select>
                    )}
                    <input type="number" step="any" className="input-royal" placeholder="Δ percentage (e.g. +2 or -1)" value={cform.delta_percent} onChange={e => setCform({...cform, delta_percent: e.target.value})} required />
                    <button className="btn-royal w-full">Apply Commission Δ</button>
                </form>
            </div>
        </AdminLayout>
    );
}
