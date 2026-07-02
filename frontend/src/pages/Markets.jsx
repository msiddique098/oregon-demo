import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { ArrowDownRight, ArrowUpRight, RefreshCcw, Search, TrendingUp } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge, Card } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const currency = (value, max = 6) => Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number(value || 0) >= 1 ? 2 : max,
});
const compact = (value) => Number(value || 0).toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 2 });
const pct = (value) => `${Number(value || 0) >= 0 ? "+" : ""}${Number(value || 0).toFixed(2)}%`;

function Sparkline({ prices = [], up = true }) {
    const data = (prices || []).slice(-40).map((p, i) => ({ i, price: Number(p || 0) }));
    if (!data.length) return <div className="h-10 rounded-xl bg-white/[0.03]" />;
    return (
        <div className="h-12 min-w-[120px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={up ? "marketUp" : "marketDown"} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={up ? "#34d399" : "#fb7185"} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={up ? "#34d399" : "#fb7185"} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="price" stroke={up ? "#34d399" : "#fb7185"} fill={`url(#${up ? "marketUp" : "marketDown"})`} strokeWidth={2} dot={false} isAnimationActive={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export default function Markets() {
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const load = async (force = false) => {
        try {
            const { data } = await api.get("/markets", { params: { limit: 200, include_custom: true, force } });
            setPayload(data);
        } catch (e) {
            toast.error(formatApiError(e));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        const timer = window.setInterval(() => load(false), 3000);
        return () => window.clearInterval(timer);
    }, []);

    const coins = useMemo(() => payload?.coins || [], [payload]);
    const filtered = useMemo(() => {
        const s = search.toLowerCase().trim();
        return coins.filter((coin) => {
            const matchesSearch = !s || coin.name?.toLowerCase().includes(s) || coin.symbol?.toLowerCase().includes(s);
            return matchesSearch;
        });
    }, [coins, search]);

    const top = coins.filter((c) => !c.custom).slice(0, 4);

    if (loading) return <DashboardLayout><CinematicLoader /></DashboardLayout>;

    return (
        <DashboardLayout>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
                <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-amber-400/80">Live Crypto Markets</p>
                    <h1 className="text-3xl sm:text-4xl font-display font-semibold mt-1">Market Overview</h1>
                    <p className="text-zinc-400 mt-2 max-w-2xl">Top market assets with fast-moving quoted prices for the internal trading desk.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge color={payload?.source === "coingecko" ? "emerald" : "gold"}>{payload?.provider || "Market source"}</Badge>
                    <Badge color="zinc">live quotes</Badge>
                    <button onClick={() => load(true)} className="btn-ghost px-4 py-2 text-sm"><RefreshCcw className="w-4 h-4" /> Refresh</button>
                </div>
            </div>

            {payload?.source_error && <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-200">Live provider could not be reached, so fallback prices are being shown: {payload.source_error}</div>}

            <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {top.map((coin) => {
                    const up = Number(coin.price_change_percentage_24h || 0) >= 0;
                    return <Card key={coin.id} className="min-h-[160px]">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                {coin.image ? <img src={coin.image} alt="" className="w-9 h-9 rounded-full" /> : <span className="w-9 h-9 rounded-full gradient-purple flex items-center justify-center text-xs font-bold">{coin.symbol?.slice(0, 2).toUpperCase()}</span>}
                                <div className="min-w-0"><p className="font-display text-lg truncate">{coin.name}</p><p className="text-xs uppercase text-zinc-500">{coin.symbol}</p></div>
                            </div>
                            <Badge color={up ? "emerald" : "rose"}>{pct(coin.price_change_percentage_24h)}</Badge>
                        </div>
                        <p className="text-2xl font-display gradient-text-gold mt-5">{currency(coin.current_price)}</p>
                        <Sparkline prices={coin.sparkline_in_7d?.price} up={up} />
                    </Card>;
                })}
            </div>

            <Card hover={false} className="mb-5">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <span className="w-11 h-11 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-amber-300" /></span>
                        <div><h2 className="font-display text-xl">Spot Market</h2><p className="text-sm text-zinc-500">{filtered.length} assets visible with live quote movement.</p></div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 lg:w-[340px]">
                            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input className="input-eregon pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search BTC, ETH, Eregon..." />
                        </div>
                    </div>
                </div>
            </Card>

            <div className="glass-strong overflow-hidden">
                <div className="responsive-table-wrap">
                    <table className="w-full text-sm">
                        <thead className="bg-white/[0.03] text-zinc-500 uppercase tracking-wider text-xs">
                            <tr>
                                <th className="text-left px-4 py-4">#</th>
                                <th className="text-left px-4 py-4">Asset</th>
                                <th className="text-right px-4 py-4">Price</th>
                                <th className="text-right px-4 py-4">24h</th>
                                <th className="text-right px-4 py-4">Volume</th>
                                <th className="text-right px-4 py-4">Market cap</th>
                                <th className="text-right px-4 py-4">7d</th>
                                <th className="text-right px-4 py-4">Trade</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filtered.map((coin, idx) => {
                                const up = Number(coin.price_change_percentage_24h || 0) >= 0;
                                const pair = `${coin.symbol?.toUpperCase()}/USDT`;
                                return <tr key={`${coin.id}-${coin.symbol}`} className="hover:bg-white/[0.03] transition-colors">
                                    <td className="px-4 py-4 text-zinc-500">{coin.market_cap_rank || idx + 1}</td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            {coin.image ? <img src={coin.image} alt="" className="w-8 h-8 rounded-full" /> : <span className="w-8 h-8 rounded-full gradient-purple flex items-center justify-center text-[10px] font-bold">{coin.symbol?.slice(0, 2).toUpperCase()}</span>}
                                            <div><p className="font-semibold text-white">{coin.name}</p><p className="text-xs uppercase text-zinc-500">{coin.symbol}</p></div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right font-semibold">{currency(coin.current_price)}</td>
                                    <td className={`px-4 py-4 text-right font-semibold ${up ? "text-emerald-300" : "text-rose-300"}`}>{up ? <ArrowUpRight className="w-4 h-4 inline" /> : <ArrowDownRight className="w-4 h-4 inline" />} {pct(coin.price_change_percentage_24h)}</td>
                                    <td className="px-4 py-4 text-right text-zinc-300">${compact(coin.total_volume)}</td>
                                    <td className="px-4 py-4 text-right text-zinc-300">${compact(coin.market_cap)}</td>
                                    <td className="px-4 py-4 text-right"><Sparkline prices={coin.sparkline_in_7d?.price} up={up} /></td>
                                    <td className="px-4 py-4 text-right"><Link to={`/dashboard/trading?pair=${encodeURIComponent(pair)}`} className="btn-gold py-2 px-4 text-xs">Trade</Link></td>
                                </tr>;
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
}
