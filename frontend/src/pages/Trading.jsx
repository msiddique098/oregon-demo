import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { ArrowDownRight, ArrowUpDown, ArrowUpRight, RefreshCcw, Search, ShieldCheck, Wallet } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge, Card } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const formatUsd = (value, max = 6) => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: Number(value || 0) >= 1 ? 2 : max });
const formatAmt = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 10 });
const pct = (value) => `${Number(value || 0) >= 0 ? "+" : ""}${Number(value || 0).toFixed(2)}%`;

function useQueryPair() {
    const { search } = useLocation();
    return new URLSearchParams(search).get("pair") || "BTC/USDT";
}

function MiniOrderBook({ price }) {
    const p = Number(price || 0);
    const rows = Array.from({ length: 7 }).map((_, i) => {
        const spread = (i + 1) * 0.0007;
        return { ask: p * (1 + spread), bid: p * (1 - spread), size: (Math.sin(i + p) + 1.3) * 2.5 + i };
    });
    return <div className="space-y-1 text-xs">
        {rows.slice().reverse().map((r, i) => <div key={`ask-${i}`} className="grid grid-cols-3 gap-2 text-rose-300"><span>{formatAmt(r.ask)}</span><span className="text-right text-zinc-500">{formatAmt(r.size)}</span><span className="h-5 rounded bg-rose-500/10" style={{ width: `${Math.min(100, r.size * 9)}%` }} /></div>)}
        <div className="py-2 text-center font-display text-lg gradient-text-gold">{formatAmt(p)}</div>
        {rows.map((r, i) => <div key={`bid-${i}`} className="grid grid-cols-3 gap-2 text-emerald-300"><span>{formatAmt(r.bid)}</span><span className="text-right text-zinc-500">{formatAmt(r.size)}</span><span className="h-5 rounded bg-emerald-500/10" style={{ width: `${Math.min(100, r.size * 9)}%` }} /></div>)}
    </div>;
}

