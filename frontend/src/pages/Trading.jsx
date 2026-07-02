import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowDownRight, ArrowUpDown, ArrowUpRight, BarChart3, Clock, LineChart, Maximize2, Minimize2, RefreshCcw, Search, ShieldCheck, Target, Wallet } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge, Card } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const formatUsd = (value, max = 6) => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: Number(value || 0) >= 1 ? 2 : max });
const formatAmt = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 10 });
const formatChartPrice = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: Number(value || 0) >= 1 ? 2 : 6 });
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

const TIMEFRAME_CONFIG = {
    "1m": { label: "1m", window: 64, bucket: 1 },
    "5m": { label: "5m", window: 110, bucket: 2 },
    "15m": { label: "15m", window: 170, bucket: 3 },
    "1h": { label: "1h", window: 260, bucket: 6 },
    "4h": { label: "4h", window: 420, bucket: 8 },
    "1d": { label: "1d", window: 9999, bucket: 10 },
    "1w": { label: "1w", window: 9999, bucket: 12 },
};

function buildCandles(prices = [], timeframe = "1m") {
    const allValues = prices.map((p) => Number(p || 0)).filter((p) => p > 0);
    if (allValues.length < 2) return [];
    const config = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG["1m"];
    const values = allValues.slice(-Math.min(allValues.length, config.window));
    const target = timeframe === "1m" ? 46 : 42;
    const step = Math.max(config.bucket, Math.floor(values.length / target));
    const candles = [];
    for (let i = 0; i < values.length; i += step) {
        const slice = values.slice(i, i + step);
        if (!slice.length) continue;
        const open = i === 0 ? slice[0] : values[i - 1];
        const close = slice[slice.length - 1] || open;
        const spread = Math.max(open, close) * 0.0018;
        const high = Math.max(open, close, ...slice) + spread;
        const low = Math.max(0.00000001, Math.min(open, close, ...slice) - spread);
        const volume = Math.max(1, slice.reduce((sum, value) => sum + Math.abs(value - open), 0) + Math.abs(close - open)) * (i + 3);
        candles.push({ open, high, low, close, volume });
    }
    return candles.slice(-target);
}

