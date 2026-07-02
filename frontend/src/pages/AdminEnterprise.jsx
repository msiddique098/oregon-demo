import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, BarChart3, BellRing, Bot, Clock, MessageCircle, Plus, RefreshCw, ShieldAlert, SlidersHorizontal, Target, TrendingUp, WalletCards, Crown } from "lucide-react";
import AdminLayout from "../components/AdminLayout";
import { api, formatApiError } from "../lib/api";
import AnimatedCounter from "../components/AnimatedCounter";

const emptyRule = { name: "Minimum withdrawable balance", rule_type: "minimum_balance", enabled: true, value: { amount: 25 }, message: "Reach 25 USDT withdrawable balance before requesting withdrawal.", priority: 10 };
const emptyCampaign = { name: "Weekend Eregon Boost", campaign_type: "countdown", active: true, starts_at: "", ends_at: "", content: { message: "Complete tasks before the event ends." } };

export default function AdminEnterprise() {
    const [overview, setOverview] = useState(null);
    const [settings, setSettings] = useState([]);
    const [rules, setRules] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [fraud, setFraud] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [marketTargets, setMarketTargets] = useState([]);
    const [rule, setRule] = useState(emptyRule);
    const [campaign, setCampaign] = useState(emptyCampaign);
    const [profit, setProfit] = useState({ target: "all", tier: "", user_ids: "", amount: 1, percent: "", balance_field: "balance", note: "Admin profit accrual" });
    const [integration, setIntegration] = useState({ provider: "whatsapp", enabled: false, display_name: "WhatsApp Support", public_link: "", webhook_url: "", settings: {} });
    const [minimum, setMinimum] = useState(25);
    const [referralRewards, setReferralRewards] = useState({ enabled: true, referrer_reward: 5, referred_reward: 2, first_deposit_commission_pct: 5 });
    const [marketTarget, setMarketTarget] = useState({ symbol: "BTC", target_price: "", duration_seconds: 12 });

    const load = async () => {
        try {
            const [ov, set, wr, camp, fr, msg, mt] = await Promise.all([
                api.get("/admin/enterprise/overview"),
                api.get("/admin/platform-settings"),
                api.get("/admin/withdrawal-rules"),
                api.get("/admin/campaigns"),
                api.get("/admin/fraud/users"),
                api.get("/admin/message-integrations"),
                api.get("/admin/market-targets"),
            ]);
            setOverview(ov.data); setSettings(set.data || []); setRules(wr.data || []); setCampaigns(camp.data || []); setFraud(fr.data || []); setIntegrations(msg.data || []); setMarketTargets(mt.data || []);
            const w = (set.data || []).find((x) => x.key === "withdrawal_config");
            if (w?.value?.minimum_withdrawal) setMinimum(w.value.minimum_withdrawal);
            const rr = (set.data || []).find((x) => x.key === "referral_rewards");
            if (rr?.value) setReferralRewards({ enabled: rr.value.enabled !== false, referrer_reward: rr.value.referrer_reward ?? 5, referred_reward: rr.value.referred_reward ?? 2, first_deposit_commission_pct: rr.value.first_deposit_commission_pct ?? 5 });
        } catch (e) { toast.error(formatApiError(e)); }
    };

    useEffect(() => { load(); }, []);

    const stats = useMemo(() => overview || {}, [overview]);

    const saveMinimum = async () => {
        try {
            await api.post("/admin/platform-settings", { key: "withdrawal_config", value: { minimum_withdrawal: Number(minimum), currency: "USDT", review_delay_hours: 24 }, description: "Transparent withdrawal configuration shown to users." });
            toast.success("Withdrawal configuration updated"); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const saveReferralRewards = async () => {
        try {
            await api.post("/admin/platform-settings", {
                key: "referral_rewards",
                value: {
                    enabled: referralRewards.enabled,
                    referrer_reward: Number(referralRewards.referrer_reward || 0),
                    referred_reward: Number(referralRewards.referred_reward || 0),
                    first_deposit_commission_pct: Number(referralRewards.first_deposit_commission_pct || 0),
                    qualification_rule: "first_approved_task",
                },
                description: "Referral rewards after first approved task, plus first-deposit referral commission.",
            });
            toast.success("Referral rewards updated"); load();
        } catch (e) { toast.error(formatApiError(e)); }
    };

    const createRule = async (e) => {
        e.preventDefault();
        try {
            await api.post("/admin/withdrawal-rules", { ...rule, priority: Number(rule.priority || 100) });
            toast.success("Withdrawal rule created"); setRule(emptyRule); load();
        } catch (e2) { toast.error(formatApiError(e2)); }
    };

    const createCampaign = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...campaign, starts_at: campaign.starts_at || null, ends_at: campaign.ends_at || null };
            await api.post("/admin/campaigns", payload);
            toast.success("Campaign created"); setCampaign(emptyCampaign); load();
        } catch (e2) { toast.error(formatApiError(e2)); }
    };

    const runProfit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...profit, amount: profit.amount === "" ? null : Number(profit.amount), percent: profit.percent === "" ? null : Number(profit.percent), user_ids: profit.user_ids ? profit.user_ids.split(",").map((x) => x.trim()).filter(Boolean) : null };
            const { data } = await api.post("/admin/simulations/profit-accrual", payload);
            toast.success(`Applied to ${data.affected} users`); load();
        } catch (e2) { toast.error(formatApiError(e2)); }
    };

    const saveIntegration = async (e) => {
        e.preventDefault();
        try {
            await api.post("/admin/message-integrations", integration);
            toast.success("Messaging integration saved"); load();
        } catch (e2) { toast.error(formatApiError(e2)); }
    };

    const saveMarketTarget = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post("/admin/market-targets", {
                symbol: marketTarget.symbol,
                target_price: Number(marketTarget.target_price),
                duration_seconds: Number(marketTarget.duration_seconds || 12),
            });
            toast.success(`${data.target.symbol} will reach ${data.target.target_price} in ${data.target.duration_seconds}s`);
            setMarketTarget({ ...marketTarget, target_price: "" });
            load();
        } catch (e2) { toast.error(formatApiError(e2)); }
    };

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-amber-400/70">Enterprise Control Center</p>
                        <h1 className="font-display text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-semibold mt-2">Safe Growth & Risk Controls</h1>
                        <p className="text-zinc-400 mt-2 max-w-3xl">Transparent withdrawal rules, real social proof, campaigns, analytics, profit accrual tools, anti-fraud monitoring, and WhatsApp/Telegram support configuration.</p>
                    </div>
                    <button onClick={load} className="btn-ghost"><RefreshCw className="w-4 h-4" /> Refresh</button>
                </div>

                <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
                    <Stat icon={Activity} label="Users" value={stats.users} />
                    <Stat icon={WalletCards} label="Withdrawals 7d" value={stats.withdrawals_7d} />
                    <Stat icon={BarChart3} label="Deposits 7d" value={stats.deposits_7d} />
                    <Stat icon={Target} label="Analytics Events" value={stats.analytics_events_7d} />
                    <Stat icon={ShieldAlert} label="High Risk 7d" value={stats.high_risk_7d} danger />
                </div>

                <div className="grid xl:grid-cols-3 gap-4 sm:gap-6 items-start">
                    <Panel title="Market Price Controls" icon={TrendingUp}>
                        <form onSubmit={saveMarketTarget} className="space-y-3">
                            <Input label="Coin Symbol" value={marketTarget.symbol} onChange={(v) => setMarketTarget({ ...marketTarget, symbol: v.toUpperCase() })} placeholder="BTC, ETH, ERGN" />
                            <Input label="Target Price (USD)" type="number" value={marketTarget.target_price} onChange={(v) => setMarketTarget({ ...marketTarget, target_price: v })} />
                            <Select label="Ease Duration" value={marketTarget.duration_seconds} onChange={(v) => setMarketTarget({ ...marketTarget, duration_seconds: Number(v) })} options={[10, 11, 12, 13, 14, 15]} />
                            <p className="text-xs text-zinc-500">The visible price moves gradually to the target instead of jumping immediately.</p>
                            <button className="btn-gold w-full" type="submit">Set Price Target</button>
                        </form>
                        <List items={marketTargets.slice(0, 8)} render={(m) => <><span>{m.symbol} → ${Number(m.target_price || 0).toLocaleString()}</span><small>{m.status} · {m.duration_seconds}s</small></>} />
                    </Panel>

                    <Panel title="Configurable Withdrawal Rules" icon={SlidersHorizontal}>
                        <div className="grid grid-cols-[1fr_auto] gap-2 mb-4">
                            <Input label="Minimum Withdrawal" type="number" value={minimum} onChange={setMinimum} />
                            <button onClick={saveMinimum} className="btn-gold self-end" type="button">Save</button>
                        </div>
                        <form onSubmit={createRule} className="space-y-3">
                            <Input label="Rule Name" value={rule.name} onChange={(v) => setRule({ ...rule, name: v })} />
                            <Select label="Rule Type" value={rule.rule_type} onChange={(v) => setRule({ ...rule, rule_type: v })} options={["minimum_balance", "kyc_required", "account_age_days", "vip_level", "manual_review", "cooldown_hours"]} />
                            <Input label="Value JSON" value={JSON.stringify(rule.value)} onChange={(v) => { try { setRule({ ...rule, value: JSON.parse(v || "{}") }); } catch (_) {} }} />
                            <Input label="User Message" value={rule.message} onChange={(v) => setRule({ ...rule, message: v })} />
                            <button className="btn-gold w-full" type="submit"><Plus className="w-4 h-4" /> Add Rule</button>
                        </form>
                        <List items={rules} render={(r) => <><span>{r.name}</span><small>{r.rule_type} · {r.enabled ? "on" : "off"}</small></>} />
                    </Panel>

                    <Panel title="Referral Rewards" icon={Crown}>
                        <div className="space-y-3">
                            <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={referralRewards.enabled} onChange={(e) => setReferralRewards({ ...referralRewards, enabled: e.target.checked })} /> Enable referral rewards</label>
                            <Input label="Reward for referring user" type="number" value={referralRewards.referrer_reward} onChange={(v) => setReferralRewards({ ...referralRewards, referrer_reward: v })} />
                            <Input label="Reward for referred user" type="number" value={referralRewards.referred_reward} onChange={(v) => setReferralRewards({ ...referralRewards, referred_reward: v })} />
                            <Input label="First deposit commission % for referrer" type="number" value={referralRewards.first_deposit_commission_pct} onChange={(v) => setReferralRewards({ ...referralRewards, first_deposit_commission_pct: v })} />
                            <p className="text-xs text-zinc-500">Signup referral is optional. Task rewards are credited after the invited member's first approved task. First-deposit commission is paid once when that invited member's first deposit is approved.</p>
                            <button onClick={saveReferralRewards} className="btn-gold w-full" type="button">Save Referral Rewards</button>
                        </div>
                    </Panel>

                    <Panel title="Campaigns & Urgency Cues" icon={Clock}>
                        <form onSubmit={createCampaign} className="space-y-3">
                            <Input label="Campaign Name" value={campaign.name} onChange={(v) => setCampaign({ ...campaign, name: v })} />
                            <Select label="Type" value={campaign.campaign_type} onChange={(v) => setCampaign({ ...campaign, campaign_type: v })} options={["countdown", "deposit_bonus", "task_boost", "referral_boost", "announcement"]} />
                            <Input label="Ends At" type="datetime-local" value={campaign.ends_at} onChange={(v) => setCampaign({ ...campaign, ends_at: v })} />
                            <Input label="Message" value={campaign.content.message} onChange={(v) => setCampaign({ ...campaign, content: { ...campaign.content, message: v } })} />
                            <button className="btn-gold w-full" type="submit"><BellRing className="w-4 h-4" /> Create Campaign</button>
                        </form>
                        <List items={campaigns} render={(c) => <><span>{c.name}</span><small>{c.campaign_type} · {c.active ? "active" : "off"}</small></>} />
                    </Panel>

                    <Panel title="Profit Accrual Tool" icon={Bot}>
                        <form onSubmit={runProfit} className="space-y-3">
                            <Select label="Target" value={profit.target} onChange={(v) => setProfit({ ...profit, target: v })} options={["all", "tier", "ids"]} />
                            <Input label="Tier or User IDs" value={profit.target === "tier" ? profit.tier : profit.user_ids} onChange={(v) => setProfit(profit.target === "tier" ? { ...profit, tier: v } : { ...profit, user_ids: v })} placeholder="Gold or id1,id2" />
                            <Select label="Balance Field" value={profit.balance_field} onChange={(v) => setProfit({ ...profit, balance_field: v })} options={["balance", "bonus_balance", "daily_profit"]} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2"><Input label="Amount" type="number" value={profit.amount} onChange={(v) => setProfit({ ...profit, amount: v })} /><Input label="Percent" type="number" value={profit.percent} onChange={(v) => setProfit({ ...profit, percent: v })} /></div>
                            <button className="btn-gold w-full" type="submit">Run Audited Accrual</button>
                        </form>
                    </Panel>
                </div>

                <div className="grid xl:grid-cols-2 gap-4 sm:gap-6 items-start">
                    <Panel title="Anti-Fraud Risk Monitor" icon={ShieldAlert}>
                        <List items={fraud.slice(0, 12)} render={(r) => <><span>{r.user_id}</span><small>{r.risk_level} · score {r.risk_score}</small></>} />
                    </Panel>
                    <Panel title="WhatsApp / Telegram / Support Channels" icon={MessageCircle}>
                        <form onSubmit={saveIntegration} className="grid md:grid-cols-2 gap-3">
                            <Select label="Provider" value={integration.provider} onChange={(v) => setIntegration({ ...integration, provider: v })} options={["whatsapp", "telegram", "email", "custom_webhook"]} />
                            <Input label="Display Name" value={integration.display_name} onChange={(v) => setIntegration({ ...integration, display_name: v })} />
                            <Input label="Public Link" value={integration.public_link} onChange={(v) => setIntegration({ ...integration, public_link: v })} placeholder="https://wa.me/..." />
                            <Input label="Webhook URL" value={integration.webhook_url} onChange={(v) => setIntegration({ ...integration, webhook_url: v })} />
                            <label className="flex items-center gap-2 text-sm text-zinc-300"><input type="checkbox" checked={integration.enabled} onChange={(e) => setIntegration({ ...integration, enabled: e.target.checked })} /> Enabled</label>
                            <button className="btn-gold" type="submit">Save Channel</button>
                        </form>
                        <List items={integrations} render={(i) => <><span>{i.display_name || i.provider}</span><small>{i.provider} · {i.enabled ? "enabled" : "disabled"}</small></>} />
                    </Panel>
                </div>
            </div>
        </AdminLayout>
    );
}

