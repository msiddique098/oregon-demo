import React, { useEffect, useState } from "react";
import { Activity, CheckCircle2, Crown, ExternalLink, Eye, ImageUp, Plus, Radio, Sparkles, Target, Trash2, Wallet, XCircle } from "lucide-react";
import AdminLayout from "../components/AdminLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge, Card } from "../components/ui-eregon";
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
    const [form, setForm] = useState({ title: "", description: "", reward: 1, type: "youtube", youtube_url: "", channel_name: "", instructions: "", proof_tips: "", vip_level: "", cooldown_hours: 24, active: true, proof_required: true, target_user_identifiers: "" });
    const [drafts, setDrafts] = useState({});
    const [duplicateTaskId, setDuplicateTaskId] = useState(null);
    const load = () => api.get("/admin/tasks-v2").then(r => setTasks(r.data)).catch(() => setTasks([]));
    useEffect(() => { load(); }, []);
    const targetIds = (value) => String(value || "").split(",").map(v => v.trim()).filter(Boolean);
    const scrollToTask = (taskId) => setTimeout(() => document.getElementById(`task-row-${taskId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    const handleDuplicate = (err) => {
        const detail = err?.response?.data?.detail;
        if (err?.response?.status === 409 && detail?.existing_task_id) {
            const existingId = detail.existing_task_id;
            setDuplicateTaskId(existingId);
            if (form.target_user_identifiers) {
                setDrafts(prev => ({ ...prev, [existingId]: { ...prev[existingId], target_users: form.target_user_identifiers } }));
            }
            toast.error(detail.message || "Task with this link already exists. Add the user to the existing task.");
            scrollToTask(existingId);
            return true;
        }
        return false;
    };
    const taskPayload = (task, patch = {}) => {
        const draft = drafts[task.id] || {};
        const hasDraftUsers = Object.prototype.hasOwnProperty.call(draft, "target_users");
        return {
            title: task.title,
            description: task.description || "",
            reward: Number(task.reward || 0),
            type: task.type || "youtube",
            vip_level: task.vip_level || null,
            cooldown_hours: Number(task.cooldown_hours || 24),
            thumbnail: task.thumbnail || null,
            active: task.active !== false,
            target_user_ids: hasDraftUsers ? undefined : (task.target_user_ids || []),
            target_user_identifiers: hasDraftUsers ? targetIds(draft.target_users) : undefined,
            youtube_url: task.youtube_url || null,
            channel_name: task.channel_name || null,
            instructions: task.instructions || null,
            proof_required: task.proof_required !== false,
            proof_tips: task.proof_tips || null,
            ...patch,
        };
    };
    const submit = async (e) => {
        e.preventDefault();
        try {
            await api.post("/admin/tasks-v2", {
                ...form,
                vip_level: form.vip_level || null,
                reward: Number(form.reward),
                cooldown_hours: Number(form.cooldown_hours),
                proof_required: Boolean(form.proof_required),
                target_user_identifiers: targetIds(form.target_user_identifiers),
            });
            toast.success("Task created");
            setForm({ ...form, title: "", description: "", youtube_url: "", channel_name: "", instructions: "", proof_tips: "", target_user_identifiers: "" });
            load();
        } catch (err) {
            if (!handleDuplicate(err)) toast.error(formatApiError(err));
        }
    };
    const saveTask = async (task) => {
        const draft = drafts[task.id] || {};
        try {
            await api.patch(`/admin/tasks-v2/${task.id}`, taskPayload(task, {
                reward: Number(draft.reward ?? task.reward),
            }));
            toast.success("Task updated");
            setDuplicateTaskId(null);
            load();
        } catch (err) {
            if (!handleDuplicate(err)) toast.error(formatApiError(err));
        }
    };
    const assignUsers = async (task, mode) => {
        const draft = drafts[task.id] || {};
        const users = targetIds(draft.target_users);
        if (!users.length) {
            toast.error("Enter at least one user ID, email, name, or referral code");
            return;
        }
        try {
            const payload = mode === "remove" ? { remove_users: users } : { add_users: users };
            await api.patch(`/admin/tasks-v2/${task.id}/users`, payload);
            toast.success(mode === "remove" ? "User removed from task" : "User added to task");
            setDrafts(prev => ({ ...prev, [task.id]: { ...prev[task.id], target_users: "" } }));
            setDuplicateTaskId(null);
            load();
        } catch (err) { toast.error(formatApiError(err)); }
    };
    const toggleTask = async (task) => {
        try {
            await api.patch(`/admin/tasks-v2/${task.id}`, taskPayload(task, { active: !task.active }));
            toast.success(task.active ? "Task disabled" : "Task enabled");
            load();
        }
        catch (err) { toast.error(formatApiError(err)); }
    };
    const deleteTask = async (task) => {
        if (!window.confirm(`Delete task permanently: ${task.title}? Existing ledger/submission history will remain, but this task will be removed from task management and users.`)) return;
        try {
            await api.delete(`/admin/tasks-v2/${task.id}`);
            toast.success("Task deleted completely");
            load();
        } catch (err) { toast.error(formatApiError(err)); }
    };
    return <AdminLayout>
        <div className="mb-8"><p className="text-xs uppercase tracking-widest text-amber-400/80">Task engine</p><h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Task Management</h1><p className="text-zinc-400 mt-2 max-w-3xl">Create task campaigns, assign them to all users or selected users, and review proof before rewards are credited. Duplicate links are blocked so you can add users to the existing task instead.</p></div>
        <div className="grid lg:grid-cols-3 gap-5">
            <Card>
                <form onSubmit={submit} className="space-y-3">
                    <input className="input-eregon" placeholder="Task title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                    <textarea className="input-eregon" placeholder="Short task description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    <input className="input-eregon" placeholder="Task link / YouTube URL" value={form.youtube_url} onChange={e => setForm({ ...form, youtube_url: e.target.value })} />
                    <input className="input-eregon" placeholder="Channel / campaign name" value={form.channel_name} onChange={e => setForm({ ...form, channel_name: e.target.value })} />
                    <textarea className="input-eregon min-h-[100px]" placeholder="Step-by-step instructions" value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} />
                    <textarea className="input-eregon" placeholder="Proof tips / rejection criteria" value={form.proof_tips} onChange={e => setForm({ ...form, proof_tips: e.target.value })} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input className="input-eregon" type="number" step="0.01" placeholder="Reward" value={form.reward} onChange={e => setForm({ ...form, reward: e.target.value })} /><input className="input-eregon" type="number" placeholder="Cooldown hours" value={form.cooldown_hours} onChange={e => setForm({ ...form, cooldown_hours: e.target.value })} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><select className="input-eregon" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}><option value="youtube">youtube</option><option value="social">social</option><option value="vip">vip</option><option value="referral">referral</option><option value="special">special</option></select><input className="input-eregon" placeholder="VIP level optional" value={form.vip_level} onChange={e => setForm({ ...form, vip_level: e.target.value })} /></div>
                    <textarea className="input-eregon min-h-[78px]" placeholder="Assign to users by ID, email, exact name, or referral code. Leave empty for all users." value={form.target_user_identifiers} onChange={e => setForm({ ...form, target_user_identifiers: e.target.value })} />
                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Active</label>
                    <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={form.proof_required} onChange={e => setForm({ ...form, proof_required: e.target.checked })} /> Screenshot proof required</label>
                    <button className="btn-gold w-full"><Plus className="w-4 h-4" /> Create task</button>
                </form>
            </Card>
            <div className="lg:col-span-2 space-y-3">{!tasks ? <CinematicLoader /> : tasks.map(t => {
                const draft = drafts[t.id] || {};
                const highlighted = duplicateTaskId === t.id;
                return <div id={`task-row-${t.id}`} key={t.id} className={`glass-strong p-4 flex flex-col gap-4 transition-all ${highlighted ? "border-amber-400/70 shadow-[0_0_28px_rgba(251,191,36,.25)]" : ""}`}>
                    <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                        <div className="min-w-0"><div className="flex items-center gap-2 flex-wrap"><h3 className="font-display text-lg">{t.title}</h3><Badge color={t.active ? "emerald" : "zinc"}>{t.active ? "active" : "disabled"}</Badge><Badge color={t.type === "youtube" ? "purple" : t.type === "vip" ? "gold" : "zinc"}>{t.type}</Badge>{t.proof_required && <Badge color="gold">proof required</Badge>}{(t.target_user_ids || []).length > 0 && <Badge color="purple">targeted</Badge>}</div><p className="text-sm text-zinc-400 mt-1">{t.description}</p>{t.youtube_url && <a href={t.youtube_url} target="_blank" rel="noreferrer" className="text-xs text-purple-300 hover:text-purple-200 mt-2 inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> {t.youtube_url}</a>}</div>
                        <div className="grid sm:grid-cols-[120px_minmax(180px,1fr)] xl:w-[420px] gap-2"><input className="input-eregon py-2" type="number" step="0.01" value={draft.reward ?? t.reward} onChange={e => setDrafts(prev => ({ ...prev, [t.id]: { ...prev[t.id], reward: e.target.value } }))} /><button onClick={() => saveTask(t)} className="btn-gold py-2 text-sm">Save Details</button><button onClick={() => toggleTask(t)} className={`px-4 py-2 rounded-xl border text-sm ${t.active ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>{t.active ? "Disable Task" : "Enable Task"}</button><button onClick={() => deleteTask(t)} className="px-4 py-2 rounded-xl border border-rose-600/40 bg-rose-600/10 text-rose-200 text-sm flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Delete Permanently</button></div>
                    </div>
                    <div className="rounded-2xl bg-black/25 border border-white/5 p-3">
                        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Assigned users</p>
                        {(t.target_user_labels || []).length ? <div className="flex flex-wrap gap-2 mb-3">{t.target_user_labels.map(label => <Badge key={label} color="purple">{label}</Badge>)}</div> : <p className="text-xs text-zinc-500 mb-3">Available to all users.</p>}
                        <div className="grid md:grid-cols-[1fr_auto_auto] gap-2"><input className="input-eregon py-2" placeholder="User ID, email, exact name, or referral code" value={draft.target_users ?? ""} onChange={e => setDrafts(prev => ({ ...prev, [t.id]: { ...prev[t.id], target_users: e.target.value } }))} /><button onClick={() => assignUsers(t, "add")} className="btn-gold py-2 text-sm">Add User</button><button onClick={() => assignUsers(t, "remove")} className="px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 text-sm">Remove User</button></div>
                    </div>
                </div>;
            })}</div>
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
                <div className="space-y-3">{item.status === "pending" ? <><textarea className="input-eregon min-h-[86px]" placeholder="Rejection reason if rejecting" value={reason[item.id] || ""} onChange={e => setReason(prev => ({ ...prev, [item.id]: e.target.value }))} /><button onClick={() => decide(item, "approved")} className="btn-gold w-full"><CheckCircle2 className="w-4 h-4" /> Approve & credit</button><button onClick={() => decide(item, "rejected")} className="w-full px-4 py-2 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-200 flex items-center justify-center gap-2"><XCircle className="w-4 h-4" /> Reject proof</button></> : <p className="text-sm text-zinc-500">Reviewed {item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : ""}</p>}</div>
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