export default function Trading() {
    const queryPair = useQueryPair();
    const [marketPayload, setMarketPayload] = useState(null);
    const [pairs, setPairs] = useState([]);
    const [portfolio, setPortfolio] = useState(null);
    const [orders, setOrders] = useState([]);
    const [selectedPair, setSelectedPair] = useState(queryPair);
    const [side, setSide] = useState("buy");
    const [amount, setAmount] = useState("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const load = async (force = false) => {
        try {
            const [m, p, port, o] = await Promise.all([
                api.get("/markets", { params: { limit: 200, include_custom: true, force } }),
                api.get("/trading/pairs"),
                api.get("/trading/portfolio"),
                api.get("/trading/orders", { params: { limit: 25 } }),
            ]);
            setMarketPayload(m.data);
            setPairs(p.data.pairs || []);
            setPortfolio(port.data);
            setOrders(o.data || []);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setSelectedPair(queryPair);
    }, [queryPair]);

    useEffect(() => {
        load();
        const timer = window.setInterval(() => load(false), 15000);
        return () => window.clearInterval(timer);
    }, []);

    const markets = marketPayload?.coins || [];
    const marketBySymbol = useMemo(() => Object.fromEntries(markets.map((c) => [String(c.symbol || "").toUpperCase(), c])), [markets]);
    const pairInfo = useMemo(() => {
        const raw = selectedPair.toUpperCase().replace("-", "/");
        const [base = "BTC", quote = "USDT"] = raw.split("/");
        const baseMarket = marketBySymbol[base] || {};
        const quoteMarket = marketBySymbol[quote] || { current_price: 1 };
        const rate = Number(baseMarket.current_price || 0) / Math.max(0.00000001, Number(quoteMarket.current_price || 1));
        return { pair: `${base}/${quote}`, base, quote, rate, baseMarket, quoteMarket };
    }, [selectedPair, marketBySymbol]);

    const filteredPairs = useMemo(() => {
        const s = search.toLowerCase().trim();
        return pairs.filter((p) => !s || p.pair.toLowerCase().includes(s));
    }, [pairs, search]);

    const chartData = useMemo(() => {
        const prices = pairInfo.baseMarket?.sparkline_in_7d?.price || [];
        return prices.slice(-80).map((price, i) => ({ i, price: Number(price || 0) }));
    }, [pairInfo.baseMarket]);

    const quoteBalance = Number(portfolio?.balances?.[pairInfo.quote] || 0);
    const baseBalance = Number(portfolio?.balances?.[pairInfo.base] || 0);
    const estimated = side === "buy" ? (Number(amount || 0) / Math.max(pairInfo.rate, 0.00000001)) * (1 - Number(portfolio?.fee_rate || 0.001)) : (Number(amount || 0) * pairInfo.rate) * (1 - Number(portfolio?.fee_rate || 0.001));

    const submit = async () => {
        if (!amount || Number(amount) <= 0) return toast.error("Enter a valid order amount");
        setSubmitting(true);
        try {
            const { data } = await api.post("/trading/orders", { pair: pairInfo.pair, side, amount: Number(amount), order_type: "market" });
            toast.success(`${side === "buy" ? "Bought" : "Sold"} ${data.trade.executed_base} ${data.trade.base_symbol}`);
            setAmount("");
            await load(true);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <DashboardLayout><CinematicLoader /></DashboardLayout>;

    const up = Number(pairInfo.baseMarket?.price_change_percentage_24h || 0) >= 0;

    return <DashboardLayout>
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
            <div>
                <p className="text-xs uppercase tracking-[0.28em] text-amber-400/80">Eregon Exchange</p>
                <h1 className="text-3xl sm:text-4xl font-display font-semibold mt-1">Spot Trading</h1>
                <p className="text-zinc-400 mt-2 max-w-2xl">Trade live market pairs and Eregon custom coins inside the platform wallet. Orders are filled as internal market conversions using the latest quoted rate.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Badge color={marketPayload?.source === "coingecko" ? "emerald" : "gold"}>{marketPayload?.provider || "Market source"}</Badge>
                <Badge color="purple">Fee {(Number(portfolio?.fee_rate || 0.001) * 100).toFixed(2)}%</Badge>
                <button className="btn-ghost px-4 py-2 text-sm" onClick={() => load(true)}><RefreshCcw className="w-4 h-4" /> Refresh</button>
            </div>
        </div>

        <div className="grid xl:grid-cols-[280px_minmax(0,1fr)_360px] gap-5">
            <Card hover={false} className="xl:min-h-[720px]">
                <div className="flex items-center justify-between mb-4"><h2 className="font-display text-xl">Pairs</h2><Badge>{pairs.length}</Badge></div>
                <div className="relative mb-3"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /><input className="input-eregon pl-10 py-2" placeholder="Search pair..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                    {filteredPairs.map((p) => {
                        const active = p.pair === pairInfo.pair;
                        return <button key={p.pair} onClick={() => setSelectedPair(p.pair)} className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${active ? "bg-purple-500/15 border-purple-400/30" : "bg-black/30 border-white/5 hover:border-white/15"}`}>
                            <div className="flex items-center justify-between gap-2"><span className="font-semibold">{p.pair}</span><span className="text-xs text-zinc-500">{formatAmt(p.rate)}</span></div>
                            <p className="text-[11px] text-zinc-500 mt-1">{p.base} priced in {p.quote}</p>
                        </button>;
                    })}
                </div>
            </Card>

            <div className="space-y-5 min-w-0">
                <Card hover={false} className="min-h-[420px]">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3 min-w-0">
                            {pairInfo.baseMarket?.image ? <img src={pairInfo.baseMarket.image} alt="" className="w-11 h-11 rounded-full" /> : <span className="w-11 h-11 rounded-2xl gradient-purple flex items-center justify-center font-bold">{pairInfo.base.slice(0, 2)}</span>}
                            <div><h2 className="font-display text-2xl">{pairInfo.pair}</h2><p className="text-sm text-zinc-500">{pairInfo.baseMarket?.name || pairInfo.base} / {pairInfo.quote}</p></div>
                        </div>
                        <div className="text-right"><p className="text-3xl font-display gradient-text-gold">{formatAmt(pairInfo.rate)}</p><p className={up ? "text-emerald-300 text-sm" : "text-rose-300 text-sm"}>{up ? <ArrowUpRight className="w-4 h-4 inline" /> : <ArrowDownRight className="w-4 h-4 inline" />} {pct(pairInfo.baseMarket?.price_change_percentage_24h)}</p></div>
                    </div>
                    <div className="h-[320px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                <defs><linearGradient id="tradeChart" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fbbf24" stopOpacity={0.38} /><stop offset="95%" stopColor="#9333ea" stopOpacity={0} /></linearGradient></defs>
                                <XAxis dataKey="i" hide />
                                <YAxis domain={["dataMin", "dataMax"]} hide />
                                <Tooltip contentStyle={{ background: "rgba(15,15,19,.95)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 12 }} formatter={(v) => formatUsd(v)} />
                                <Area type="monotone" dataKey="price" stroke="#fbbf24" strokeWidth={2} fill="url(#tradeChart)" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <div className="grid lg:grid-cols-2 gap-5">
                    <Card hover={false}>
                        <div className="flex items-center gap-2 mb-4"><ArrowUpDown className="w-4 h-4 text-amber-300" /><h2 className="font-display text-xl">Order Book</h2></div>
                        <MiniOrderBook price={pairInfo.rate} />
                    </Card>
                    <Card hover={false}>
                        <div className="flex items-center gap-2 mb-4"><Wallet className="w-4 h-4 text-purple-300" /><h2 className="font-display text-xl">Portfolio</h2></div>
                        <p className="text-3xl font-display gradient-text-gold mb-4">{formatUsd(portfolio?.total_usd || 0)}</p>
                        <div className="space-y-2 max-h-[240px] overflow-y-auto">
                            {(portfolio?.positions || []).map((pos) => <div key={pos.symbol} className="flex items-center justify-between gap-3 rounded-xl bg-black/35 border border-white/5 px-3 py-2">
                                <div><p className="font-semibold">{pos.symbol}</p><p className="text-xs text-zinc-500">{formatAmt(pos.amount)}</p></div>
                                <div className="text-right"><p className="text-sm">{formatUsd(pos.usd_value)}</p><p className={Number(pos.change_24h) >= 0 ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>{pct(pos.change_24h)}</p></div>
                            </div>)}
                        </div>
                    </Card>
                </div>
            </div>

            <div className="space-y-5">
                <Card hover={false}>
                    <div className="flex items-center justify-between gap-3 mb-5"><h2 className="font-display text-xl">Place Order</h2><Badge color={side === "buy" ? "emerald" : "rose"}>{side.toUpperCase()}</Badge></div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button onClick={() => setSide("buy")} className={`rounded-xl py-3 font-semibold border ${side === "buy" ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Buy</button>
                        <button onClick={() => setSide("sell")} className={`rounded-xl py-3 font-semibold border ${side === "sell" ? "bg-rose-500/15 text-rose-200 border-rose-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Sell</button>
                    </div>
                    <label className="text-xs uppercase tracking-widest text-zinc-500">Pair</label>
                    <select className="input-eregon mt-2 mb-4" value={pairInfo.pair} onChange={(e) => setSelectedPair(e.target.value)}>{pairs.map((p) => <option key={p.pair}>{p.pair}</option>)}</select>
                    <label className="text-xs uppercase tracking-widest text-zinc-500">{side === "buy" ? `Spend amount (${pairInfo.quote})` : `Sell amount (${pairInfo.base})`}</label>
                    <input className="input-eregon mt-2" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="any" placeholder={side === "buy" ? `Available ${formatAmt(quoteBalance)} ${pairInfo.quote}` : `Available ${formatAmt(baseBalance)} ${pairInfo.base}`} />
                    <div className="rounded-2xl bg-black/35 border border-white/5 p-4 my-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-zinc-500">Market rate</span><span>{formatAmt(pairInfo.rate)} {pairInfo.quote}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">Estimated receive</span><span>{formatAmt(estimated)} {side === "buy" ? pairInfo.base : pairInfo.quote}</span></div>
                        <div className="flex justify-between"><span className="text-zinc-500">Fee</span><span>{(Number(portfolio?.fee_rate || 0.001) * 100).toFixed(2)}%</span></div>
                    </div>
                    <button disabled={submitting} onClick={submit} className={side === "buy" ? "btn-gold w-full" : "btn-eregon w-full"}>{submitting ? "Filling order..." : `${side === "buy" ? "Buy" : "Sell"} ${pairInfo.base}`}</button>
                    <p className="text-xs text-zinc-500 mt-3 flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0" /> Internal wallet conversion. This is not an external exchange withdrawal or real broker order.</p>
                </Card>

                <Card hover={false}>
                    <h2 className="font-display text-xl mb-4">Recent Trades</h2>
                    <div className="space-y-2 max-h-[360px] overflow-y-auto">
                        {orders.length === 0 && <p className="text-sm text-zinc-500">No trades yet.</p>}
                        {orders.map((order) => <div key={order.id} className="rounded-xl bg-black/35 border border-white/5 px-3 py-3">
                            <div className="flex justify-between gap-3"><span className="font-semibold">{order.pair}</span><Badge color={order.side === "buy" ? "emerald" : "rose"}>{order.side}</Badge></div>
                            <p className="text-xs text-zinc-500 mt-1">{new Date(order.created_at).toLocaleString()}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs mt-3"><span className="text-zinc-500">Filled</span><span className="text-right">{formatAmt(order.executed_base)} {order.base_symbol}</span><span className="text-zinc-500">Rate</span><span className="text-right">{formatAmt(order.rate)}</span></div>
                        </div>)}
                    </div>
                </Card>
            </div>
        </div>
    </DashboardLayout>;
}
