import React, { useEffect, useState, useRef } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { Badge } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { Plus, Send, Paperclip, X, AlertCircle, MessageSquare, ChevronLeft } from "lucide-react";

const PRIORITY_COLORS = { low: "zinc", normal: "purple", high: "gold", urgent: "rose" };
const STATUS_COLORS = { open: "emerald", pending: "gold", resolved: "purple", closed: "zinc" };

export default function Tickets() {
    const [tickets, setTickets] = useState([]);
    const [active, setActive] = useState(null);
    const [messages, setMessages] = useState([]);
    const [creating, setCreating] = useState(false);

    const loadTickets = () => api.get("/user/tickets").then(r => setTickets(r.data));
    useEffect(() => { loadTickets(); }, []);

    const openTicket = async (t) => {
        setActive(t);
        const { data } = await api.get(`/user/tickets/${t.id}/messages`);
        setMessages(data);
        loadTickets();
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap gap-3">
                <div>
                    <p className="text-xs uppercase tracking-widest text-amber-400/80">Eregon Marketing Support</p>
                    <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Support Tickets</h1>
                </div>
                <button onClick={() => setCreating(true)} className="btn-gold" data-testid="new-ticket-btn"><Plus className="w-4 h-4" /> New Ticket</button>
            </div>

            <div className="grid lg:grid-cols-3 gap-5 mt-8">
                <div className={`glass-strong p-4 lg:col-span-1 ${active ? "hidden lg:block" : ""}`}>
                    <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Your Tickets</p>
                    {tickets.length === 0 && (
                        <div className="py-10 text-center text-zinc-500">
                            <MessageSquare className="w-8 h-8 mx-auto opacity-40 mb-2" />
                            <p className="text-sm">No tickets yet.</p>
                        </div>
                    )}
                    <div className="space-y-2">
                        {tickets.map(t => (
                            <button key={t.id} onClick={() => openTicket(t)}
                                data-testid={`ticket-${t.id}`}
                                className={`w-full text-left p-3 rounded-xl border transition-all ${active?.id === t.id ? "bg-purple-500/10 border-purple-500/30" : "bg-black/40 border-white/5 hover:bg-white/5"}`}>
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm font-semibold truncate flex-1">{t.subject}</p>
                                    {t.unread_for_user > 0 && <span className="bg-amber-500 text-black text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">{t.unread_for_user}</span>}
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <Badge color={STATUS_COLORS[t.status]}>{t.status}</Badge>
                                    <Badge color={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge>
                                </div>
                                <p className="text-[10px] text-zinc-600 mt-2">{new Date(t.last_message_at).toLocaleString()}</p>
                            </button>
                        ))}
                    </div>
                </div>

                <div className={`lg:col-span-2 ${!active ? "hidden lg:block" : ""}`}>
                    {!active ? (
                        <div className="glass-strong p-10 text-center text-zinc-500">
                            <MessageSquare className="w-10 h-10 mx-auto opacity-40 mb-3" />
                            <p className="text-sm">Select a ticket to view the conversation, or create a new one.</p>
                        </div>
                    ) : (
                        <TicketThread role="user" ticket={active} messages={messages} setMessages={setMessages}
                            onBack={() => setActive(null)} onUpdate={loadTickets} />
                    )}
                </div>
            </div>

            {creating && <NewTicketModal onClose={() => setCreating(false)} onCreated={(t) => { setCreating(false); loadTickets(); openTicket(t); }} />}
        </DashboardLayout>
    );
}

export function TicketThread({ role, ticket, messages, setMessages, onBack, onUpdate }) {
    const [text, setText] = useState("");
    const [file, setFile] = useState("");
    const [err, setErr] = useState("");
    const scrollRef = useRef();

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const send = async () => {
        if (!text.trim()) return;
        setErr("");
        try {
            const url = role === "admin" ? `/admin/tickets/${ticket.id}/messages` : `/user/tickets/${ticket.id}/messages`;
            const { data } = await api.post(url, { body: text, attachment_data_url: file || undefined });
            setMessages(m => [...m, data]);
            setText(""); setFile("");
            onUpdate?.();
        } catch (e) { setErr(formatApiError(e)); }
    };

    const onFile = (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const r = new FileReader(); r.onload = () => setFile(String(r.result)); r.readAsDataURL(f);
    };

    return (
        <div className="glass-strong flex flex-col h-[600px]">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                    {onBack && <button onClick={onBack} className="lg:hidden text-zinc-400"><ChevronLeft className="w-5 h-5" /></button>}
                    <div className="min-w-0">
                        <h3 className="font-display text-lg truncate">{ticket.subject}</h3>
                        <p className="text-xs text-zinc-500">{role === "admin" ? `${ticket.user_name} · ${ticket.user_email}` : `Ticket #${ticket.id.slice(0, 8)}`}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <Badge color={STATUS_COLORS[ticket.status]}>{ticket.status}</Badge>
                    <Badge color={PRIORITY_COLORS[ticket.priority]}>{ticket.priority}</Badge>
                </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => {
                    const mine = (role === "user" && m.author_role === "user") || (role === "admin" && m.author_role === "admin");
                    return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] p-3 rounded-2xl ${mine ? "bg-purple-500/15 border border-purple-500/30 rounded-tr-sm" : "bg-white/5 border border-white/10 rounded-tl-sm"}`}>
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">{m.author_role === "admin" ? "Eregon Marketing Support" : "You"}</p>
                                <p className="text-sm whitespace-pre-wrap">{m.body}</p>
                                {m.attachment_data_url && <img src={m.attachment_data_url} alt="attachment" className="mt-2 rounded-lg max-h-40" />}
                                <p className="text-[10px] text-zinc-600 mt-1">{new Date(m.created_at).toLocaleString()}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="p-4 border-t border-white/5 space-y-2">
                {err && <p className="text-xs text-rose-400"><AlertCircle className="w-3.5 h-3.5 inline mr-1" />{err}</p>}
                {file && <div className="text-xs text-emerald-300 flex items-center gap-2"><Paperclip className="w-3.5 h-3.5" /> Attachment ready <button onClick={() => setFile("")}><X className="w-3 h-3" /></button></div>}
                <div className="flex flex-wrap gap-2">
                    <label className="btn-ghost py-2 px-3 cursor-pointer"><Paperclip className="w-4 h-4" /><input type="file" accept="image/*" className="hidden" onChange={onFile} /></label>
                    <input className="input-eregon flex-1" placeholder="Type your message..." value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} data-testid={`${role}-ticket-input`} />
                    <button onClick={send} className="btn-eregon" data-testid={`${role}-ticket-send`}><Send className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
}

function NewTicketModal({ onClose, onCreated }) {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [priority, setPriority] = useState("normal");
    const [file, setFile] = useState("");
    const [err, setErr] = useState("");

    const submit = async (e) => {
        e.preventDefault(); setErr("");
        try {
            const { data } = await api.post("/user/tickets", { subject, body, priority, attachment_data_url: file || undefined });
            onCreated(data);
        } catch (e) { setErr(formatApiError(e)); }
    };

    const onFile = (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const r = new FileReader(); r.onload = () => setFile(String(r.result)); r.readAsDataURL(f);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={submit} className="glass-strong max-w-lg w-full p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h3 className="font-display text-xl">New Support Ticket</h3>
                    <button type="button" onClick={onClose}><X className="w-5 h-5 text-zinc-400" /></button>
                </div>
                <input className="input-eregon" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} required minLength={2} />
                <textarea className="input-eregon min-h-[120px]" placeholder="Describe your request..." value={body} onChange={e => setBody(e.target.value)} required minLength={2} />
                <select className="input-eregon" value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="low">Low priority</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                    <Paperclip className="w-4 h-4" /> Attach screenshot (optional)
                    <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                </label>
                {file && <img src={file} alt="proof" className="rounded-lg max-h-32" />}
                {err && <p className="text-sm text-rose-400">{err}</p>}
                <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-ghost">Cancel</button><button className="btn-eregon" data-testid="submit-ticket">Submit</button></div>
            </form>
        </div>
    );
}