function Stat({ icon: Icon, label, value, danger }) { return <div className="glass p-5 border-white/10"><div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><p className="text-sm text-zinc-400">{label}</p><Icon className={`w-5 h-5 ${danger ? "text-rose-300" : "text-amber-300"}`} /></div><p className="font-display text-2xl mt-4"><AnimatedCounter value={Number(value || 0)} decimals={0} /></p></div>; }
function Panel({ title, icon: Icon, children }) { return <div className="glass-strong p-5 border-amber-500/10"><div className="flex items-center gap-2 mb-4"><Icon className="w-5 h-5 text-amber-300" /><h2 className="font-display text-xl font-semibold">{title}</h2></div>{children}</div>; }
function Input({ label, value, onChange, type = "text", placeholder }) { return <label className="block space-y-1"><span className="text-xs text-zinc-400">{label}</span><input type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/40" /></label>; }
function Select({ label, value, onChange, options }) { return <label className="block space-y-1"><span className="text-xs text-zinc-400">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/40">{options.map((o) => <option key={o} value={o}>{o}</option>)}</select></label>; }
function List({ items, render }) { return <div className="mt-4 space-y-2 max-h-72 overflow-auto pr-1">{(!items || items.length === 0) ? <p className="text-sm text-zinc-500">No records yet.</p> : items.map((item, i) => <div key={item.id || item.user_id || i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 gap-3 bg-white/[0.03] border border-white/5 rounded-xl p-3 text-sm"><div className="flex flex-col">{render(item)}</div></div>)}</div>; }
