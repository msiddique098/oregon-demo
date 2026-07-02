import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowDownRight, ArrowUpDown, ArrowUpRight, Clock, RefreshCcw, Search, ShieldCheck, Target, Wallet } from "lucide-react";
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

function buildCandles(prices = []) {
    const values = prices.map((p) => Number(p || 0)).filter((p) => p > 0);
    if (values.length < 2) return [];
    const target = 34;
    const step = Math.max(1, Math.floor(values.length / target));
    const candles = [];
    for (let i = 1; i < values.length; i += step) {
        const slice = values.slice(i, i + step);
        const open = values[i - 1];
        const close = slice[slice.length - 1] || open;
        const spread = Math.max(open, close) * 0.0018;
        const high = Math.max(open, close, ...slice) + spread;
        const low = Math.max(0.00000001, Math.min(open, close, ...slice) - spread);
        candles.push({ open, high, low, close });
    }
    return candles.slice(-target);
}

function CandleChart({ candles = [] }) {
    if (!candles.length) return <div className="h-full rounded-2xl bg-white/[0.03]" />;
    const width = 760;
    const height = 320;
    const pad = { left: 58, right: 18, top: 18, bottom: 30 };
    const hi = Math.max(...candles.map((c) => c.high));
    const lo = Math.min(...candles.map((c) => c.low));
    const span = Math.max(0.00000001, hi - lo);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const y = (value) => pad.top + ((hi - value) / span) * plotH;
    const candleW = Math.max(5, plotW / candles.length * 0.58);
    const ticks = Array.from({ length: 5 }).map((_, i) => lo + (span * i) / 4);
    return (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full rounded-2xl bg-black/30 border border-white/5">
            <defs>
                <linearGradient id="candleBg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.10" />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity="0.02" />
                </linearGradient>
            </defs>
            <rect x="0" y="0" width={width} height={height} fill="url(#candleBg)" />
            {ticks.map((tick, i) => {
                const ty = y(tick);
                return <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={ty} y2={ty} stroke="rgba(255,255,255,.07)" /><text x={pad.left - 10} y={ty + 4} textAnchor="end" fill="rgba(255,255,255,.42)" fontSize="11">{formatAmt(tick)}</text></g>;
            })}
            {candles.map((c, i) => {
                const x = pad.left + (i + 0.5) * (plotW / candles.length);
                const up = c.close >= c.open;
                const color = up ? "#34d399" : "#fb7185";
                const bodyTop = y(Math.max(c.open, c.close));
                const bodyBottom = y(Math.min(c.open, c.close));
                const bodyH = Math.max(2, bodyBottom - bodyTop);
                return <g key={`${i}-${c.close}`}>
                    <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1.5" />
                    <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} rx="2" fill={up ? "rgba(52,211,153,.86)" : "rgba(251,113,133,.86)"} />
                </g>;
            })}
            <text x={pad.left} y={height - 10} fill="rgba(255,255,255,.38)" fontSize="11">Live candle view</text>
            <text x={width - pad.right} y={height - 10} textAnchor="end" fill="rgba(251,191,36,.75)" fontSize="11">Auto-refreshing quotes</text>
        </svg>
    );
}

