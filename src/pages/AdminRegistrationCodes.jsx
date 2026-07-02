import React, { useEffect, useMemo, useState } from "react";
import { Copy, Plus, RefreshCw, ShieldCheck, TicketCheck, Users } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "../components/AdminLayout";
import { api, formatApiError } from "../lib/api";
import { AnimatedCounter } from "../components/AnimatedCounter";

export default function AdminRegistrationCodes() {
    const [codes, setCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        code: "",
        reward_amount: 10,
        reward_coin: "USDT",
        plan_name: "Free",
        max_uses: 1,
        note: "First task completion reward",
    });

    const stats = useMemo(() => {
        const total = codes.length;
        const active = codes.filter((c) => c.status === "active").length;
        const used = codes.reduce((sum, c) => sum + Number(c.used_count || 0), 0);
        const rewards = codes.reduce((sum, c) => sum + Number(c.reward_amount || 0) * Number(c.used_count || 0), 0);
        return { total, active, used, rewards };
    }, [codes]);

    const load = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/admin/registration-codes");
            setCodes(data || []);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const createCode = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                code: form.code.trim() ? form.code.trim().toUpperCase() : undefined,
                reward_amount: Number(form.reward_amount || 10),
                max_uses: Number(form.max_uses || 1),
            };
            const { data } = await api.post("/admin/registration-codes", payload);
            setCodes((prev) => [data, ...prev]);
            setForm((prev) => ({ ...prev, code: "" }));
            toast.success(`Registration code ${data.code} created`);
        } catch (e2) {
            toast.error(formatApiError(e2));
        } finally {
            setSaving(false);
        }
    };

    const setStatus = async (id, status) => {
        try {
            const { data } = await api.patch(`/admin/registration-codes/${id}/status`, { status });
            setCodes((prev) => prev.map((c) => (c.id === id ? data : c)));
            toast.success(`Code ${status}`);
        } catch (e) {
            toast.error(formatApiError(e));
        }
    };

    const copy = async (code) => {
        await navigator.clipboard.writeText(code);
        toast.success("Code copied");
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">Admin Growth Control</p>
                        <h1 className="font-display text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-semibold mt-2">Registration Codes</h1>
                        <p className="text-zinc-400 mt-2 max-w-2xl">
                            Create unique invite codes, assign the Free plan, and control the first-task reward amount for every new user.
                        </p>
                    </div>
                    <button onClick={load} className="btn-ghost self-start md:self-auto"><RefreshCw className="w-4 h-4" /> Refresh</button>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                    <Stat icon={TicketCheck} label="Total Codes" value={stats.total} />
                    <Stat icon={ShieldCheck} label="Active Codes" value={stats.active} />
                    <Stat icon={Users} label="Registered Users" value={stats.used} />
                    <Stat icon={CrownIcon} label="Assigned Rewards" value={stats.rewards} money />
                </div>

                <div className="grid lg:grid-cols-[420px_1fr] gap-4 sm:gap-6 items-start">
                    <form onSubmit={createCode} className="glass-strong p-5 space-y-4 border-amber-500/20">
                        <div>
                            <h2 className="font-display text-xl font-semibold">Create Code</h2>
                            <p className="text-sm text-zinc-400 mt-1">Leave code empty to auto-generate a unique Eregon code.</p>
                        </div>
                        <Input label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="Auto / EREGON-ABCD1234" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Reward Amount" type="number" value={form.reward_amount} onChange={(v) => setForm({ ...form, reward_amount: v })} />
                            <Input label="Reward Coin" value={form.reward_coin} onChange={(v) => setForm({ ...form, reward_coin: v.toUpperCase() })} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Plan" value={form.plan_name} onChange={(v) => setForm({ ...form, plan_name: v })} />
                            <Input label="Max Uses" type="number" value={form.max_uses} onChange={(v) => setForm({ ...form, max_uses: v })} />
                        </div>
                        <Input label="Note" value={form.note} onChange={(v) => setForm({ ...form, note: v })} />
                        <button disabled={saving} className="btn-gold w-full" type="submit">
                            <Plus className="w-4 h-4" /> {saving ? "Creating..." : "Create Registration Code"}
                        </button>
                    </form>

                    <div className="glass-strong overflow-hidden">
                        <div className="p-5 border-b border-white/5 flex items-center justify-between">
                            <div>
                                <h2 className="font-display text-xl font-semibold">Issued Codes</h2>
                                <p className="text-sm text-zinc-400">Track code usage, reward assignment, and activation status.</p>
                            </div>
                        </div>
                        {loading ? (
                            <div className="p-5 space-y-3">
                                {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />)}
                            </div>
                        ) : codes.length === 0 ? (
                            <div className="p-4 sm:p-6 lg:p-8 text-center text-zinc-400">No registration codes yet.</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[720px]">
                                    <thead className="text-xs text-zinc-500 uppercase bg-white/[0.03]">
                                        <tr>
                                            <th className="text-left px-5 py-3">Code</th>
                                            <th className="text-left px-5 py-3">Reward</th>
                                            <th className="text-left px-5 py-3">Plan</th>
                                            <th className="text-left px-5 py-3">Usage</th>
                                            <th className="text-left px-5 py-3">Status</th>
                                            <th className="text-right px-5 py-3">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {codes.map((c) => (
                                            <tr key={c.id} className="hover:bg-white/[0.03] transition-colors">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <code className="text-amber-200 bg-amber-500/10 px-2 py-1 rounded-lg">{c.code}</code>
                                                        <button onClick={() => copy(c.code)} className="text-zinc-500 hover:text-white" type="button"><Copy className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                    {c.note && <p className="text-xs text-zinc-500 mt-1">{c.note}</p>}
                                                </td>
                                                <td className="px-5 py-4">{Number(c.reward_amount).toFixed(2)} {c.reward_coin}</td>
                                                <td className="px-5 py-4">{c.plan_name}</td>
                                                <td className="px-5 py-4">{c.used_count}/{c.max_uses}</td>
                                                <td className="px-5 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs border ${c.status === "active" ? "text-emerald-300 border-emerald-400/30 bg-emerald-400/10" : "text-zinc-400 border-white/10 bg-white/5"}`}>{c.status}</span>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    {c.status === "active" ? (
                                                        <button onClick={() => setStatus(c.id, "inactive")} className="btn-ghost text-xs py-1.5" type="button">Disable</button>
                                                    ) : (
                                                        <button onClick={() => setStatus(c.id, "active")} className="btn-ghost text-xs py-1.5" type="button">Activate</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
}

function Stat({ icon: Icon, label, value, money }) {
    return (
        <div className="glass p-5 border-amber-500/10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <p className="text-sm text-zinc-400">{label}</p>
                <Icon className="w-5 h-5 text-amber-300" />
            </div>
            <p className="font-display text-2xl font-semibold">
                {money && "$"}<AnimatedCounter value={Number(value || 0)} decimals={money ? 2 : 0} />
            </p>
        </div>
    );
}

function Input({ label, value, onChange, type = "text", placeholder }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-xs text-zinc-400">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="input-eregon"
                required={label !== "Code"}
            />
        </label>
    );
}

function CrownIcon(props) {
    return <TicketCheck {...props} />;
}
