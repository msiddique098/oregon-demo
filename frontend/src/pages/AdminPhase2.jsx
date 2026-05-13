import React, { useEffect, useState } from "react";
import { Activity, CheckCircle2, Crown, ExternalLink, Eye, ImageUp, Plus, Radio, Sparkles, Target, Wallet, XCircle } from "lucide-react";
import AdminLayout from "../components/AdminLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge, Card } from "../components/ui-royal";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

export function AdminGrowthEngine() {
    const [stats, setStats] = useState(null);
    useEffect(() => { api.get("/admin/phase2/stats").then(r => setStats(r.data)).catch(() => setStats({})); }, []);
    if (!stats) return <AdminLayout><CinematicLoader /></AdminLayout>;
    const cards = [
        ["Tasks", stats.tasks, Target], ["Pending Proofs", stats.task_submissions_pending, ImageUp], ["Completions", stats.task_completions, Sparkles], ["Bonuses Paid", stats.bonuses_total, Wallet], ["Live Users", stats.connected_users, Radio], ["Admins Online", stats.connected_admins, Activity], ["VIP Levels", stats.vip_levels, Crown],
    ];
    return <AdminLayout><div className="mb-8"><p className="text-xs uppercase tracking-widest text-amber-400/80">Task platform console</p><h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Growth Engine</h1></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{cards.map(([label, value, Icon]) => <Card key={label}><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p><p className="text-2xl sm:text-3xl font-display gradient-text-gold mt-2">{Number(value || 0).toLocaleString()}</p></div><div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center"><Icon className="w-5 h-5 text-amber-300" /></div></div></Card>)}</div></AdminLayout>;
}

export function AdminTasksV2() {
    const [tasks, setTasks] = useState(null);
    const [form, setForm] = useState({ title: "", description: "", reward: 1, type: "youtube", youtube_url: "", channel_name: "", instructions: "", proof_tips: "", vip_level: "", cooldown_hours: 24, active: true, proof_required: true });
    const load = () => api.get("/admin/tasks-v2").then(r => setTasks(r.data)).catch(() => setTasks([]));
    useEffect(() => { load(); }, []);
    const submit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/admin/tasks-v2", {
                ...form,
                vip_level: form.vip_level || null,
                reward: Number(form.reward),
                cooldown_hours: Number(form.cooldown_hours),
                proof_required: Boolean(form.proof_required),
            });
            toast.success("Task created");
            setForm({ ...form, title: "", description: "", youtube_url: "", channel_name: "", instructions: "", proof_tips: "" });
            load();
        } catch (err) { toast.error(formatApiError(err)); }
    };
    const disableTask = async (task) => {
        try { await api.delete(`/admin/tasks-v2/${task.id}`); toast.success("Task disabled"); load(); }
        catch (err) { toast.error(formatApiError(err)); }
    };
    return <AdminLayout>
        <div className="mb-8"><p className="text-xs uppercase tracking-widest text-amber-400/80">YouTube task engine</p><h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Task Management</h1><p className="text-zinc-400 mt-2 max-w-3xl">Create YouTube channel/video tasks with screenshot-proof requirements. User rewards are paid only when a proof submission is approved.</p></div>
        <div className="grid lg:grid-cols-3 gap-5">
            <Card>
                <form onSubmit={submit} className="space-y-3">
                    <input className="input-royal" placeholder="Task title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                    <textarea className="input-royal" placeholder="Short task description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    <input className="input-royal" placeholder="YouTube channel or video URL" value={form.youtube_url} onChange={e => setForm({ ...form, youtube_url: e.target.value })} />
                    <input className="input-royal" placeholder="Channel / campaign name" value={form.channel_name} onChange={e => setForm({ ...form, channel_name: e.target.value })} />
                    <textarea className="input-royal min-h-[100px]" placeholder="Step-by-step instructions" value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} />
                    <textarea className="input-royal" placeholder="Proof tips / rejection criteria" value={form.proof_tips} onChange={e => setForm({ ...form, proof_tips: e.target.value })} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input className="input-royal" type="number" step="0.01" placeholder="Reward" value={form.reward} onChange={e => setForm({ ...form, reward: e.target.value })} /><input className="input-royal" type="number" placeholder="Cooldown hours" value={form.cooldown_hours} onChange={e => setForm({ ...form, cooldown_hours: e.target.value })} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><select className="input-royal" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="youtube">youtube</option><option value="daily">daily</option><option value="social">social</option><option value="vip">vip</option><option value="referral">referral</option><option value="special">special</option></select><input className="input-royal" placeholder="VIP level optional" value={form.vip_level} onChange={e => setForm({ ...form, vip_level: e.target.value })} /></div>
                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.proof_required} onChange={e => setForm({ ...form, proof_required: e.target.checked })} /> Screenshot proof required</label>
                    <button className="btn-gold w-full"><Plus className="w-4 h-4" /> Create task</button>
                </form>
            </Card>
            <div className="lg:col-span-2 space-y-3">{!tasks ? <CinematicLoader /> : tasks.map(t => <div key={t.id} className="glass-strong p-4 flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 flex-wrap"><h3 className="font-display text-lg">{t.title}</h3><Badge color={t.active ? "emerald" : "zinc"}>{t.active ? "active" : "disabled"}</Badge><Badge color={t.type === "youtube" ? "purple" : t.type === "vip" ? "gold" : "zinc"}>{t.type}</Badge>{t.proof_required && <Badge color="gold">proof required</Badge>}</div><p className="text-sm text-zinc-400 mt-1">{t.description}</p>{t.youtube_url && <a href={t.youtube_url} target="_blank" rel="noreferrer" className="text-xs text-purple-300 hover:text-purple-200 mt-2 inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> {t.youtube_url}</a>}</div><div className="text-right"><p className="text-2xl font-display gradient-text-gold">+{t.reward}</p>{t.active && <button onClick={() => disableTask(t)} className="text-xs text-rose-300 hover:text-rose-200 mt-2">Disable</button>}</div></div>)}</div>
        </div>
    </AdminLayout>;
}

export function AdminTaskSubmissions() {
    const [items, setItems] = useState(null);
    const [filter, setFilter] = useState("pending");
    const [preview, setPreview] = useState(null);
    const [reason, setReason] = useState({});
    const load = () => api.get("/admin/task-submissions", { params: { status_filter: filter || undefined } }).then(r => setItems(r.data)).catch(() => setItems([]));
    useEffect(() => { setItems(null); load(); }, [filter]);
    const decide = async (item, status) => {
        try {
            const payload = status === "approved" ? { status, admin_note: "Proof approved" } : { status, rejection_reason: reason[item.id] || "Proof did not meet requirements" };
            await api.patch(`/admin/task-submissions/${item.id}`, payload);
            toast.success(status === "approved" ? "Task reward credited" : "Submission rejected");
            load();
        } catch (err) { toast.error(formatApiError(err)); }
    };
    return <AdminLayout>
        <div className="mb-8"><p className="text-xs uppercase tracking-widest text-amber-400/80">Proof review queue</p><h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Task Submissions</h1><p className="text-zinc-400 mt-2">Review screenshot proof before user rewards are credited.</p></div>
        <div className="flex flex-wrap gap-2 flex-wrap mb-5">{["pending", "approved", "rejected", ""].map(f => <button key={f || "all"} onClick={() => setFilter(f)} className={`px-4 py-2 rounded-xl border text-sm ${filter === f ? "bg-amber-500/10 border-amber-500/30 text-amber-200" : "bg-white/5 border-white/10 text-zinc-300"}`}>{f || "all"}</button>)}</div>
        {!items ? <CinematicLoader /> : items.length === 0 ? <Card><p className="text-zinc-400">No submissions found.</p></Card> : <div className="space-y-4">{items.map(item => <Card key={item.id}>
            <div className="grid lg:grid-cols-[160px_1fr_260px] gap-5">
                <button onClick={() => setPreview(item)} className="rounded-xl overflow-hidden border border-white/10 bg-black/40 h-36 flex items-center justify-center">{item.proof_data_url ? <img src={item.proof_data_url} alt="proof" className="w-full h-full object-cover" /> : <Eye className="w-6 h-6 text-zinc-500" />}</button>
                <div><div className="flex items-center gap-2 flex-wrap"><Badge color={item.status === "approved" ? "emerald" : item.status === "rejected" ? "rose" : "gold"}>{item.status}</Badge><Badge color="purple">+{item.reward} USDT</Badge></div><h2 className="text-xl font-display mt-3">{item.task_title}</h2><p className="text-sm text-zinc-400 mt-1">User: {item.user_name} · {item.user_email}</p>{item.youtube_url && <a href={item.youtube_url} target="_blank" rel="noreferrer" className="text-xs text-purple-300 hover:text-purple-200 mt-2 inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Open YouTube assignment</a>}<p className="text-xs text-zinc-500 mt-3">Submitted {new Date(item.created_at).toLocaleString()}</p>{item.note && <p className="text-sm text-zinc-300 mt-3">User note: {item.note}</p>}{item.rejection_reason && <p className="text-sm text-rose-300 mt-3">Rejection: {item.rejection_reason}</p>}</div>
                <div className="space-y-3">{item.status === "pending" ? <><textarea className="input-royal min-h-[86px]" placeholder="Rejection reason if rejecting" value={reason[item.id] || ""} onChange={e => setReason(prev => ({ ...prev, [item.id]: e.target.value }))} /><button onClick={() => decide(item, "approved")} className="btn-gold w-full"><CheckCircle2 className="w-4 h-4" /> Approve & credit</button><button onClick={() => decide(item, "rejected")} className="w-full px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 flex items-center justify-center gap-2"><XCircle className="w-4 h-4" /> Reject proof</button></> : <p className="text-sm text-zinc-500">Reviewed {item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : ""}</p>}</div>
            </div>
        </Card>)}</div>}
        {preview && <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreview(null)}><div className="max-w-5xl w-full" onClick={e => e.stopPropagation()}><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3"><h3 className="font-display text-xl">Proof preview</h3><button className="text-zinc-300" onClick={() => setPreview(null)}>✕</button></div><img src={preview.proof_data_url} alt="proof preview" className="max-h-[82vh] mx-auto rounded-xl border border-white/10" /></div></div>}
    </AdminLayout>;
}

export function AdminVipLevels() {
    const [levels, setLevels] = useState(null);
    useEffect(() => { api.get("/admin/vip-levels").then(r => setLevels(r.data)).catch(() => setLevels([])); }, []);
    return <AdminLayout><div className="mb-8"><p className="text-xs uppercase tracking-widest text-amber-400/80">Account levels</p><h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">VIP Levels</h1><p className="text-zinc-400 mt-2">Use levels for task limits, multipliers, withdrawal priority, and trust status. Avoid promising guaranteed profit.</p></div>{!levels ? <CinematicLoader /> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{levels.map(v => <Card key={v.id}><Badge color={v.badge_color || "gold"}>Level {v.level}</Badge><h2 className="text-2xl font-display gradient-text-gold mt-4">{v.name}</h2><p className="text-sm text-zinc-400 mt-2">Required balance: {v.required_balance} USDT</p><p className="text-sm text-zinc-400">Task multiplier: {v.reward_multiplier}x · Referral +{v.commission_boost_pct}%</p><ul className="mt-4 space-y-2 text-sm text-zinc-300">{(v.benefits || []).map(b => <li key={b}>• {b}</li>)}</ul></Card>)}</div>}</AdminLayout>;
}
