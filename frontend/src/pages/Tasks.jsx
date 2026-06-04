import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge, Card, StatCard } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";
import { CheckCircle2, Clock, ExternalLink, ImageUp, PlayCircle, RefreshCcw, Send, XCircle } from "lucide-react";

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function statusBadge(status) {
    if (status === "available") return <Badge color="emerald">available</Badge>;
    if (status === "pending_review") return <Badge color="gold">pending review</Badge>;
    if (status === "cooldown") return <Badge color="purple">cooldown</Badge>;
    if (status === "locked") return <Badge color="rose">locked</Badge>;
    return <Badge color="zinc">{status || "unknown"}</Badge>;
}

export default function Tasks() {
    const [tasks, setTasks] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [proofs, setProofs] = useState({});
    const [notes, setNotes] = useState({});
    const [submitting, setSubmitting] = useState("");

    const load = async () => {
        setLoading(true);
        const [taskRes, submissionRes] = await Promise.all([
            api.get("/tasks-v2", { params: { type_filter: "youtube" } }),
            api.get("/task-submissions"),
        ]);
        setTasks(taskRes.data || []);
        setSubmissions(submissionRes.data || []);
        setLoading(false);
    };

    useEffect(() => { load().catch(() => setLoading(false)); }, []);

    const summary = useMemo(() => ({
        available: tasks.filter(t => t.status === "available").length,
        pending: submissions.filter(s => s.status === "pending").length,
        approved: submissions.filter(s => s.status === "approved").length,
        rejected: submissions.filter(s => s.status === "rejected").length,
    }), [tasks, submissions]);

    const onFile = async (taskId, file) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Upload an image screenshot only");
            return;
        }
        if (file.size > 2.5 * 1024 * 1024) {
            toast.error("Screenshot must be smaller than 2.5 MB");
            return;
        }
        const dataUrl = await fileToDataUrl(file);
        setProofs(prev => ({ ...prev, [taskId]: dataUrl }));
    };

    const submitProof = async (task) => {
        const proof = proofs[task.id];
        if (!proof) {
            toast.error("Upload screenshot proof before submitting");
            return;
        }
        setSubmitting(task.id);
        try {
            await api.post(`/tasks-v2/${task.id}/submit-proof`, {
                proof_data_url: proof,
                note: notes[task.id] || "",
            });
            toast.success("Proof submitted. Reward will be credited after admin approval.");
            setProofs(prev => ({ ...prev, [task.id]: "" }));
            setNotes(prev => ({ ...prev, [task.id]: "" }));
            await load();
        } catch (err) {
            toast.error(formatApiError(err));
        } finally {
            setSubmitting("");
        }
    };

    if (loading) return <DashboardLayout><CinematicLoader /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-3 mb-8">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Verified YouTube Tasks</p>
                    <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Task Center</h1>
                    <p className="text-zinc-400 max-w-3xl mt-2">Open the YouTube assignment, complete the action, upload screenshot proof, then wait for admin review. Rewards are credited only after approval.</p>
                </div>
                <button onClick={load} className="btn-ghost"><RefreshCcw className="w-4 h-4" /> Refresh</button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                <StatCard label="Available" value={summary.available} accent="emerald" icon={PlayCircle} />
                <StatCard label="Pending Review" value={summary.pending} accent="gold" icon={Clock} />
                <StatCard label="Approved" value={summary.approved} accent="purple" icon={CheckCircle2} />
                <StatCard label="Rejected" value={summary.rejected} accent="rose" icon={XCircle} />
            </div>

            <div className="grid 2xl:grid-cols-3 gap-5">
                <div className="2xl:col-span-2 space-y-5">
                    {tasks.length === 0 ? <Card><p className="text-zinc-400">No YouTube tasks are available right now.</p></Card> : tasks.map(task => (
                        <Card key={task.id} className="h-fit">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                    <div className="flex items-center gap-2 flex-wrap">{statusBadge(task.status)}<Badge color="purple">+{task.reward} USDT</Badge>{task.channel_name && <Badge color="zinc">{task.channel_name}</Badge>}</div>
                                    <h2 className="text-xl font-display mt-3">{task.title}</h2>
                                    <p className="text-sm text-zinc-400 mt-2">{task.description}</p>
                                </div>
                                {task.youtube_url && <a href={task.youtube_url} target="_blank" rel="noreferrer" className="btn-gold whitespace-nowrap"><ExternalLink className="w-4 h-4" /> Open YouTube</a>}
                            </div>

                            <div className="mt-5 rounded-xl border border-white/10 bg-black/35 p-4">
                                <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Instructions</p>
                                <p className="text-sm text-zinc-300 whitespace-pre-line">{task.instructions || "Complete the YouTube action and upload a clear screenshot as proof."}</p>
                                {task.proof_tips && <p className="text-xs text-amber-200 mt-3">Proof tip: {task.proof_tips}</p>}
                                {task.last_rejection_reason && <p className="text-xs text-rose-300 mt-3">Last rejection: {task.last_rejection_reason}</p>}
                            </div>

                            <div className="grid md:grid-cols-2 gap-4 mt-5">
                                <label className={`rounded-xl border border-dashed border-white/10 bg-black/35 p-4 ${task.status !== "available" ? "opacity-50" : ""}`}>
                                    <span className="text-xs uppercase tracking-widest text-zinc-500 flex items-center gap-2"><ImageUp className="w-4 h-4" /> Screenshot proof</span>
                                    <input disabled={task.status !== "available"} type="file" accept="image/*" className="mt-3 text-xs text-zinc-300" onChange={e => onFile(task.id, e.target.files?.[0])} />
                                    {proofs[task.id] && <img src={proofs[task.id]} alt="proof preview" className="mt-3 max-h-44 rounded-lg border border-white/10" />}
                                </label>
                                <div className="space-y-3">
                                    <textarea disabled={task.status !== "available"} className="input-eregon min-h-[110px]" placeholder="Optional note for reviewer" value={notes[task.id] || ""} onChange={e => setNotes(prev => ({ ...prev, [task.id]: e.target.value }))} />
                                    <button disabled={task.status !== "available" || submitting === task.id} onClick={() => submitProof(task)} className={task.status === "available" ? "btn-eregon w-full" : "w-full px-4 py-2 rounded-xl bg-white/5 text-zinc-500 border border-white/10"}>
                                        <Send className="w-4 h-4" /> {task.status === "available" ? "Submit proof for review" : task.status}
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="space-y-5">
                    <Card>
                        <p className="text-xs uppercase tracking-widest text-zinc-500">Review rules</p>
                        <ul className="mt-4 space-y-3 text-sm text-zinc-300">
                            <li>• Screenshot must clearly show the YouTube channel/video and completed action.</li>
                            <li>• Edited, duplicate, blurry, or unrelated screenshots can be rejected.</li>
                            <li>• Rewards are added to your wallet after admin approval only.</li>
                            <li>• Once you submit a task, that same task will no longer appear in your available list.</li>
                        </ul>
                    </Card>
                    <Card>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4"><h3 className="font-display text-lg">Recent submissions</h3><Badge>{submissions.length}</Badge></div>
                        {submissions.length === 0 ? <p className="text-sm text-zinc-500">No submissions yet.</p> : <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
                            {submissions.slice(0, 12).map(s => <div key={s.id} className="p-3 rounded-xl bg-black/35 border border-white/5">
                                <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{s.task_title}</p><Badge color={s.status === "approved" ? "emerald" : s.status === "rejected" ? "rose" : "gold"}>{s.status}</Badge></div>
                                <p className="text-xs text-zinc-500 mt-1">Reward: {s.reward} USDT · {new Date(s.created_at).toLocaleString()}</p>
                                {s.rejection_reason && <p className="text-xs text-rose-300 mt-2">Reason: {s.rejection_reason}</p>}
                            </div>)}
                        </div>}
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
}