function CandleChart({ candles = [], pair = "BTC/USDT", timeframe = "1m", onTimeframe, chartType = "candles", onChartType, fullscreen = false, onToggleFullscreen }) {
    const [hover, setHover] = useState(null);
    if (!candles.length) return <div className="h-full rounded-2xl bg-white/[0.03]" />;
    const width = fullscreen ? 900 : 760;
    const height = fullscreen ? 720 : 320;
    const pad = { left: 54, right: 68, top: 42, bottom: 46 };
    const hi = Math.max(...candles.map((c) => c.high));
    const lo = Math.min(...candles.map((c) => c.low));
    const maxVol = Math.max(...candles.map((c) => c.volume || 1));
    const span = Math.max(0.00000001, hi - lo);
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const y = (value) => pad.top + ((hi - value) / span) * plotH;
    const volY = height - pad.bottom;
    const volH = 46;
    const candleW = Math.max(5, plotW / candles.length * 0.58);
    const ticks = Array.from({ length: 5 }).map((_, i) => lo + (span * i) / 4);
    const last = candles[candles.length - 1];
    const hoverCandle = hover ? candles[hover.index] : last;
    const xFor = (i) => pad.left + (i + 0.5) * (plotW / candles.length);
    const maPath = (period) => candles.map((_, i) => {
        if (i < period - 1) return null;
        const slice = candles.slice(i - period + 1, i + 1);
        const avg = slice.reduce((sum, c) => sum + c.close, 0) / period;
        return `${i === period - 1 ? "M" : "L"} ${xFor(i).toFixed(2)} ${y(avg).toFixed(2)}`;
    }).filter(Boolean).join(" ");
    const closePath = candles.map((c, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(2)} ${y(c.close).toFixed(2)}`).join(" ");
    const areaPath = `${closePath} L ${xFor(candles.length - 1).toFixed(2)} ${volY} L ${xFor(0).toFixed(2)} ${volY} Z`;
    const handleMove = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const relX = ((event.clientX - rect.left) / rect.width) * width;
        const relY = ((event.clientY - rect.top) / rect.height) * height;
        if (relX < pad.left || relX > width - pad.right || relY < pad.top || relY > height - pad.bottom) {
            setHover(null);
            return;
        }
        const index = Math.max(0, Math.min(candles.length - 1, Math.floor(((relX - pad.left) / plotW) * candles.length)));
        const price = hi - ((relY - pad.top) / plotH) * span;
        setHover({ index, x: xFor(index), y: relY, price });
    };
    return (
        <div className={`${fullscreen ? "fixed inset-0 sm:inset-6 z-[90] h-screen sm:h-auto rounded-none sm:rounded-2xl shadow-2xl shadow-black/70 bg-[#202832]" : "h-full rounded-2xl bg-black/90"} flex flex-col border border-white/10 overflow-hidden`}>
            {fullscreen && <div className="absolute inset-0 -z-10 bg-black/80 backdrop-blur-xl" />}
            <div className="shrink-0 border-b border-white/10 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-lg sm:text-sm font-semibold text-zinc-100">{pair} <span className="text-zinc-500">Chart</span></p>
                        <p className="hidden sm:block text-xs uppercase tracking-[0.22em] text-zinc-500">Advanced chart</p>
                    </div>
                    <button type="button" title={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={onToggleFullscreen} className="p-2 rounded-lg border border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white">
                        {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 overflow-x-auto">
                    <div className="flex shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-1">
                        {Object.keys(TIMEFRAME_CONFIG).map((tf) => (
                            <button key={tf} type="button" onClick={() => onTimeframe?.(tf)} className={`px-3 py-1.5 text-sm sm:text-xs rounded-md ${timeframe === tf ? "bg-amber-400 text-black font-bold" : "text-zinc-400 hover:text-white"}`}>{tf}</button>
                        ))}
                    </div>
                    <div className="flex shrink-0 rounded-lg border border-white/10 bg-white/[0.03] p-1">
                        <button type="button" title="Candles" onClick={() => onChartType?.("candles")} className={`p-1.5 rounded-md ${chartType === "candles" ? "bg-purple-500/25 text-purple-100" : "text-zinc-400 hover:text-white"}`}><BarChart3 className="w-4 h-4" /></button>
                        <button type="button" title="Line" onClick={() => onChartType?.("line")} className={`p-1.5 rounded-md ${chartType === "line" ? "bg-purple-500/25 text-purple-100" : "text-zinc-400 hover:text-white"}`}><LineChart className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" onMouseMove={handleMove} onMouseLeave={() => setHover(null)} className="w-full flex-1 min-h-0">
                <defs>
                    <linearGradient id="candleBg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.10" />
                        <stop offset="100%" stopColor="#9333ea" stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                <rect x="0" y="0" width={width} height={height} fill="url(#candleBg)" />
                <text x={pad.left} y="24" fill="rgba(52,211,153,.86)" fontSize={fullscreen ? "14" : "12"}>
                    O {formatChartPrice(hoverCandle.open)}  H {formatChartPrice(hoverCandle.high)}  L {formatChartPrice(hoverCandle.low)}  C {formatChartPrice(hoverCandle.close)}
                </text>
                <text x={width - pad.right} y="24" textAnchor="end" fill="rgba(251,191,36,.78)" fontSize="12">MA 7 / MA 25</text>
                {ticks.map((tick) => {
                    const ty = y(tick);
                    return <g key={tick}><line x1={pad.left} x2={width - pad.right} y1={ty} y2={ty} stroke="rgba(255,255,255,.07)" /><text x={width - pad.right + 8} y={ty + 4} fill="rgba(255,255,255,.42)" fontSize="11">{formatAmt(tick)}</text></g>;
                })}
                {candles.map((c, i) => {
                    const x = xFor(i);
                    const up = c.close >= c.open;
                    const vHeight = Math.max(3, ((c.volume || 1) / maxVol) * volH);
                    return <g key={`${i}-${c.close}`}>
                        <rect x={x - candleW / 2} y={volY - vHeight} width={candleW} height={vHeight} rx="2" fill={up ? "rgba(52,211,153,.16)" : "rgba(251,113,133,.16)"} />
                    </g>;
                })}
                {chartType === "line" && <>
                    <path d={areaPath} fill="rgba(251,191,36,.10)" />
                    <path d={closePath} fill="none" stroke="#fbbf24" strokeWidth="2.4" />
                </>}
                {chartType === "candles" && candles.map((c, i) => {
                    const x = xFor(i);
                    const up = c.close >= c.open;
                    const color = up ? "#34d399" : "#fb7185";
                    const bodyTop = y(Math.max(c.open, c.close));
                    const bodyBottom = y(Math.min(c.open, c.close));
                    const bodyH = Math.max(2, bodyBottom - bodyTop);
                    return <g key={`candle-${i}-${c.close}`}>
                        <line x1={x} x2={x} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1.5" />
                        <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} rx="2" fill={up ? "rgba(52,211,153,.88)" : "rgba(251,113,133,.88)"} />
                    </g>;
                })}
                <path d={maPath(7)} fill="none" stroke="#fbbf24" strokeWidth="1.5" opacity=".9" />
                <path d={maPath(25)} fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity=".82" />
                <line x1={pad.left} x2={width - pad.right} y1={y(last.close)} y2={y(last.close)} stroke="#fbbf24" strokeDasharray="5 5" opacity=".55" />
                <rect x={width - pad.right + 5} y={y(last.close) - 10} width="54" height="20" rx="5" fill="#fbbf24" />
                <text x={width - pad.right + 32} y={y(last.close) + 4} textAnchor="middle" fill="#080808" fontSize="10" fontWeight="700">{formatAmt(last.close)}</text>
                {hover && <>
                    <line x1={hover.x} x2={hover.x} y1={pad.top} y2={height - pad.bottom} stroke="rgba(255,255,255,.28)" strokeDasharray="4 4" />
                    <line x1={pad.left} x2={width - pad.right} y1={hover.y} y2={hover.y} stroke="rgba(255,255,255,.24)" strokeDasharray="4 4" />
                    <rect x={width - pad.right + 5} y={hover.y - 10} width="54" height="20" rx="5" fill="rgba(255,255,255,.12)" />
                    <text x={width - pad.right + 32} y={hover.y + 4} textAnchor="middle" fill="white" fontSize="10">{formatAmt(hover.price)}</text>
                </>}
                <text x={pad.left} y={height - 12} fill="rgba(255,255,255,.38)" fontSize="11">{TIMEFRAME_CONFIG[timeframe]?.label || timeframe} view</text>
                <text x={width - pad.right} y={height - 12} textAnchor="end" fill="rgba(251,191,36,.75)" fontSize="11">Live quotes</text>
            </svg>
        </div>
    );
}

function MobileExchangeChart({ candles = [], pairInfo, timeframe, onTimeframe, onOpenUp, onOpenDown }) {
    const [zoom, setZoom] = useState(1);
    if (!candles.length) return null;
    const pair = pairInfo.pair;
    const last = candles[candles.length - 1];
    const change = Number(pairInfo.baseMarket?.price_change_percentage_24h || 0);
    const up = change >= 0;
    const visibleCount = Math.min(candles.length, Math.max(12, Math.round(52 / zoom)));
    const visible = candles.slice(-visibleCount);
    const width = 390;
    const priceH = 355;
    const rsiH = 105;
    const pad = { left: 0, right: 58, top: 22, bottom: 18 };
    const hi = Math.max(...visible.map((c) => c.high));
    const lo = Math.min(...visible.map((c) => c.low));
    const span = Math.max(0.00000001, hi - lo);
    const plotW = width - pad.left - pad.right;
    const x = (i) => pad.left + (i + 0.5) * (plotW / visible.length);
    const y = (value) => pad.top + ((hi - value) / span) * (priceH - pad.top - pad.bottom);
    const candleW = Math.max(3, (plotW / visible.length) * 0.55);
    const ticks = Array.from({ length: 5 }).map((_, i) => lo + ((hi - lo) * i) / 4).reverse();
    const maxVol = Math.max(...visible.map((c) => c.volume || 1));
    const maPath = (period) => visible.map((_, i) => {
        if (i < period - 1) return null;
        const slice = visible.slice(i - period + 1, i + 1);
        const avg = slice.reduce((sum, c) => sum + c.close, 0) / period;
        return `${i === period - 1 ? "M" : "L"} ${x(i).toFixed(2)} ${y(avg).toFixed(2)}`;
    }).filter(Boolean).join(" ");
    const rsiPoints = visible.map((c, i) => {
        const prev = visible[Math.max(0, i - 1)]?.close || c.open;
        const delta = c.close - prev;
        const rsi = Math.max(8, Math.min(92, 50 + (delta / Math.max(c.close * 0.002, 0.000001)) * 18));
        const ry = priceH + 10 + ((90 - rsi) / 80) * (rsiH - 22);
        return `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${ry.toFixed(2)}`;
    }).join(" ");
    const zoomBy = (delta) => setZoom((value) => Math.max(0.75, Math.min(2.4, Number((value + delta).toFixed(2)))));
    const wheelZoom = (event) => {
        event.preventDefault();
        zoomBy(event.deltaY > 0 ? -0.15 : 0.15);
    };

    return (
        <section className="bg-[#202832] -mx-3 sm:mx-0 text-zinc-100">
            <div className="px-4 pt-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-3xl leading-none">←</span>
                        <h2 className="text-2xl font-bold truncate">{pair}</h2>
                        <span className="text-zinc-400">▼</span>
                    </div>
                    <div className="flex items-center gap-4 text-2xl text-zinc-200">
                        <span className="text-purple-300 font-bold">Ai</span>
                        <span>☆</span>
                        <span>♢</span>
                    </div>
                </div>
                <div className="flex gap-7 mt-5 border-b border-white/10 text-lg font-semibold text-zinc-400 overflow-x-auto">
                    {["Price", "Info", "Trading Data", "Square", "Trade-X"].map((tab) => (
                        <button key={tab} className={`pb-3 shrink-0 ${tab === "Price" ? "text-white border-b-4 border-amber-400" : ""}`}>{tab}</button>
                    ))}
                </div>
                <div className="grid grid-cols-[1.15fr_1fr] gap-4 py-5">
                    <div>
                        <p className={`text-5xl font-display font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>{formatChartPrice(last.close)}</p>
                        <p className="text-xl mt-2">Rs{(last.close * 280).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className={up ? "text-emerald-400" : "text-rose-400"}>{pct(change)}</span></p>
                        <p className="text-amber-300 mt-2 font-semibold">Payments · Vol · Price Protection ›</p>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        <span className="text-zinc-400">24h High</span><span>{formatChartPrice(hi)}</span>
                        <span className="text-zinc-400">24h Vol({pairInfo.base})</span><span>{formatAmt(maxVol)}</span>
                        <span className="text-zinc-400">24h Low</span><span>{formatChartPrice(lo)}</span>
                        <span className="text-zinc-400">24h Vol(USDT)</span><span>{formatUsd(maxVol * last.close, 2).replace("$", "")}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div className="flex gap-5 text-lg text-zinc-400 overflow-x-auto">
                        {["Time", "15m", "1h", "4h", "1D", "1w"].map((tf) => (
                            <button key={tf} onClick={() => onTimeframe?.(tf === "Time" ? "1m" : tf === "1D" ? "1d" : tf)} className={`${(tf === "Time" && timeframe === "1m") || (tf === "1D" && timeframe === "1d") || tf === timeframe ? "text-white font-bold" : ""}`}>{tf}</button>
                        ))}
                    </div>
                    <div className="flex gap-2 text-xl">
                        <button onClick={() => zoomBy(0.2)} className="w-8 h-8 rounded border border-white/15">+</button>
                        <button onClick={() => zoomBy(-0.2)} className="w-8 h-8 rounded border border-white/15">−</button>
                    </div>
                </div>
            </div>
            <div className="relative" onWheel={wheelZoom} style={{ touchAction: "none" }}>
                <svg viewBox={`0 0 ${width} ${priceH + rsiH}`} className="w-full h-[560px] block bg-[#202832]">
                    <defs>
                        <pattern id="chartGrid" width="130" height="72" patternUnits="userSpaceOnUse">
                            <path d="M 130 0 L 0 0 0 72" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width={width} height={priceH + rsiH} fill="url(#chartGrid)" />
                    <text x="132" y="178" fill="rgba(255,255,255,.08)" fontSize="24" fontWeight="700">BINANCE</text>
                    {ticks.map((tick) => <text key={tick} x={width - 5} y={y(tick) + 4} textAnchor="end" fill="rgba(229,231,235,.62)" fontSize="12">{formatChartPrice(tick)}</text>)}
                    {visible.map((c, i) => {
                        const cx = x(i);
                        const isUp = c.close >= c.open;
                        const color = isUp ? "#34d399" : "#f43f5e";
                        const top = y(Math.max(c.open, c.close));
                        const bottom = y(Math.min(c.open, c.close));
                        const bodyH = Math.max(2, bottom - top);
                        const volH = Math.max(2, ((c.volume || 1) / maxVol) * 34);
                        return <g key={`${i}-${c.close}`}>
                            <line x1={cx} x2={cx} y1={y(c.high)} y2={y(c.low)} stroke={color} strokeWidth="1.2" />
                            <rect x={cx - candleW / 2} y={top} width={candleW} height={bodyH} fill={color} />
                            <rect x={cx - candleW / 2} y={priceH - 38 - volH} width={candleW} height={volH} fill={isUp ? "rgba(52,211,153,.28)" : "rgba(244,63,94,.28)"} />
                        </g>;
                    })}
                    <path d={maPath(7)} fill="none" stroke="#facc15" strokeWidth="1.2" />
                    <path d={maPath(25)} fill="none" stroke="#8b5cf6" strokeWidth="1.2" />
                    <line x1={0} x2={width - 64} y1={y(last.close)} y2={y(last.close)} stroke="rgba(255,255,255,.7)" strokeDasharray="4 4" />
                    <rect x={width - 68} y={y(last.close) - 13} width="68" height="26" rx="6" fill="#202832" stroke="rgba(255,255,255,.85)" />
                    <text x={width - 34} y={y(last.close) + 5} textAnchor="middle" fill="white" fontSize="13">{formatChartPrice(last.close)}</text>
                    <text x="18" y={priceH + 22} fill="#facc15" fontSize="14">RSI(6): {(32.47 + zoom).toFixed(2)}</text>
                    <line x1="0" x2={width} y1={priceH + 42} y2={priceH + 42} stroke="rgba(255,255,255,.6)" strokeDasharray="5 5" />
                    <line x1="0" x2={width} y1={priceH + 78} y2={priceH + 78} stroke="rgba(255,255,255,.6)" strokeDasharray="5 5" />
                    <path d={rsiPoints} fill="none" stroke="#facc15" strokeWidth="1.6" />
                    <text x={width - 6} y={priceH + 40} textAnchor="end" fill="rgba(229,231,235,.7)" fontSize="12">70.0</text>
                    <text x={width - 6} y={priceH + 76} textAnchor="end" fill="rgba(229,231,235,.7)" fontSize="12">40.0</text>
                </svg>
            </div>
            <div className="px-4 py-3 border-t border-white/10 flex justify-between text-zinc-400 text-base">
                {["MA", "EMA", "BOLL", "SAR", "AVL", "SUPER", "VOL"].map((item) => <button key={item}>{item}</button>)}
            </div>
            <div className="px-4 pb-4 flex justify-between text-zinc-400">
                {["Today", "7 Days", "30 Days", "90 Days", "180 Days", "1 Year"].map((item) => <button key={item}>{item}</button>)}
            </div>
            <div className="px-4 pb-5 grid grid-cols-[1fr_1fr_1fr_2fr_2fr] gap-3 items-center">
                <button className="text-sm text-zinc-200">More</button>
                <button className="text-sm text-zinc-200">Hub</button>
                <button className="text-sm text-zinc-200">Margin</button>
                <button onClick={onOpenUp} className="min-h-14 rounded-xl bg-emerald-500 text-white text-xl font-semibold">Buy</button>
                <button onClick={onOpenDown} className="min-h-14 rounded-xl bg-rose-500 text-white text-xl font-semibold">Sell</button>
            </div>
        </section>
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
    const [tradeMode, setTradeMode] = useState("options");
    const [optionDirection, setOptionDirection] = useState("up");
    const [optionStake, setOptionStake] = useState("");
    const [optionDuration, setOptionDuration] = useState(60);
    const [search, setSearch] = useState("");
    const [timeframe, setTimeframe] = useState("1m");
    const [chartType, setChartType] = useState("candles");
    const [chartFullscreen, setChartFullscreen] = useState(false);
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
        return buildCandles([...prices, pairInfo.rate], timeframe);
    }, [pairInfo.baseMarket, pairInfo.rate, timeframe]);

    const quoteBalance = Number(portfolio?.balances?.[pairInfo.quote] || 0);
    const baseBalance = Number(portfolio?.balances?.[pairInfo.base] || 0);
    const estimated = side === "buy" ? (Number(amount || 0) / Math.max(pairInfo.rate, 0.00000001)) * (1 - Number(portfolio?.fee_rate || 0.001)) : (Number(amount || 0) * pairInfo.rate) * (1 - Number(portfolio?.fee_rate || 0.001));
    const mobileBookRows = useMemo(() => {
        const p = Number(pairInfo.rate || 0);
        return Array.from({ length: 5 }).map((_, i) => {
            const spread = (i + 1) * 0.000005;
            return {
                ask: p * (1 + spread),
                bid: p * (1 - spread),
                askSize: ((Math.sin(p + i) + 1.4) * (i + 1) * 0.18),
                bidSize: ((Math.cos(p + i) + 1.4) * (i + 1) * 0.18),
            };
        });
    }, [pairInfo.rate]);

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
        <div className="hidden xl:flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
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

        <div className="xl:hidden -mx-3 sm:mx-0 pb-4">
            <div className="px-3 pb-3 border-b border-white/10">
                <div className="flex items-center justify-between gap-4 overflow-x-auto text-2xl font-display font-semibold text-zinc-500">
                    {["Convert", "Spot", "Stocks", "P2P", "Alpha"].map((tab) => (
                        <button key={tab} className={tab === "Spot" ? "text-white" : "text-zinc-500"}>{tab}</button>
                    ))}
                    <button className="ml-auto text-zinc-300 text-3xl leading-none">≡</button>
                </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-3 border-b border-white/10 text-sm text-zinc-300">
                <span className="text-amber-300">■</span>
                <span className="truncate">Hot Campaign: Eregon precision trading rewards are live</span>
                <span className="text-zinc-400">×</span>
            </div>
            <MobileExchangeChart
                candles={candles}
                pairInfo={pairInfo}
                timeframe={timeframe}
                onTimeframe={setTimeframe}
                onOpenUp={() => { setTradeMode("options"); setOptionDirection("up"); }}
                onOpenDown={() => { setTradeMode("options"); setOptionDirection("down"); }}
            />

            <div className="px-3 py-4">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <button className="flex items-center gap-2 text-3xl font-display font-semibold">
                            {pairInfo.pair} <span className="text-base text-zinc-400">▼</span>
                        </button>
                        <p className={up ? "text-emerald-400 text-lg mt-1" : "text-rose-400 text-lg mt-1"}>{pct(pairInfo.baseMarket?.price_change_percentage_24h)}</p>
                    </div>
                    <div className="flex items-center gap-4 text-zinc-300">
                        <button onClick={() => setChartFullscreen(true)} className="text-2xl leading-none">▥</button>
                        <button className="text-3xl leading-none text-amber-300">...</button>
                    </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1.08fr)_minmax(118px,0.92fr)] gap-3">
                    <div className="space-y-3 min-w-0">
                        <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-[#151b24] p-1">
                            <button onClick={() => { setTradeMode("spot"); setSide("buy"); }} className={`rounded-lg py-2.5 text-base font-semibold ${tradeMode === "spot" && side === "buy" ? "bg-emerald-500 text-white" : "text-zinc-400"}`}>Buy</button>
                            <button onClick={() => { setTradeMode("spot"); setSide("sell"); }} className={`rounded-lg py-2.5 text-base font-semibold ${tradeMode === "spot" && side === "sell" ? "bg-rose-500 text-white" : "text-zinc-400"}`}>Sell</button>
                        </div>
                        <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-[#151b24] p-1">
                            <button onClick={() => setTradeMode("spot")} className={`rounded-lg py-2 text-sm font-semibold ${tradeMode === "spot" ? "bg-white/10 text-white" : "text-zinc-500"}`}>Spot</button>
                            <button onClick={() => setTradeMode("options")} className={`rounded-lg py-2 text-sm font-semibold ${tradeMode === "options" ? "bg-purple-500/30 text-purple-100" : "text-zinc-500"}`}>Options</button>
                        </div>
                        <select className="input-eregon h-12 bg-[#151b24] border-white/10" value={pairInfo.pair} onChange={(e) => setSelectedPair(e.target.value)}>{orderPairs.map((p) => <option key={p.pair}>{p.pair}</option>)}</select>

                        {tradeMode === "options" ? (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setOptionDirection("up")} className={`rounded-xl py-3 font-semibold border ${optionDirection === "up" ? "bg-emerald-500 text-white border-emerald-400" : "bg-[#151b24] border-white/10 text-zinc-400"}`}>↗ Up</button>
                                    <button onClick={() => setOptionDirection("down")} className={`rounded-xl py-3 font-semibold border ${optionDirection === "down" ? "bg-rose-500 text-white border-rose-400" : "bg-[#151b24] border-white/10 text-zinc-400"}`}>↘ Down</button>
                                </div>
                                <input className="input-eregon h-12 bg-[#151b24] border-white/10" value={optionStake} onChange={(e) => setOptionStake(e.target.value)} type="number" min="0" step="any" placeholder="Stake USDT" />
                                <select className="input-eregon h-12 bg-[#151b24] border-white/10" value={optionDuration} onChange={(e) => setOptionDuration(Number(e.target.value))}>{optionMeta.durations.map((d) => <option key={d} value={d}>{d < 60 ? `${d}s` : `${d / 60}m`}</option>)}</select>
                                <div className="text-sm space-y-1">
                                    <div className="flex justify-between text-zinc-400"><span>Avbl</span><span>{formatAmt(quoteBalance)} USDT</span></div>
                                    <div className="flex justify-between text-zinc-400"><span>Win payout</span><span>{formatUsd(Number(optionStake || 0) * (1 + Number(optionMeta.payout_rate || 0.8)))}</span></div>
                                </div>
                                <button disabled={submitting} onClick={submitOption} className="w-full min-h-14 rounded-xl gradient-gold text-black font-bold text-base">{submitting ? "Opening..." : `Open ${optionDirection.toUpperCase()} Contract`}</button>
                            </>
                        ) : (
                            <>
                                <div className="input-eregon h-12 bg-[#151b24] border-white/10 flex items-center justify-between">
                                    <span className="text-zinc-500">{side === "buy" ? "Total" : "Amount"}</span>
                                    <span className="font-semibold">{side === "buy" ? pairInfo.quote : pairInfo.base}</span>
                                </div>
                                <input className="input-eregon h-12 bg-[#151b24] border-white/10" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="any" placeholder={side === "buy" ? "Total" : "Amount"} />
                                <div className="text-sm space-y-1">
                                    <div className="flex justify-between text-zinc-400"><span>Avbl</span><span>{formatAmt(side === "buy" ? quoteBalance : baseBalance)} {side === "buy" ? pairInfo.quote : pairInfo.base}</span></div>
                                    <div className="flex justify-between text-zinc-400"><span>Est. Fee</span><span>{(Number(portfolio?.fee_rate || 0.001) * 100).toFixed(2)}%</span></div>
                                </div>
                                <button disabled={submitting} onClick={submit} className={`w-full min-h-14 rounded-xl font-bold text-base ${side === "buy" ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"}`}>{submitting ? "Filling..." : `${side === "buy" ? "Buy" : "Sell"} ${pairInfo.base}`}</button>
                            </>
                        )}
                    </div>

                    <div className="min-w-0">
                        <div className="grid grid-cols-2 gap-1 text-xs text-zinc-400 mb-2">
                            <span>Price</span><span className="text-right">Amount</span>
                        </div>
                        <div className="space-y-1">
                            {mobileBookRows.slice().reverse().map((r, i) => <div key={`m-ask-${i}`} className="grid grid-cols-2 gap-1 text-sm">
                                <span className="text-rose-400 bg-rose-500/10 px-1">{formatChartPrice(r.ask)}</span>
                                <span className="text-right text-zinc-100">{r.askSize.toFixed(5)}</span>
                            </div>)}
                        </div>
                        <div className="py-2">
                            <p className={up ? "text-3xl font-display text-emerald-400" : "text-3xl font-display text-rose-400"}>{formatChartPrice(pairInfo.rate)}</p>
                            <p className="text-xs text-zinc-500">≈ Rs{(pairInfo.rate * 280).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="space-y-1">
                            {mobileBookRows.map((r, i) => <div key={`m-bid-${i}`} className="grid grid-cols-2 gap-1 text-sm">
                                <span className="text-emerald-400 bg-emerald-500/10 px-1">{formatChartPrice(r.bid)}</span>
                                <span className="text-right text-zinc-100">{r.bidSize.toFixed(5)}</span>
                            </div>)}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-xs">
                            <span className="text-emerald-400">42.64%</span>
                            <span className="text-rose-400">57.36%</span>
                        </div>
                    </div>
                </div>

                <div className="mt-5 border-t border-white/10 pt-4">
                    <div className="flex items-center gap-5 text-lg font-display font-semibold">
                        <button className="text-white border-b-4 border-amber-400 pb-2">Open Orders (0)</button>
                        <button className="text-zinc-500 pb-2">Holdings ({portfolio?.positions?.length || 0})</button>
                    </div>
                    <div className="py-8 text-center text-zinc-300">
                        <div className="mx-auto mb-3 w-14 h-14 rounded-full border border-white/20 flex items-center justify-center text-2xl">◇</div>
                        <p className="font-semibold">Available Funds: {formatAmt(quoteBalance)} {pairInfo.quote}</p>
                    </div>
                </div>

                
            </div>
        </div>

        <div className="hidden xl:grid xl:grid-cols-[280px_minmax(0,1fr)_360px] gap-5">
            <Card hover={false} className="order-3 xl:order-none xl:min-h-[720px]">
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

            <div className="order-1 xl:order-none space-y-5 min-w-0">
                <Card hover={false} className="min-h-[420px]">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                        <div className="flex items-center gap-3 min-w-0">
                            {pairInfo.baseMarket?.image ? <img src={pairInfo.baseMarket.image} alt="" className="w-11 h-11 rounded-full" /> : <span className="w-11 h-11 rounded-2xl gradient-purple flex items-center justify-center font-bold">{pairInfo.base.slice(0, 2)}</span>}
                            <div><h2 className="font-display text-2xl">{pairInfo.pair}</h2><p className="text-sm text-zinc-500">{pairInfo.baseMarket?.name || pairInfo.base} / {pairInfo.quote}</p></div>
                        </div>
                        <div className="text-right"><p className="text-3xl font-display gradient-text-gold">{formatAmt(pairInfo.rate)}</p><p className={up ? "text-emerald-300 text-sm" : "text-rose-300 text-sm"}>{up ? <ArrowUpRight className="w-4 h-4 inline" /> : <ArrowDownRight className="w-4 h-4 inline" />} {pct(pairInfo.baseMarket?.price_change_percentage_24h)}</p></div>
                    </div>
                    <div className="h-[380px]">
                        <CandleChart candles={candles} pair={pairInfo.pair} timeframe={timeframe} onTimeframe={setTimeframe} chartType={chartType} onChartType={setChartType} fullscreen={chartFullscreen} onToggleFullscreen={() => setChartFullscreen((value) => !value)} />
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

            <div className="order-2 xl:order-none space-y-5">
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
