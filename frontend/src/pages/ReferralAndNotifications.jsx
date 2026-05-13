import React, { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { Badge } from "../components/ui-royal";
import { api, formatApiError } from "../lib/api";
import { Copy, Check, Users, TrendingUp, Crown, Bell, Gift } from "lucide-react";
import { toast } from "sonner";

export function Referral() {
    const [data, setData] = useState(null);
    const [tree, setTree] = useState(null);
    const [copied, setCopied] = useState(false);

    const load = async () => {
        try {
            const [dash, refTree] = await Promise.all([api.get("/user/dashboard"), api.get("/referrals/tree")]);
            setData(dash.data);
            setTree(refTree.data);
        } catch (e) { toast.error(formatApiError(e)); }
    };

    useEffect(() => { load(); }, []);
    if (!data) return <DashboardLayout><div className="text-zinc-400">Loading...</div></DashboardLayout>;
    const u = data.user;
    const referralCode = tree?.referral_code || u.referral_code;
    const link = `${window.location.origin}/register?ref=${referralCode}`;
    const config = tree?.config || { enabled: true, referrer_reward: 5, referred_reward: 2, first_deposit_commission_pct: 5 };
    const records = tree?.records || [];

    const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); };

    return (
        <DashboardLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Referral Rewards</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Invite members and earn together</h1>
            <p className="text-sm text-zinc-400 mt-2 max-w-3xl">Referral code is optional during signup. When an invited member gets their first task approved, both accounts receive the configured task referral rewards. You also earn a one-time commission from that member's first approved deposit.</p>

            <div className="grid lg:grid-cols-3 gap-5 mt-8">
                <div className="glass-strong p-6 lg:col-span-2 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-px bg-amber-400/60"></div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 gap-3 flex-wrap">
                        <div>
                            <p className="text-xs uppercase tracking-widest text-zinc-500">Your referral link</p>
                            <p className="text-xs text-zinc-500 mt-1">Reward rules: first approved task + first approved deposit commission</p>
                        </div>
                        <Badge color={config.enabled ? "gold" : "purple"}>{config.enabled ? "active" : "paused"}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2 bg-black/40 border border-white/5 rounded-xl p-3">
                        <code className="text-sm text-amber-200 truncate flex-1" data-testid="referral-link">{link}</code>
                        <button onClick={copy} className="btn-ghost text-xs py-1.5 px-3" data-testid="referral-copy">
                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy"}
                        </button>
                    </div>
                    <div className="grid sm:grid-cols-5 gap-3 mt-5">
                        <Stat label="Invited" icon={Users} value={data.referrals_count} />
                        <Stat label="Earnings" icon={TrendingUp} value={`${Number(u.referral_earnings || 0).toFixed(2)} ${u.coin_symbol}`} accent="gold" />
                        <Stat label="You Receive" icon={Crown} value={`$${Number(config.referrer_reward || 0).toFixed(2)}`} accent="purple" />
                        <Stat label="They Receive" icon={Gift} value={`$${Number(config.referred_reward || 0).toFixed(2)}`} accent="gold" />
                        <Stat label="Deposit Commission" icon={TrendingUp} value={`${Number(config.first_deposit_commission_pct || 0).toFixed(1)}%`} accent="purple" />
                    </div>
                </div>

                <div className="glass-strong p-6">
                    <h3 className="font-display text-lg mb-3">Referral Status</h3>
                    {records.length === 0 ? (
                        <p className="text-sm text-zinc-500">No referral records yet. Share your link to begin.</p>
                    ) : (
                        <ul className="space-y-2 max-h-80 overflow-auto pr-1">
                            {records.map((r, i) => (
                                <li key={r.id || i} className="p-3 bg-black/40 border border-white/5 rounded-xl">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 gap-2">
                                        <p className="text-sm font-medium truncate">{r.referred_user_id}</p>
                                        <Badge color={r.status === "rewarded" ? "gold" : "purple"}>{r.status}</Badge>
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">Task reward: ${Number(r.referrer_reward || 0).toFixed(2)} / ${Number(r.referred_reward || 0).toFixed(2)}</p>
                                    <p className="text-xs text-zinc-500 mt-1">First deposit commission: {r.first_deposit_commission_paid ? `$${Number(r.first_deposit_commission_amount || 0).toFixed(2)}` : `${Number(r.first_deposit_commission_pct || config.first_deposit_commission_pct || 0).toFixed(1)}% pending`}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

function Stat({ label, value, icon: Icon, accent = "purple" }) {
    const map = { purple: "gradient-text-purple", gold: "gradient-text-gold" };
    return (
        <div className="bg-black/40 border border-white/5 rounded-xl p-4">
            <Icon className="w-4 h-4 text-zinc-500" />
            <p className="text-xs uppercase tracking-widest text-zinc-500 mt-2">{label}</p>
            <p className={`text-xl font-display font-semibold mt-1 ${map[accent] || ""}`}>{value}</p>
        </div>
    );
}

export function Notifications() {
    const [list, setList] = useState([]);
    useEffect(() => { api.get("/user/notifications").then(r => setList(r.data)); }, []);
    return (
        <DashboardLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Notifications</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Royal Inbox</h1>
            <div className="glass-strong p-6 mt-8">
                {list.length === 0 ? (
                    <p className="text-sm text-zinc-500">No notifications yet.</p>
                ) : (
                    <div className="space-y-3">
                        {list.map(n => (
                            <div key={n.id} className="p-4 bg-black/40 border border-white/5 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <Bell className="w-4 h-4 text-purple-300 mt-1" />
                                    <div className="flex-1">
                                        <p className="text-sm font-semibold">{n.title}</p>
                                        <p className="text-xs text-zinc-400 mt-1">{n.body}</p>
                                    </div>
                                    {!n.read && <Badge color="gold">new</Badge>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
