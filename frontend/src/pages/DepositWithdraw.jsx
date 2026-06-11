import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { Badge } from "../components/ui-eregon";
import WithdrawalTimeline from "../components/WithdrawalTimeline";
import { api, formatApiError } from "../lib/api";
import { Copy, Check, Wallet as WalletIcon, UploadCloud, Eye } from "lucide-react";

export function Deposit() {
    const location = useLocation();
    const [wallets, setWallets] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [packages, setPackages] = useState([]);
    const [selected, setSelected] = useState(null);
    const [copied, setCopied] = useState("");
    const [amount, setAmount] = useState("");
    const [tx, setTx] = useState("");
    const [proof, setProof] = useState("");
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const selectedPackage = useMemo(
        () => packages.find((p) => p.id === query.get("package_id")) || null,
        [packages, query]
    );

    useEffect(() => {
        api.get("/user/wallets").then(r => { setWallets(r.data); if (r.data.length) setSelected(r.data[0]); });
        api.get("/user/deposits").then(r => setDeposits(r.data));
        api.get("/user/packages").then(r => setPackages(r.data || [])).catch(() => setPackages([]));
    }, []);

    useEffect(() => {
        const requestedAmount = query.get("amount");
        if (requestedAmount) setAmount(requestedAmount);
    }, [location.search, query]);

    const copy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(""), 1200);
    };

    const onFile = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => setProof(String(r.result));
        r.readAsDataURL(f);
    };

    const submit = async (e) => {
        e.preventDefault();
        setMsg(""); setErr("");
        try {
            await api.post("/user/deposits", {
                amount: parseFloat(amount),
                coin: selected.coin,
                tx_hash: tx,
                proof_data_url: proof,
                package_id: selectedPackage?.id || undefined,
            });
            setMsg(selectedPackage ? "Plan subscription submitted - pending Eregon approval." : "Deposit submitted - pending Eregon approval.");
            setAmount(""); setTx(""); setProof("");
            api.get("/user/deposits").then(r => setDeposits(r.data));
        } catch (e) { setErr(formatApiError(e)); }
    };

    return (
        <DashboardLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Eregon Wallet</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Deposit</h1>

            <div className="grid lg:grid-cols-2 gap-5 mt-8">
                <div className="glass-strong p-6">
                    <h3 className="font-display text-lg mb-4">Choose deposit wallet</h3>
                    <div className="space-y-2">
                        {wallets.map(w => (
                            <button key={w.id} type="button" onClick={() => setSelected(w)}
                                data-testid={`wallet-${w.coin}-${w.network}`}
                                className={`w-full text-left p-4 rounded-xl border transition-all ${selected?.id === w.id ? "bg-purple-500/10 border-purple-500/40" : "bg-black/40 border-white/5 hover:bg-white/5"}`}>
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="w-9 h-9 rounded-lg gradient-purple flex items-center justify-center"><WalletIcon className="w-4 h-4 text-white" /></span>
                                        <div>
                                            <p className="font-semibold">{w.coin} <span className="text-xs text-zinc-500">· {w.network}</span></p>
                                            <p className="text-xs text-zinc-400 truncate max-w-[200px]">{w.address}</p>
                                        </div>
                                    </div>
                                    <Badge color="gold">{w.coin}</Badge>
                                </div>
                            </button>
                        ))}
                    </div>
                    {selected && (
                        <div className="mt-5 bg-black/40 border border-white/5 rounded-xl p-4">
                            <p className="text-xs text-zinc-500 uppercase tracking-widest">Wallet Address</p>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2 gap-2">
                                <code className="text-sm text-amber-200 break-all">{selected.address}</code>
                                <button onClick={() => copy(selected.address, selected.id)} className="btn-ghost text-xs py-1.5 px-3">
                                    {copied === selected.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                            {selected.note && <p className="text-xs text-zinc-400 mt-2">{selected.note}</p>}
                        </div>
                    )}
                </div>

                <form className="glass-strong p-6 space-y-4" onSubmit={submit} data-testid="deposit-form">
                    <h3 className="font-display text-lg">Submit deposit proof</h3>
                    {selectedPackage && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
                            <p className="text-xs uppercase tracking-widest text-amber-300">Plan subscription</p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="font-display text-lg">{selectedPackage.name}</span>
                                <Badge color="gold">${Number(selectedPackage.investment || 0).toLocaleString()}</Badge>
                            </div>
                            <p className="text-xs text-zinc-400 mt-2">Your plan activates after an admin approves this deposit proof.</p>
                        </div>
                    )}
                    <input className="input-eregon" type="number" min="0" step="any" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} required data-testid="deposit-amount" />
                    <input className="input-eregon" placeholder="Transaction hash (optional)" value={tx} onChange={e => setTx(e.target.value)} />
                    <label className="block">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest">Proof screenshot</span>
                        <div className="mt-2 p-4 rounded-xl border border-dashed border-white/10 bg-black/40 flex items-center gap-3 cursor-pointer">
                            <UploadCloud className="w-5 h-5 text-purple-300" />
                            <input type="file" accept="image/*" onChange={onFile} className="text-xs text-zinc-300" />
                        </div>
                        {proof && <img src={proof} alt="proof" className="mt-3 rounded-lg max-h-40" />}
                    </label>
                    {msg && <p className="text-sm text-emerald-300">{msg}</p>}
                    {err && <p className="text-sm text-rose-400">{err}</p>}
                    <button className="btn-eregon w-full" disabled={!selected} data-testid="deposit-submit">Submit Deposit</button>
                </form>
            </div>

            <div className="glass-strong p-6 mt-6">
                <h3 className="font-display text-lg mb-4">Deposit history</h3>
                {deposits.length === 0 ? (
                    <p className="text-sm text-zinc-500">No deposits yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[720px]">
                            <thead><tr className="text-xs uppercase text-zinc-500"><th className="text-left py-2">Coin</th><th className="text-left">Amount</th><th className="text-left">Plan</th><th className="text-left">Status</th><th className="text-left">Date</th></tr></thead>
                            <tbody>
                                {deposits.map(d => (
                                    <tr key={d.id} className="border-t border-white/5">
                                        <td className="py-3">{d.coin}</td>
                                        <td>{d.amount}</td>
                                        <td className="text-zinc-400">{d.package_name || "—"}</td>
                                        <td><Badge color={d.status === "approved" ? "emerald" : d.status === "rejected" ? "rose" : "gold"}>{d.status}</Badge></td>
                                        <td className="text-zinc-400">{new Date(d.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

export function Withdraw() {
    const [user, setUser] = useState(null);
    const [eligibility, setEligibility] = useState(null);
    const [list, setList] = useState([]);
    const [amount, setAmount] = useState("");
    const [coin, setCoin] = useState("USDT");
    const [address, setAddress] = useState("");
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const [showTimeline, setShowTimeline] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const load = () => {
        api.get("/auth/me").then(r => { setUser(r.data); setCoin(r.data.coin_symbol); });
        api.get("/user/withdrawals").then(r => setList(r.data));
        api.get("/user/withdrawal-eligibility").then(r => setEligibility(r.data)).catch(() => setEligibility(null));
    };

    useEffect(() => { load(); }, []);

    const submit = async (e) => {
        e.preventDefault();
        setMsg(""); setErr("");
        setSubmitting(true);
        try {
            const value = Number(amount);
            if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid withdrawal amount.");
            if (!address.trim()) throw new Error("Enter your destination wallet address or payment ID.");
            await api.post("/user/withdrawals", { amount: value, coin, address: address.trim() });
            setMsg("Withdrawal submitted for admin review.");
            setAmount(""); setAddress("");
            await load();
        } catch (e) { setErr(formatApiError(e)); }
        finally { setSubmitting(false); }
    };

    const amountValue = Number(amount || 0);
    const maxWithdrawable = Number(eligibility?.withdrawable_balance ?? user?.balance ?? 0);
    const minimumWithdrawal = Number(eligibility?.minimum_withdrawal ?? 0);
    const canSubmit = !submitting && amountValue > 0 && address.trim().length >= 8;
    const localWarning = amountValue > 0 && eligibility
        ? amountValue < minimumWithdrawal
            ? `Minimum withdrawal is ${minimumWithdrawal} ${coin}.`
            : amountValue > maxWithdrawable
                ? `Amount exceeds your withdrawable balance of ${maxWithdrawable.toLocaleString()} ${coin}.`
                : eligibility.failed?.length
                    ? "Your account is not eligible yet. See the rule messages below."
                    : ""
        : "";

    return (
        <DashboardLayout>
            <p className="text-xs uppercase tracking-widest text-amber-400/80">Withdrawal Request</p>
            <h1 className="text-2xl sm:text-3xl md:text-2xl sm:text-4xl font-display font-semibold mt-1">Withdraw</h1>
            <p className="text-zinc-400 max-w-3xl mt-2">Withdrawals are checked against your withdrawable balance, pending withdrawals, locked balance, minimum amount, and admin review rules.</p>

            <div className="grid lg:grid-cols-3 gap-5 mt-8">
                <form className="glass-strong p-6 space-y-4 lg:col-span-1" onSubmit={submit} data-testid="withdraw-form">
                    <h3 className="font-display text-lg">Request withdrawal</h3>
                    {eligibility ? (
                        <div className="rounded-xl border border-white/10 bg-black/35 p-4 space-y-2 text-sm">
                            <div className="flex justify-between"><span className="text-zinc-400">Total balance</span><span>{eligibility.total_balance?.toLocaleString()} {coin}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-400">Pending withdrawals</span><span>{eligibility.pending_withdrawal?.toLocaleString()} {coin}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-400">Locked balance</span><span>{eligibility.locked_balance?.toLocaleString()} {coin}</span></div>
                            <div className="flex justify-between border-t border-white/10 pt-2"><span className="text-zinc-300">Withdrawable</span><span className="gradient-text-gold font-semibold">{eligibility.withdrawable_balance?.toLocaleString()} {coin}</span></div>
                            <p className="text-xs text-zinc-500">Minimum withdrawal: {eligibility.minimum_withdrawal} {coin}</p>
                        </div>
                    ) : user && <p className="text-xs text-zinc-400">Available: <span className="gradient-text-gold">{user.balance.toLocaleString()} {user.coin_symbol}</span></p>}
                    <input className="input-eregon" type="number" min="0" step="any" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} required data-testid="withdraw-amount" />
                    <select className="input-eregon" value={coin} onChange={e => setCoin(e.target.value)} data-testid="withdraw-coin">
                        <option value="USDT">USDT</option><option value="BTC">BTC</option><option value="ETH">ETH</option><option value="BNB">BNB</option>
                    </select>
                    <input className="input-eregon" placeholder="Destination wallet address or payment ID" value={address} onChange={e => setAddress(e.target.value)} required data-testid="withdraw-address" />
                    {localWarning && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100">{localWarning}</div>}
                    {eligibility?.failed?.length > 0 && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200 space-y-1">{eligibility.failed.map((f, i) => <p key={i}>• {f.message}</p>)}</div>}
                    {eligibility?.review?.length > 0 && <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-100 space-y-1">{eligibility.review.map((r, i) => <p key={i}>• {r.message}</p>)}</div>}
                    {msg && <p className="text-sm text-emerald-300">{msg}</p>}
                    {err && <p className="text-sm text-rose-400">{err}</p>}
                    <button className="btn-eregon w-full disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canSubmit} data-testid="withdraw-submit">{submitting ? "Submitting..." : "Submit Request"}</button>
                    {address && address.trim().length < 8 && <p className="text-xs text-rose-300">Enter a valid destination address or payment ID.</p>}
                    {user && <p className="text-xs text-zinc-500">Processing time: ~{user.withdrawal_processing_hours}h after approval.</p>}
                </form>

                <div className="glass-strong p-6 lg:col-span-2">
                    <h3 className="font-display text-lg mb-4">Withdrawal history</h3>
                    {list.length === 0 ? (
                        <p className="text-sm text-zinc-500">No withdrawals yet.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[720px]">
                                <thead><tr className="text-xs uppercase text-zinc-500"><th className="text-left py-2">Amount</th><th className="text-left">Coin</th><th className="text-left">Address</th><th className="text-left">Status</th><th className="text-left">ETA</th><th className="text-left">Date</th><th className="text-left">Note</th><th></th></tr></thead>
                                <tbody>
                                    {list.map(w => (
                                        <tr key={w.id} className="border-t border-white/5">
                                            <td className="py-3 gradient-text-gold font-semibold">{w.amount}</td>
                                            <td>{w.coin}</td>
                                            <td className="truncate max-w-[180px]">{w.address}</td>
                                            <td><Badge color={["approved","processing","completed"].includes(w.status) ? "emerald" : w.status === "rejected" ? "rose" : w.status === "reviewing" ? "purple" : "gold"}>{w.status}</Badge></td>
                                            <td className="text-zinc-400">{w.processing_hours}h</td>
                                            <td className="text-zinc-400">{new Date(w.created_at).toLocaleDateString()}</td>
                                            <td className="text-zinc-400 max-w-[200px] truncate">{w.admin_note || "—"}</td>
                                            <td><button onClick={() => setShowTimeline(w)} className="text-purple-300 hover:text-purple-200 text-xs flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> View</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
            {showTimeline && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowTimeline(null)}>
                    <div className="glass-strong max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <div>
                                <h3 className="font-display text-xl">Withdrawal #{showTimeline.id.slice(0, 8)}</h3>
                                <p className="text-sm text-zinc-400">{showTimeline.amount} {showTimeline.coin}</p>
                            </div>
                            <button onClick={() => setShowTimeline(null)} className="text-zinc-400 hover:text-white">✕</button>
                        </div>
                        <WithdrawalTimeline status={showTimeline.status} processingHours={showTimeline.processing_hours} adminNote={showTimeline.admin_note} />
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