export default function Trading() {
    const queryPair = useQueryPair();
    const [marketPayload, setMarketPayload] = useState(null);
    const [pairs, setPairs] = useState([]);
    const [portfolio, setPortfolio] = useState(null);
    const [orders, setOrders] = useState([]);
    const [options, setOptions] = useState([]);
    const [optionMeta, setOptionMeta] = useState({ payout_rate: 0.8, durations: [30, 60, 120, 300] });
    const [selectedPair, setSelectedPair] = useState(queryPair);
    const [side, setSide] = useState("buy");
    const [amount, setAmount] = useState("");
    const [tradeMode, setTradeMode] = useState("spot");
    const [optionDirection, setOptionDirection] = useState("up");
    const [optionStake, setOptionStake] = useState("");
    const [optionDuration, setOptionDuration] = useState(60);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const load = async (force = false) => {
        try {
            const [m, p, port, o, opt] = await Promise.all([
                api.get("/markets", { params: { limit: 200, include_custom: true, force } }),
                api.get("/trading/pairs"),
                api.get("/trading/portfolio"),
                api.get("/trading/orders", { params: { limit: 25 } }),
                api.get("/trading/options", { params: { limit: 25 } }),
            ]);
            setMarketPayload(m.data);
            setPairs(p.data.pairs || []);
            setPortfolio(port.data);
            setOrders(o.data || []);
            setOptions(opt.data.items || []);
            setOptionMeta({ payout_rate: opt.data.payout_rate ?? 0.8, durations: opt.data.durations || [30, 60, 120, 300] });
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
        const timer = window.setInterval(() => load(false), 3000);
        return () => window.clearInterval(timer);
    }, []);

    const markets = useMemo(() => marketPayload?.coins || [], [marketPayload]);
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
    const orderPairs = useMemo(() => tradeMode === "options" ? pairs.filter((p) => p.quote === "USDT") : pairs, [pairs, tradeMode]);

    useEffect(() => {
        if (tradeMode === "options" && pairInfo.quote !== "USDT") {
            const firstUsdt = pairs.find((p) => p.quote === "USDT");
            if (firstUsdt) setSelectedPair(firstUsdt.pair);
        }
    }, [tradeMode, pairInfo.quote, pairs]);

    const candles = useMemo(() => {
        const prices = pairInfo.baseMarket?.sparkline_in_7d?.price || [];
        return buildCandles([...prices.slice(-120), pairInfo.rate]);
    }, [pairInfo.baseMarket, pairInfo.rate]);

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

    const submitOption = async () => {
        if (!optionStake || Number(optionStake) <= 0) return toast.error("Enter a valid contract stake");
        setSubmitting(true);
        try {
            const { data } = await api.post("/trading/options", { pair: pairInfo.pair, direction: optionDirection, stake: Number(optionStake), duration_seconds: Number(optionDuration) });
            toast.success(`${optionDirection.toUpperCase()} contract opened at ${formatAmt(data.option.entry_rate)}`);
            setOptionStake("");
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
                <p className="text-zinc-400 mt-2 max-w-2xl">Trade live market pairs inside the platform wallet or open short Up/Down contracts with clear win/loss settlement.</p>
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
                        <CandleChart candles={candles} />
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
                    <div className="flex items-center justify-between gap-3 mb-5"><h2 className="font-display text-xl">Place Order</h2><Badge color={tradeMode === "spot" ? (side === "buy" ? "emerald" : "rose") : "purple"}>{tradeMode === "spot" ? side.toUpperCase() : "OPTIONS"}</Badge></div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button onClick={() => setTradeMode("spot")} className={`rounded-xl py-3 font-semibold border ${tradeMode === "spot" ? "bg-amber-500/15 text-amber-200 border-amber-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Spot</button>
                        <button onClick={() => setTradeMode("options")} className={`rounded-xl py-3 font-semibold border ${tradeMode === "options" ? "bg-purple-500/15 text-purple-200 border-purple-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Options</button>
                    </div>
                    <label className="text-xs uppercase tracking-widest text-zinc-500">Pair</label>
                    <select className="input-eregon mt-2 mb-4" value={pairInfo.pair} onChange={(e) => setSelectedPair(e.target.value)}>{orderPairs.map((p) => <option key={p.pair}>{p.pair}</option>)}</select>
                    {tradeMode === "spot" ? (
                        <>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <button onClick={() => setSide("buy")} className={`rounded-xl py-3 font-semibold border ${side === "buy" ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Buy</button>
                                <button onClick={() => setSide("sell")} className={`rounded-xl py-3 font-semibold border ${side === "sell" ? "bg-rose-500/15 text-rose-200 border-rose-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Sell</button>
                            </div>
                            <label className="text-xs uppercase tracking-widest text-zinc-500">{side === "buy" ? `Spend amount (${pairInfo.quote})` : `Sell amount (${pairInfo.base})`}</label>
                            <input className="input-eregon mt-2" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="any" placeholder={side === "buy" ? `Available ${formatAmt(quoteBalance)} ${pairInfo.quote}` : `Available ${formatAmt(baseBalance)} ${pairInfo.base}`} />
                            <div className="rounded-2xl bg-black/35 border border-white/5 p-4 my-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-zinc-500">Market rate</span><span>{formatAmt(pairInfo.rate)} {pairInfo.quote}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-500">Estimated receive</span><span>{formatAmt(estimated)} {side === "buy" ? pairInfo.base : pairInfo.quote}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-500">Fee</span><span>{(Number(portfolio?.fee_rate || 0.001) * 100).toFixed(2)}%</span></div>
                            </div>
                            <button disabled={submitting} onClick={submit} className={side === "buy" ? "btn-gold w-full" : "btn-eregon w-full"}>{submitting ? "Filling order..." : `${side === "buy" ? "Buy" : "Sell"} ${pairInfo.base}`}</button>
                            <p className="text-xs text-zinc-500 mt-3 flex gap-2"><ShieldCheck className="w-4 h-4 shrink-0" /> Internal wallet conversion. This is not an external exchange withdrawal or real broker order.</p>
                        </>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <button onClick={() => setOptionDirection("up")} className={`rounded-xl py-3 font-semibold border ${optionDirection === "up" ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}><ArrowUpRight className="w-4 h-4 inline" /> Up</button>
                                <button onClick={() => setOptionDirection("down")} className={`rounded-xl py-3 font-semibold border ${optionDirection === "down" ? "bg-rose-500/15 text-rose-200 border-rose-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}><ArrowDownRight className="w-4 h-4 inline" /> Down</button>
                            </div>
                            <label className="text-xs uppercase tracking-widest text-zinc-500">Stake (USDT)</label>
                            <input className="input-eregon mt-2 mb-4" value={optionStake} onChange={(e) => setOptionStake(e.target.value)} type="number" min="0" step="any" placeholder={`Available ${formatAmt(quoteBalance)} USDT`} />
                            <label className="text-xs uppercase tracking-widest text-zinc-500">Duration</label>
                            <select className="input-eregon mt-2" value={optionDuration} onChange={(e) => setOptionDuration(Number(e.target.value))}>{optionMeta.durations.map((d) => <option key={d} value={d}>{d < 60 ? `${d}s` : `${d / 60}m`}</option>)}</select>
                            <div className="rounded-2xl bg-black/35 border border-white/5 p-4 my-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-zinc-500">Entry rate</span><span>{formatAmt(pairInfo.rate)} {pairInfo.quote}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-500">Win payout</span><span>{formatUsd(Number(optionStake || 0) * (1 + Number(optionMeta.payout_rate || 0.8)))}</span></div>
                                <div className="flex justify-between"><span className="text-zinc-500">Profit on win</span><span>{formatUsd(Number(optionStake || 0) * Number(optionMeta.payout_rate || 0.8))}</span></div>
                            </div>
                            <button disabled={submitting} onClick={submitOption} className={optionDirection === "up" ? "btn-gold w-full" : "btn-eregon w-full"}>{submitting ? "Opening contract..." : `Open ${optionDirection.toUpperCase()} Contract`}</button>
                            <p className="text-xs text-zinc-500 mt-3 flex gap-2"><Target className="w-4 h-4 shrink-0" /> Win if the expiry rate is {optionDirection === "up" ? "above" : "below"} your entry rate. Loss forfeits the stake.</p>
                        </>
                    )}
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
                <Card hover={false}>
                    <h2 className="font-display text-xl mb-4">Options Contracts</h2>
                    <div className="space-y-2 max-h-[360px] overflow-y-auto">
                        {options.length === 0 && <p className="text-sm text-zinc-500">No options contracts yet.</p>}
                        {options.map((option) => <div key={option.id} className="rounded-xl bg-black/35 border border-white/5 px-3 py-3">
                            <div className="flex justify-between gap-3"><span className="font-semibold">{option.pair}</span><Badge color={option.status === "won" ? "emerald" : option.status === "lost" ? "rose" : "purple"}>{option.status}</Badge></div>
                            <p className="text-xs text-zinc-500 mt-1"><Clock className="w-3 h-3 inline mr-1" /> {option.status === "open" ? `Expires ${new Date(option.expires_at).toLocaleTimeString()}` : `Settled ${new Date(option.settled_at || option.expires_at).toLocaleString()}`}</p>
                            <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                                <span className="text-zinc-500">Direction</span><span className="text-right uppercase">{option.direction}</span>
                                <span className="text-zinc-500">Stake</span><span className="text-right">{formatUsd(option.stake)}</span>
                                <span className="text-zinc-500">Entry</span><span className="text-right">{formatAmt(option.entry_rate)}</span>
                                {option.exit_rate && <><span className="text-zinc-500">Exit</span><span className="text-right">{formatAmt(option.exit_rate)}</span></>}
                                {option.profit !== undefined && <><span className="text-zinc-500">P/L</span><span className={Number(option.profit) >= 0 ? "text-right text-emerald-300" : "text-right text-rose-300"}>{formatUsd(option.profit)}</span></>}
                            </div>
                        </div>)}
                    </div>
                </Card>
            </div>
        </div>
    </DashboardLayout>;
}
