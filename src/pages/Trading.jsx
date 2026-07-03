import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    ArrowDownRight,
    ArrowLeft,
    ArrowUpRight,
    BarChart3,
    Bell,
    ChevronDown,
    LineChart,
    Maximize2,
    Menu,
    Minimize2,
    Minus,
    Plus,
    RefreshCcw,
    Search,
    SlidersHorizontal,
    Star,
    Wallet,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import { Badge, Card } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

const FX_PKR = 278;
const MIN_ZOOM = 1;
const MAX_ZOOM = 7;
const DEFAULT_MARKET_SOURCE = "Live market feed";

const formatUsd = (value, max = 6) => Number(value || 0).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number(value || 0) >= 1 ? 2 : max,
});
const formatPrice = (value) => Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: Number(value || 0) >= 1 ? 2 : 6,
});
const formatAmount = (value, max = 8) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: max });
const pct = (value) => `${Number(value || 0) >= 0 ? "+" : ""}${Number(value || 0).toFixed(2)}%`;
const compact = (value) => Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(Number(value || 0));

function useQueryPair() {
    const { search } = useLocation();
    return new URLSearchParams(search).get("pair") || "BTC/USDT";
}

const TIMEFRAMES = [
    { key: "15m", label: "15m", window: 110, bucket: 2 },
    { key: "1h", label: "1h", window: 180, bucket: 4 },
    { key: "4h", label: "4h", window: 260, bucket: 6 },
    { key: "1D", label: "1D", window: 420, bucket: 8 },
    { key: "1w", label: "1w", window: 9999, bucket: 10 },
];


function makeFallbackPrices(rate) {
    const base = Number(rate || 0);
    if (!base) return [];
    return Array.from({ length: 96 }).map((_, index) => {
        const wave = Math.sin(index / 5.5) * 0.012 + Math.cos(index / 9) * 0.006;
        const drift = (index - 48) * 0.00008;
        return Math.max(0.00000001, base * (1 + wave + drift));
    });
}

function buildCandles(prices = [], timeframe = "15m") {
    const cleaned = prices.map((price) => Number(price || 0)).filter((price) => price > 0);
    if (cleaned.length < 2) return [];
    const config = TIMEFRAMES.find((item) => item.key === timeframe) || TIMEFRAMES[0];
    const values = cleaned.slice(-Math.min(cleaned.length, config.window));
    const target = timeframe === "15m" ? 72 : 58;
    const step = Math.max(config.bucket, Math.floor(values.length / target));
    const candles = [];

    for (let i = 0; i < values.length; i += step) {
        const slice = values.slice(i, i + step);
        if (!slice.length) continue;
        const previous = candles[candles.length - 1]?.close ?? slice[0];
        const open = i === 0 ? slice[0] : previous;
        const close = slice[slice.length - 1] || open;
        const drift = Math.max(open, close) * 0.0015;
        const high = Math.max(open, close, ...slice) + drift * (1 + (i % 4) / 10);
        const low = Math.max(0.00000001, Math.min(open, close, ...slice) - drift * (1 + (i % 3) / 10));
        const volume = Math.max(1, slice.reduce((sum, item) => sum + Math.abs(item - open), 0) + Math.abs(close - open)) * (i + 2);
        candles.push({ open, high, low, close, volume });
    }
    return candles.slice(-target);
}

function computeRsi(candles = [], period = 6) {
    if (candles.length < period + 1) return [];
    const values = [];
    for (let i = period; i < candles.length; i += 1) {
        let gains = 0;
        let losses = 0;
        for (let j = i - period + 1; j <= i; j += 1) {
            const delta = candles[j].close - candles[j - 1].close;
            if (delta >= 0) gains += delta;
            else losses += Math.abs(delta);
        }
        const rs = losses === 0 ? 100 : gains / losses;
        values.push({ index: i, rsi: Math.max(0, Math.min(100, 100 - 100 / (1 + rs))) });
    }
    return values;
}

function OrderBookRows({ price, compactMode = false }) {
    const p = Number(price || 0);
    const rows = useMemo(() => Array.from({ length: compactMode ? 5 : 8 }).map((_, index) => {
        const spread = (index + 1) * 0.000006;
        const askSize = (Math.abs(Math.sin(p + index)) + 0.12) * (compactMode ? 0.65 : 1.8) * (index + 1);
        const bidSize = (Math.abs(Math.cos(p + index)) + 0.12) * (compactMode ? 0.65 : 1.8) * (index + 1);
        return {
            ask: p * (1 + spread),
            bid: p * (1 - spread),
            askSize,
            bidSize,
        };
    }), [p, compactMode]);

    return (
        <div className="min-w-0">
            <div className={`grid grid-cols-2 gap-2 ${compactMode ? "text-[11px]" : "text-xs"} text-zinc-500 mb-2`}>
                <span>Price</span>
                <span className="text-right">Amount</span>
            </div>
            <div className="space-y-1">
                {rows.slice().reverse().map((row, index) => (
                    <div key={`ask-${index}`} className={`grid grid-cols-2 gap-1 ${compactMode ? "text-[10px]" : "text-sm"}`}>
                        <span className="relative overflow-hidden rounded-sm px-1 text-rose-400">
                            <span className="absolute inset-y-0 right-0 bg-rose-500/10" style={{ width: `${Math.min(94, row.askSize * 10)}%` }} />
                            <span className="relative">{formatPrice(row.ask)}</span>
                        </span>
                        <span className="text-right text-zinc-100">{formatAmount(row.askSize, 5)}</span>
                    </div>
                ))}
            </div>
            <div className="py-2">
                <p className="font-display text-[22px] leading-none text-rose-400">{formatPrice(p)}</p>
                <p className="text-[11px] text-zinc-500">≈ Rs{(p * FX_PKR).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="space-y-1">
                {rows.map((row, index) => (
                    <div key={`bid-${index}`} className={`grid grid-cols-2 gap-1 ${compactMode ? "text-[10px]" : "text-sm"}`}>
                        <span className="relative overflow-hidden rounded-sm px-1 text-emerald-400">
                            <span className="absolute inset-y-0 right-0 bg-emerald-500/10" style={{ width: `${Math.min(94, row.bidSize * 10)}%` }} />
                            <span className="relative">{formatPrice(row.bid)}</span>
                        </span>
                        <span className="text-right text-zinc-100">{formatAmount(row.bidSize, 5)}</span>
                    </div>
                ))}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] font-medium">
                <span className="text-emerald-400">42.64%</span>
                <span className="h-1.5 flex-1 rounded-full overflow-hidden bg-rose-400/80"><span className="block h-full w-[43%] bg-emerald-400" /></span>
                <span className="text-rose-400">57.36%</span>
            </div>
        </div>
    );
}

function CandleChart({
    candles = [],
    pair = "BTC/USDT",
    timeframe = "15m",
    onTimeframe,
    chartType = "candles",
    onChartType,
    variant = "trade",
    fullscreen = false,
    onToggleFullscreen,
}) {
    const [hover, setHover] = useState(null);
    const [zoom, setZoom] = useState(variant === "analysis" ? 2.05 : 1.15);
    const [offset, setOffset] = useState(0);
    const [drag, setDrag] = useState(null);
    const wrapRef = useRef(null);
    const pointerCache = useRef(new Map());
    const pinchStart = useRef(null);

    const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value || MIN_ZOOM)));
    const visibleCountForZoom = (zoomValue) => Math.max(14, Math.min(candles.length || 14, Math.round((candles.length || 14) / clampZoom(zoomValue))));
    const maxOffsetForZoom = (zoomValue) => Math.max(0, (candles.length || 0) - visibleCountForZoom(zoomValue));
    const clampOffset = (value, zoomValue = zoom) => Math.max(0, Math.min(maxOffsetForZoom(zoomValue), Number(value || 0)));

    const changeZoom = (direction) => {
        setZoom((current) => {
            const next = clampZoom(Number((current + direction).toFixed(2)));
            setOffset((currentOffset) => clampOffset(currentOffset, next));
            return next;
        });
    };

    const visible = useMemo(() => {
        const source = candles.length ? candles : [];
        if (!source.length) return [];
        const count = Math.max(14, Math.min(source.length, Math.round(source.length / zoom)));
        const maxOffset = Math.max(0, source.length - count);
        const safeOffset = Math.max(0, Math.min(maxOffset, offset));
        const start = Math.max(0, source.length - count - safeOffset);
        return source.slice(start, start + count);
    }, [candles, zoom, offset]);

    useEffect(() => {
        setOffset((current) => {
            const count = visibleCountForZoom(zoom);
            return Math.max(0, Math.min(Math.max(0, (candles.length || 0) - count), current));
        });
    }, [candles.length, zoom]);

    if (!visible.length) {
        return <div className="h-full min-h-[260px] bg-[#111923] flex items-center justify-center text-zinc-500">Waiting for chart data...</div>;
    }

    const width = variant === "analysis" || fullscreen ? 760 : 660;
    const height = variant === "analysis" ? 560 : fullscreen ? 520 : 286;
    const rsiHeight = variant === "analysis" ? 104 : 68;
    const pad = variant === "analysis"
        ? { left: 34, right: 92, top: 24, bottom: 32 }
        : { left: 24, right: 74, top: 28, bottom: 30 };
    const chartBottom = height - pad.bottom - rsiHeight;
    const plotH = chartBottom - pad.top;
    const hi = Math.max(...visible.map((c) => c.high));
    const lo = Math.min(...visible.map((c) => c.low));
    const span = Math.max(0.00000001, hi - lo);
    const maxVol = Math.max(...visible.map((c) => c.volume || 1));
    const plotW = width - pad.left - pad.right;
    const y = (value) => pad.top + ((hi - value) / span) * plotH;
    const xFor = (index) => pad.left + (index + 0.5) * (plotW / visible.length);
    const candleW = Math.max(3, Math.min(12, (plotW / visible.length) * 0.58));
    const ticks = Array.from({ length: variant === "analysis" ? 6 : 5 }).map((_, i) => lo + (span * i) / (variant === "analysis" ? 5 : 4));
    const last = visible[visible.length - 1];
    const hoverCandle = hover ? visible[hover.index] : last;
    const rsi = computeRsi(visible, 6);
    const rsiY = (value) => chartBottom + 14 + ((100 - value) / 100) * (rsiHeight - 24);
    const rsiPath = rsi.map((item, idx) => `${idx === 0 ? "M" : "L"} ${xFor(item.index).toFixed(2)} ${rsiY(item.rsi).toFixed(2)}`).join(" ");
    const closePath = visible.map((c, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(2)} ${y(c.close).toFixed(2)}`).join(" ");
    const maPath = (period) => visible.map((_, index) => {
        if (index < period - 1) return null;
        const slice = visible.slice(index - period + 1, index + 1);
        const avg = slice.reduce((sum, candle) => sum + candle.close, 0) / period;
        return `${index === period - 1 ? "M" : "L"} ${xFor(index).toFixed(2)} ${y(avg).toFixed(2)}`;
    }).filter(Boolean).join(" ");

    const handleMove = (event) => {
        pointerCache.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointerCache.current.size >= 2) {
            event.preventDefault();
            const points = Array.from(pointerCache.current.values()).slice(0, 2);
            const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
            if (!pinchStart.current) {
                pinchStart.current = { distance, zoom };
                return;
            }
            if (pinchStart.current.distance > 0) {
                const nextZoom = clampZoom(pinchStart.current.zoom * (distance / pinchStart.current.distance));
                setZoom(nextZoom);
                setOffset((currentOffset) => clampOffset(currentOffset, nextZoom));
            }
            setHover(null);
            return;
        }

        if (drag && event.pointerId === drag.pointerId) {
            const rect = event.currentTarget.getBoundingClientRect();
            const dx = event.clientX - drag.x;
            const candlePixels = rect.width / Math.max(1, visible.length);
            if (Math.abs(dx) > candlePixels * 0.8) {
                const shift = Math.round(-dx / candlePixels);
                setOffset((current) => clampOffset(current + shift));
                setDrag({ ...drag, x: event.clientX });
            }
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const relX = ((event.clientX - rect.left) / rect.width) * width;
        const relY = ((event.clientY - rect.top) / rect.height) * height;
        if (relX < pad.left || relX > width - pad.right || relY < pad.top || relY > chartBottom) {
            setHover(null);
            return;
        }
        const index = Math.max(0, Math.min(visible.length - 1, Math.floor(((relX - pad.left) / plotW) * visible.length)));
        const price = hi - ((relY - pad.top) / plotH) * span;
        setHover({ index, x: xFor(index), y: relY, price });
    };

    const handleWheel = (event) => {
        event.preventDefault();
        changeZoom(event.deltaY > 0 ? -0.3 : 0.3);
    };

    const handlePointerDown = (event) => {
        event.preventDefault();
        pointerCache.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointerCache.current.size === 2) {
            const points = Array.from(pointerCache.current.values()).slice(0, 2);
            pinchStart.current = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom };
            setDrag(null);
        } else {
            setDrag({ pointerId: event.pointerId, x: event.clientX });
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const handlePointerUp = (event) => {
        if (event?.pointerId !== undefined) pointerCache.current.delete(event.pointerId);
        if (pointerCache.current.size < 2) pinchStart.current = null;
        setDrag(null);
    };

    return (
        <div className={`${fullscreen ? "fixed inset-0 z-[90] bg-[#111923]" : "h-full bg-[#111923]"} flex flex-col overflow-hidden`}>
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/5 bg-[#111923]">
                <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-zinc-200 truncate">{pair} Chart</p>
                    <p className="text-[9px] uppercase tracking-[0.16em] text-zinc-600">Pinch/scroll to zoom · drag to pan</p>
                </div>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => changeZoom(0.5)} className="w-8 h-8 rounded-lg bg-white/5 text-zinc-300 flex items-center justify-center" aria-label="Zoom in"><Plus className="w-4 h-4" /></button>
                    <button type="button" onClick={() => changeZoom(-0.5)} className="w-8 h-8 rounded-lg bg-white/5 text-zinc-300 flex items-center justify-center" aria-label="Zoom out"><Minus className="w-4 h-4" /></button>
                    {onToggleFullscreen && (
                        <button type="button" onClick={onToggleFullscreen} className="w-8 h-8 rounded-lg bg-white/5 text-zinc-300 flex items-center justify-center" aria-label="Toggle chart fullscreen">
                            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>
            <div ref={wrapRef} className="relative flex-1 min-h-0 touch-none">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    preserveAspectRatio="none"
                    onPointerMove={handleMove}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    onPointerLeave={(event) => { setHover(null); handlePointerUp(event); }}
                    onWheel={handleWheel}
                    className="w-full h-full select-none cursor-grab active:cursor-grabbing"
                >
                    <defs>
                        <linearGradient id={`chartFade-${variant}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.10" />
                            <stop offset="55%" stopColor="#111923" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <rect x="0" y="0" width={width} height={height} fill="#111923" />
                    <rect x="0" y="0" width={width} height={chartBottom} fill={`url(#chartFade-${variant})`} />
                    {ticks.map((tick) => (
                        <g key={tick}>
                            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="rgba(255,255,255,.075)" />
                            <text x={width - pad.right + 8} y={y(tick) + 5} fill="rgba(255,255,255,.48)" fontSize={variant === "analysis" ? "14" : "11"}>{formatPrice(tick)}</text>
                        </g>
                    ))}
                    <text x={pad.left} y={variant === "analysis" ? 20 : 18} fill="rgba(255,255,255,.76)" fontSize={variant === "analysis" ? "13" : "10"}>
                        O {formatPrice(hoverCandle.open)}  H {formatPrice(hoverCandle.high)}  L {formatPrice(hoverCandle.low)}  C {formatPrice(hoverCandle.close)}
                    </text>
                    {visible.map((candle, index) => {
                        const x = xFor(index);
                        const up = candle.close >= candle.open;
                        const color = up ? "#35c98b" : "#f6465d";
                        const bodyTop = y(Math.max(candle.open, candle.close));
                        const bodyBottom = y(Math.min(candle.open, candle.close));
                        const bodyH = Math.max(2, bodyBottom - bodyTop);
                        const vHeight = Math.max(2, ((candle.volume || 1) / maxVol) * 34);
                        return (
                            <g key={`${index}-${candle.close}`}>
                                <rect x={x - candleW / 2} y={chartBottom - vHeight} width={candleW} height={vHeight} fill={up ? "rgba(53,201,139,.18)" : "rgba(246,70,93,.18)"} rx="1" />
                                {chartType === "candles" ? (
                                    <>
                                        <line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth={variant === "analysis" ? 2 : 1.4} />
                                        <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} rx="1.4" />
                                    </>
                                ) : null}
                            </g>
                        );
                    })}
                    {chartType === "line" && <path d={closePath} fill="none" stroke="#f0b90b" strokeWidth="2.4" />}
                    {chartType === "candles" && <>
                        <path d={maPath(7)} fill="none" stroke="#f0b90b" strokeWidth="1.45" opacity=".95" />
                        <path d={maPath(25)} fill="none" stroke="#8b5cf6" strokeWidth="1.35" opacity=".85" />
                    </>}
                    <line x1={pad.left} x2={width - pad.right} y1={y(last.close)} y2={y(last.close)} stroke="rgba(255,255,255,.45)" strokeDasharray="4 4" />
                    <rect x={width - pad.right + 8} y={y(last.close) - 14} width={pad.right - 10} height="28" rx="6" fill="#1f2937" stroke="rgba(255,255,255,.55)" />
                    <text x={width - pad.right + 8 + (pad.right - 10) / 2} y={y(last.close) + 5} textAnchor="middle" fill="white" fontSize={variant === "analysis" ? "16" : "11"}>{formatPrice(last.close)}</text>
                    {hover && (
                        <>
                            <line x1={hover.x} x2={hover.x} y1={pad.top} y2={chartBottom} stroke="rgba(255,255,255,.28)" strokeDasharray="5 5" />
                            <line x1={pad.left} x2={width - pad.right} y1={hover.y} y2={hover.y} stroke="rgba(255,255,255,.28)" strokeDasharray="5 5" />
                        </>
                    )}
                    <line x1="0" x2={width} y1={chartBottom} y2={chartBottom} stroke="rgba(255,255,255,.09)" />
                    <text x={pad.left} y={chartBottom + 22} fill="#f0b90b" fontSize={variant === "analysis" ? "16" : "12"}>RSI(6): {rsi.length ? rsi[rsi.length - 1].rsi.toFixed(2) : "--"}</text>
                    <line x1={pad.left} x2={width - pad.right} y1={rsiY(70)} y2={rsiY(70)} stroke="rgba(255,255,255,.45)" strokeDasharray="7 7" />
                    <line x1={pad.left} x2={width - pad.right} y1={rsiY(40)} y2={rsiY(40)} stroke="rgba(255,255,255,.32)" strokeDasharray="7 7" />
                    <path d={rsiPath} fill="none" stroke="#f0b90b" strokeWidth={variant === "analysis" ? 2 : 1.5} />
                    <text x={width - pad.right + 8} y={rsiY(70) + 5} fill="rgba(255,255,255,.55)" fontSize="12">70.0</text>
                    <text x={width - pad.right + 8} y={rsiY(40) + 5} fill="rgba(255,255,255,.55)" fontSize="12">40.0</text>
                </svg>
                <div className="absolute left-3 bottom-3 flex items-center gap-2 rounded-full bg-black/35 px-2 py-1 text-[10px] text-zinc-400 backdrop-blur">
                    <span>Zoom {zoom.toFixed(1)}x</span>
                    <span className="text-zinc-600">•</span>
                    <span>Drag to pan</span>
                </div>
            </div>
            <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-white/5 bg-[#111923] overflow-x-auto">
                <div className="flex items-center gap-1">
                    {TIMEFRAMES.map((tf) => (
                        <button key={tf.key} type="button" onClick={() => onTimeframe?.(tf.key)} className={`px-3 py-1.5 text-[12px] rounded-lg font-medium ${timeframe === tf.key ? "text-[#f0b90b] border-b-2 border-[#f0b90b]" : "text-zinc-500"}`}>{tf.label}</button>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onChartType?.("candles")} className={`w-8 h-8 rounded-lg flex items-center justify-center ${chartType === "candles" ? "text-[#f0b90b] bg-white/5" : "text-zinc-500"}`}><BarChart3 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => onChartType?.("line")} className={`w-8 h-8 rounded-lg flex items-center justify-center ${chartType === "line" ? "text-[#f0b90b] bg-white/5" : "text-zinc-500"}`}><LineChart className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
}

function MobileChartView({ pairInfo, candles, timeframe, setTimeframe, chartType, setChartType, up, onBack, side, setSide, setTradeMode }) {
    return (
        <div className="fixed inset-0 z-[90] bg-[#1f2732] text-zinc-100 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-10 bg-[#1f2732]/95 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="w-8 h-8 -ml-2 flex items-center justify-center text-zinc-100" aria-label="Back to trade"><ArrowLeft className="w-5 h-5" /></button>
                        <button className="flex items-center gap-1 text-[20px] font-bold truncate">{pairInfo.pair}<ChevronDown className="w-5 h-5 text-zinc-300" /></button>
                    </div>
                    <div className="flex items-center gap-4 text-zinc-100">
                        <span className="font-black text-[18px] text-purple-400">Ai</span>
                        <Star className="w-5 h-5" />
                        <Bell className="w-5 h-5" />
                    </div>
                </div>
                <div className="flex items-center gap-6 px-4 text-[17px] font-semibold text-zinc-400 overflow-x-auto">
                    {["Price", "Info", "Trading Data", "Square", "Trade-X"].map((item, index) => (
                        <button key={item} className={`relative py-3 whitespace-nowrap ${index === 0 ? "text-white" : ""}`}>
                            {item}
                            {item === "Trade-X" && <span className="absolute -top-0.5 right-[-16px] rounded-full bg-[#f0b90b] px-1 text-[9px] font-bold text-black">New</span>}
                            {index === 0 && <span className="absolute left-0 bottom-0 h-1 w-8 bg-[#f0b90b] rounded-full" />}
                        </button>
                    ))}
                </div>
            </div>

            <div className="px-4 pt-4">
                <div className="grid grid-cols-[1fr_auto] gap-5">
                    <div>
                        <p className="text-[40px] leading-none font-bold tracking-tight text-white">{formatPrice(pairInfo.rate)}</p>
                        <p className="mt-1.5 text-[15px] font-semibold text-white">Rs{(pairInfo.rate * FX_PKR).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className={up ? "text-emerald-400" : "text-rose-400"}>{pct(pairInfo.baseMarket?.price_change_percentage_24h)}</span></p>
                        <div className="mt-2 flex items-center gap-2 text-[#f0b90b] text-[12px] font-semibold">
                            <span>Payments</span><span className="text-zinc-500">|</span><span>Vol</span><span className="text-zinc-500">|</span><span>Price Protection</span><ChevronDown className="w-4 h-4 -rotate-90" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] min-w-[175px]">
                        <div><p className="text-zinc-500">24h High</p><p className="text-white font-medium">{formatPrice(pairInfo.baseMarket?.high_24h || pairInfo.rate * 1.018)}</p></div>
                        <div><p className="text-zinc-500">24h Vol({pairInfo.base})</p><p className="text-white font-medium">{compact(pairInfo.baseMarket?.total_volume || 0)}</p></div>
                        <div><p className="text-zinc-500">24h Low</p><p className="text-white font-medium">{formatPrice(pairInfo.baseMarket?.low_24h || pairInfo.rate * 0.982)}</p></div>
                        <div><p className="text-zinc-500">24h Vol({pairInfo.quote})</p><p className="text-white font-medium">{compact((pairInfo.baseMarket?.total_volume || 0) * pairInfo.rate)}</p></div>
                    </div>
                </div>
            </div>

            <div className="mt-4 h-[calc(100vh-315px)] min-h-[430px] max-h-[650px] border-y border-white/5">
                <CandleChart
                    candles={candles}
                    pair={pairInfo.pair}
                    timeframe={timeframe}
                    onTimeframe={setTimeframe}
                    chartType={chartType}
                    onChartType={setChartType}
                    variant="analysis"
                />
            </div>

            <div className="px-4 pt-4">
                <div className="flex items-center gap-7 text-[16px] text-zinc-400 overflow-x-auto">
                    {["MA", "EMA", "BOLL", "SAR", "AVL", "SUPER", "VOL"].map((item) => <button key={item}>{item}</button>)}
                    <button className="ml-auto text-white"><LineChart className="w-5 h-5" /></button>
                </div>
                <div className="mt-4 flex items-center gap-5 text-[13px] text-zinc-400 overflow-x-auto">
                    {["Today", "7 Days", "30 Days", "90 Days", "180 Days", "1 Year"].map((item) => <button key={item}>{item}</button>)}
                </div>
                <div className="mt-5 grid grid-cols-[auto_auto_auto_1fr_1fr] gap-3 items-center pb-5">
                    <button className="text-center text-zinc-100"><span className="mx-auto mb-1 w-8 h-8 rounded-full border border-white/50 flex items-center justify-center">•••</span><span className="text-xs">More</span></button>
                    <button className="text-center text-zinc-100"><span className="mx-auto mb-1 w-8 h-8 grid grid-cols-2 gap-1 p-1"><i className="border border-white rounded-sm" /><i className="border border-white rounded-sm rotate-45" /><i className="border border-white rounded-sm rotate-45" /><i className="border border-white rounded-sm" /></span><span className="text-xs">Hub</span></button>
                    <button className="text-center text-zinc-100"><span className="mx-auto mb-1 w-8 h-8 flex items-center justify-center text-2xl">↗</span><span className="text-xs">Margin</span></button>
                    <button onClick={() => { setSide("buy"); setTradeMode("spot"); onBack(); }} className="h-12 rounded-xl bg-emerald-500 text-white text-[19px] font-bold">Buy</button>
                    <button onClick={() => { setSide("sell"); setTradeMode("spot"); onBack(); }} className="h-12 rounded-xl bg-rose-500 text-white text-[19px] font-bold">Sell</button>
                </div>
            </div>
        </div>
    );
}

function MobileTradeView({ pairInfo, pairs, orderPairs, portfolio, orders, options, side, setSide, amount, setAmount, tradeMode, setTradeMode, optionDirection, setOptionDirection, optionStake, setOptionStake, optionDuration, setOptionDuration, optionMeta, submitting, submit, submitOption, setSelectedPair, quoteBalance, baseBalance, onOpenChart, up }) {
    const [percent, setPercent] = useState(0);
    const available = side === "buy" ? quoteBalance : baseBalance;

    const setPresetAmount = (value) => {
        setPercent(value);
        if (!available) return setAmount("");
        const calculated = (Number(available) * value) / 100;
        setAmount(calculated ? String(Number(calculated.toFixed(6))) : "");
    };

    return (
        <div className="xl:hidden -mx-3 sm:mx-0 bg-[#1f2732] min-h-[calc(100vh-72px)] pb-24 text-zinc-100 text-[13px]">
            <div className="px-4 pt-3 border-b border-white/5">
                <div className="flex items-center justify-between gap-4 overflow-x-auto text-[20px] leading-tight font-bold text-zinc-500">
                    {["Convert", "Spot", "Stocks", "P2P", "Alpha"].map((tab) => <button key={tab} className={`whitespace-nowrap ${tab === "Spot" ? "text-white" : ""}`}>{tab}</button>)}
                    <Menu className="w-6 h-6 ml-auto text-zinc-200 shrink-0" />
                </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 text-[12px] text-zinc-200">
                <span className="text-[#f0b90b] text-base">♛</span>
                <span className="truncate">Hot Campaign: Eregon exchange mode is live with protected internal wallet trades</span>
                <span className="text-zinc-300 text-base">×</span>
            </div>

            <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                        <button className="flex items-center gap-1 text-[22px] leading-none font-bold tracking-tight text-white">
                            {pairInfo.pair}<ChevronDown className="w-5 h-5" />
                        </button>
                        <p className={`mt-1.5 text-[14px] font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>{pct(pairInfo.baseMarket?.price_change_percentage_24h)}</p>
                    </div>
                    <div className="flex items-center gap-5 text-zinc-200">
                        <button onClick={onOpenChart} className="relative w-8 h-8 flex items-center justify-center"><BarChart3 className="w-5 h-5" /></button>
                        <button className="relative w-8 h-8 flex items-center justify-center"><span className="absolute -top-1 right-0 w-3 h-3 rounded-full bg-[#f0b90b]" /><span className="text-3xl leading-none tracking-[2px]">…</span></button>
                    </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1.08fr)_minmax(112px,0.92fr)] gap-3">
                    <div className="min-w-0 space-y-2.5">
                        <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-[#2a3441] p-0.5">
                            <button onClick={() => { setTradeMode("spot"); setSide("buy"); }} className={`h-10 rounded-lg text-[18px] font-bold ${tradeMode === "spot" && side === "buy" ? "bg-emerald-500 text-white" : "text-zinc-400"}`}>Buy</button>
                            <button onClick={() => { setTradeMode("spot"); setSide("sell"); }} className={`h-10 rounded-lg text-[18px] font-bold ${tradeMode === "spot" && side === "sell" ? "bg-rose-500 text-white" : "text-zinc-400"}`}>Sell</button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setTradeMode("spot")} className={`h-9 rounded-xl text-[13px] font-bold ${tradeMode === "spot" ? "bg-[#2a3441] text-white" : "bg-[#151c26] text-zinc-500"}`}>Market</button>
                            <button onClick={() => setTradeMode("options")} className={`h-9 rounded-xl text-[13px] font-bold ${tradeMode === "options" ? "bg-purple-500/25 text-purple-100" : "bg-[#151c26] text-zinc-500"}`}>Trade-X</button>
                        </div>

                        <select className="w-full h-10 rounded-xl border-0 bg-[#2a3441] px-3 text-[14px] font-semibold text-white outline-none" value={pairInfo.pair} onChange={(event) => setSelectedPair(event.target.value)}>
                            {orderPairs.map((pair) => <option key={pair.pair}>{pair.pair}</option>)}
                        </select>

                        {tradeMode === "spot" ? (
                            <>
                                <div className="grid grid-cols-[1fr_auto] items-center h-11 rounded-xl bg-[#2a3441] overflow-hidden">
                                    <input className="h-full min-w-0 bg-transparent px-3 text-[15px] text-white outline-none placeholder:text-zinc-500" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0" step="any" placeholder={side === "buy" ? "Total" : "Amount"} />
                                    <span className="px-2.5 text-[13px] font-bold text-white border-l border-white/5">{side === "buy" ? pairInfo.quote : pairInfo.base}<ChevronDown className="w-4 h-4 inline ml-1 text-zinc-400" /></span>
                                </div>
                                <div className="relative pt-2 pb-3">
                                    <div className="absolute left-0 right-0 top-[16px] h-0.5 bg-zinc-600/50" />
                                    <div className="relative flex items-center justify-between">
                                        {[0, 25, 50, 75, 100].map((item) => (
                                            <button key={item} onClick={() => setPresetAmount(item)} className={`relative w-4 h-4 rotate-45 border-2 ${percent === item ? "border-white bg-[#2a3441]" : "border-zinc-600 bg-[#1f2732]"}`} aria-label={`${item}%`} />
                                        ))}
                                    </div>
                                    <span className="absolute -top-1 left-0 -translate-x-1 rounded-md bg-zinc-300 px-2 py-0.5 text-[10px] font-semibold text-zinc-800">{percent}%</span>
                                </div>
                                <label className="flex items-center gap-2 text-[13px] text-white"><span className="w-5 h-5 rounded-md border-2 border-zinc-500" />Slippage Tolerance</label>
                                <div className="space-y-0.5 text-[13px]">
                                    <div className="flex justify-between"><span className="text-zinc-400">Avbl</span><span>{formatAmount(available)} {side === "buy" ? pairInfo.quote : pairInfo.base} <button className="ml-1 w-5 h-5 rounded-full bg-[#f0b90b] text-black font-bold">+</button></span></div>
                                    <div className="flex justify-between"><span className="text-zinc-400">Max {side === "buy" ? "Buy" : "Sell"}</span><span>{side === "buy" ? formatAmount(Number(amount || 0) / Math.max(pairInfo.rate, 0.00000001)) : formatAmount(Number(amount || 0) * pairInfo.rate)} {side === "buy" ? pairInfo.base : pairInfo.quote}</span></div>
                                    <div className="flex justify-between"><span className="text-zinc-400">Est. Fee</span><span>{(Number(portfolio?.fee_rate || 0.001) * 100).toFixed(2)}%</span></div>
                                </div>
                                <button disabled={submitting} onClick={submit} className={`w-full h-12 rounded-xl text-[18px] font-bold text-white ${side === "buy" ? "bg-emerald-500" : "bg-rose-500"}`}>{submitting ? "Processing..." : `${side === "buy" ? "Buy" : "Sell"} ${pairInfo.base}`}</button>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setOptionDirection("up")} className={`h-10 rounded-xl text-[14px] font-bold ${optionDirection === "up" ? "bg-emerald-500 text-white" : "bg-[#2a3441] text-zinc-400"}`}>↗ Up</button>
                                    <button onClick={() => setOptionDirection("down")} className={`h-10 rounded-xl text-[14px] font-bold ${optionDirection === "down" ? "bg-rose-500 text-white" : "bg-[#2a3441] text-zinc-400"}`}>↘ Down</button>
                                </div>
                                <input className="w-full h-11 rounded-xl border-0 bg-[#2a3441] px-3 text-[15px] text-white outline-none placeholder:text-zinc-500" value={optionStake} onChange={(event) => setOptionStake(event.target.value)} type="number" min="0" step="any" placeholder="Stake USDT" />
                                <select className="w-full h-10 rounded-xl border-0 bg-[#2a3441] px-3 text-[14px] text-white outline-none" value={optionDuration} onChange={(event) => setOptionDuration(Number(event.target.value))}>{optionMeta.durations.map((duration) => <option key={duration} value={duration}>{duration < 60 ? `${duration}s` : `${duration / 60}m`}</option>)}</select>
                                <div className="space-y-0.5 text-[13px]">
                                    <div className="flex justify-between"><span className="text-zinc-400">Avbl</span><span>{formatAmount(quoteBalance)} USDT</span></div>
                                    <div className="flex justify-between"><span className="text-zinc-400">Win payout</span><span>{formatUsd(Number(optionStake || 0) * (1 + Number(optionMeta.payout_rate || 0.8)))}</span></div>
                                </div>
                                <button disabled={submitting} onClick={submitOption} className={`w-full h-12 rounded-xl text-[15px] font-bold text-white ${optionDirection === "up" ? "bg-emerald-500" : "bg-rose-500"}`}>{submitting ? "Opening..." : `Open ${optionDirection.toUpperCase()} Contract`}</button>
                            </>
                        )}
                    </div>

                    <OrderBookRows price={pairInfo.rate} compactMode />
                </div>

                <div className="mt-4 border-t border-white/5 pt-3">
                    <div className="flex items-center gap-5 text-[16px] font-bold overflow-x-auto">
                        <button className="relative pb-3 text-white whitespace-nowrap">Open Orders ({orders?.filter((item) => item.status === "open").length || 0})<span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-1 w-8 rounded-full bg-[#f0b90b]" /></button>
                        <button className="pb-3 text-zinc-500 whitespace-nowrap">Holdings ({portfolio?.positions?.length || 0})</button>
                        <button className="pb-3 text-zinc-500 whitespace-nowrap">Bots</button>
                    </div>
                    <div className="py-7 text-center text-zinc-100">
                        <div className="mx-auto mb-3 w-12 h-12 rounded-full border-2 border-white/70 flex items-center justify-center text-2xl">◇</div>
                        <p className="text-[15px] font-semibold">Available Funds: {formatAmount(quoteBalance)} {pairInfo.quote}</p>
                    </div>
                </div>

                <button onClick={onOpenChart} className="w-full h-12 rounded-xl border border-white/10 bg-[#202936] px-3 flex items-center justify-between text-left text-[15px] font-semibold">
                    <span>{pairInfo.pair} Chart</span>
                    <ChevronDown className="w-5 h-5 rotate-180 text-zinc-400" />
                </button>

                {(options || []).length > 0 && (
                    <div className="mt-4 rounded-xl border border-white/5 bg-[#151c26] p-4">
                        <p className="font-bold mb-3">Recent Trade-X Contracts</p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {options.slice(0, 4).map((option) => (
                                <div key={option.id} className="flex items-center justify-between text-sm">
                                    <span>{option.pair} · {option.direction}</span>
                                    <span className={option.status === "won" ? "text-emerald-400" : option.status === "lost" ? "text-rose-400" : "text-[#f0b90b]"}>{option.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
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
    const [timeframe, setTimeframe] = useState("1w");
    const [chartType, setChartType] = useState("candles");
    const [chartFullscreen, setChartFullscreen] = useState(false);
    const [mobileChartOpen, setMobileChartOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const load = async (force = false) => {
        try {
            const [marketResult, pairResult, portfolioResult, ordersResult, optionsResult] = await Promise.allSettled([
                api.get("/markets", { params: { limit: 200, include_custom: true, force } }),
                api.get("/trading/pairs"),
                api.get("/trading/portfolio"),
                api.get("/trading/orders", { params: { limit: 25 } }),
                api.get("/trading/options", { params: { limit: 25 } }),
            ]);

            if (marketResult.status === "fulfilled") setMarketPayload(marketResult.value.data);
            else throw marketResult.reason;
            if (pairResult.status === "fulfilled") setPairs(pairResult.value.data.pairs || []);
            if (portfolioResult.status === "fulfilled") setPortfolio(portfolioResult.value.data);
            if (ordersResult.status === "fulfilled") setOrders(ordersResult.value.data || []);
            if (optionsResult.status === "fulfilled") {
                setOptions(optionsResult.value.data.items || []);
                setOptionMeta({
                    payout_rate: optionsResult.value.data.payout_rate ?? 0.8,
                    durations: optionsResult.value.data.durations || [30, 60, 120, 300],
                });
            }
        } catch (error) {
            toast.error(formatApiError(error));
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
    const marketBySymbol = useMemo(() => Object.fromEntries(markets.map((coin) => [String(coin.symbol || "").toUpperCase(), coin])), [markets]);
    const pairInfo = useMemo(() => {
        const raw = selectedPair.toUpperCase().replace("-", "/");
        const [base = "BTC", quote = "USDT"] = raw.split("/");
        const baseMarket = marketBySymbol[base] || {};
        const quoteMarket = marketBySymbol[quote] || { current_price: 1 };
        const rate = Number(baseMarket.current_price || 0) / Math.max(0.00000001, Number(quoteMarket.current_price || 1));
        return { pair: `${base}/${quote}`, base, quote, rate, baseMarket, quoteMarket };
    }, [selectedPair, marketBySymbol]);

    const filteredPairs = useMemo(() => {
        const term = search.toLowerCase().trim();
        return pairs.filter((pair) => !term || pair.pair.toLowerCase().includes(term));
    }, [pairs, search]);
    const orderPairs = useMemo(() => tradeMode === "options" ? pairs.filter((pair) => pair.quote === "USDT") : pairs, [pairs, tradeMode]);

    useEffect(() => {
        if (tradeMode === "options" && pairInfo.quote !== "USDT") {
            const firstUsdt = pairs.find((pair) => pair.quote === "USDT");
            if (firstUsdt) setSelectedPair(firstUsdt.pair);
        }
    }, [tradeMode, pairInfo.quote, pairs]);

    const candles = useMemo(() => {
        const prices = pairInfo.baseMarket?.sparkline_in_7d?.price || makeFallbackPrices(pairInfo.rate);
        return buildCandles([...prices, pairInfo.rate].filter(Boolean), timeframe);
    }, [pairInfo.baseMarket, pairInfo.rate, timeframe]);

    const quoteBalance = Number(portfolio?.balances?.[pairInfo.quote] || 0);
    const baseBalance = Number(portfolio?.balances?.[pairInfo.base] || 0);
    const estimated = side === "buy"
        ? (Number(amount || 0) / Math.max(pairInfo.rate, 0.00000001)) * (1 - Number(portfolio?.fee_rate || 0.001))
        : (Number(amount || 0) * pairInfo.rate) * (1 - Number(portfolio?.fee_rate || 0.001));
    const up = Number(pairInfo.baseMarket?.price_change_percentage_24h || 0) >= 0;

    const submit = async () => {
        if (!amount || Number(amount) <= 0) return toast.error("Enter a valid order amount");
        setSubmitting(true);
        try {
            const { data } = await api.post("/trading/orders", { pair: pairInfo.pair, side, amount: Number(amount), order_type: "market" });
            toast.success(`${side === "buy" ? "Bought" : "Sold"} ${data.trade.executed_base} ${data.trade.base_symbol}`);
            setAmount("");
            await load(true);
        } catch (error) {
            toast.error(formatApiError(error));
        } finally {
            setSubmitting(false);
        }
    };

    const submitOption = async () => {
        if (!optionStake || Number(optionStake) <= 0) return toast.error("Enter a valid contract stake");
        setSubmitting(true);
        try {
            const { data } = await api.post("/trading/options", { pair: pairInfo.pair, direction: optionDirection, stake: Number(optionStake), duration_seconds: Number(optionDuration) });
            toast.success(`${optionDirection.toUpperCase()} contract opened at ${formatPrice(data.option.entry_rate)}`);
            setOptionStake("");
            await load(true);
        } catch (error) {
            toast.error(formatApiError(error));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <DashboardLayout><CinematicLoader /></DashboardLayout>;

    return (
        <DashboardLayout>
            {mobileChartOpen && (
                <MobileChartView
                    pairInfo={pairInfo}
                    candles={candles}
                    timeframe={timeframe}
                    setTimeframe={setTimeframe}
                    chartType={chartType}
                    setChartType={setChartType}
                    up={up}
                    onBack={() => setMobileChartOpen(false)}
                    side={side}
                    setSide={setSide}
                    setTradeMode={setTradeMode}
                />
            )}

            <MobileTradeView
                pairInfo={pairInfo}
                pairs={pairs}
                orderPairs={orderPairs}
                portfolio={portfolio}
                orders={orders}
                options={options}
                side={side}
                setSide={setSide}
                amount={amount}
                setAmount={setAmount}
                tradeMode={tradeMode}
                setTradeMode={setTradeMode}
                optionDirection={optionDirection}
                setOptionDirection={setOptionDirection}
                optionStake={optionStake}
                setOptionStake={setOptionStake}
                optionDuration={optionDuration}
                setOptionDuration={setOptionDuration}
                optionMeta={optionMeta}
                submitting={submitting}
                submit={submit}
                submitOption={submitOption}
                setSelectedPair={setSelectedPair}
                quoteBalance={quoteBalance}
                baseBalance={baseBalance}
                onOpenChart={() => setMobileChartOpen(true)}
                up={up}
            />

            <div className="hidden xl:block">
                <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-amber-400/80">Eregon Exchange</p>
                        <h1 className="text-4xl font-display font-semibold mt-1">Spot Trading</h1>
                        <p className="text-zinc-400 mt-2 max-w-2xl">A tighter exchange-style layout with live pair pricing, draggable zoom charts, internal wallet conversion, and protected Eregon Trade-X contracts.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge color={marketPayload?.source === "coingecko" ? "emerald" : "gold"}>{marketPayload?.provider || DEFAULT_MARKET_SOURCE}</Badge>
                        <Badge color="purple">Fee {(Number(portfolio?.fee_rate || 0.001) * 100).toFixed(2)}%</Badge>
                        <button className="btn-ghost px-4 py-2 text-sm" onClick={() => load(true)}><RefreshCcw className="w-4 h-4" /> Refresh</button>
                    </div>
                </div>

                <div className="grid grid-cols-[280px_minmax(0,1fr)_360px] gap-5">
                    <Card hover={false} className="min-h-[720px]">
                        <div className="flex items-center justify-between mb-4"><h2 className="font-display text-xl">Pairs</h2><Badge>{pairs.length}</Badge></div>
                        <div className="relative mb-3"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /><input className="input-eregon pl-10 py-2" placeholder="Search pair..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                        <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                            {filteredPairs.map((pair) => {
                                const active = pair.pair === pairInfo.pair;
                                return (
                                    <button key={pair.pair} onClick={() => setSelectedPair(pair.pair)} className={`w-full text-left rounded-xl border px-3 py-3 transition-all ${active ? "bg-purple-500/15 border-purple-400/30" : "bg-black/30 border-white/5 hover:border-white/15"}`}>
                                        <div className="flex items-center justify-between gap-2"><span className="font-semibold">{pair.pair}</span><span className="text-xs text-zinc-500">{formatPrice(pair.rate)}</span></div>
                                        <p className="text-[11px] text-zinc-500 mt-1">{pair.base} priced in {pair.quote}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    <div className="space-y-5 min-w-0">
                        <Card hover={false} className="min-h-[520px] p-0 overflow-hidden">
                            <div className="flex items-start justify-between gap-4 p-5 border-b border-white/5 bg-[#111923]">
                                <div className="flex items-center gap-3 min-w-0">
                                    {pairInfo.baseMarket?.image ? <img src={pairInfo.baseMarket.image} alt="" className="w-11 h-11 rounded-full" /> : <span className="w-11 h-11 rounded-2xl gradient-purple flex items-center justify-center font-bold">{pairInfo.base.slice(0, 2)}</span>}
                                    <div><h2 className="font-display text-2xl">{pairInfo.pair}</h2><p className="text-sm text-zinc-500">{pairInfo.baseMarket?.name || pairInfo.base} / {pairInfo.quote}</p></div>
                                </div>
                                <div className="text-right"><p className={up ? "text-3xl font-display text-emerald-400" : "text-3xl font-display text-rose-400"}>{formatPrice(pairInfo.rate)}</p><p className={up ? "text-emerald-300 text-sm" : "text-rose-300 text-sm"}>{up ? <ArrowUpRight className="w-4 h-4 inline" /> : <ArrowDownRight className="w-4 h-4 inline" />} {pct(pairInfo.baseMarket?.price_change_percentage_24h)}</p></div>
                            </div>
                            <div className="h-[450px]">
                                <CandleChart candles={candles} pair={pairInfo.pair} timeframe={timeframe} onTimeframe={setTimeframe} chartType={chartType} onChartType={setChartType} fullscreen={chartFullscreen} onToggleFullscreen={() => setChartFullscreen((value) => !value)} />
                            </div>
                        </Card>

                        <div className="grid lg:grid-cols-2 gap-5">
                            <Card hover={false}>
                                <div className="flex items-center gap-2 mb-4"><SlidersHorizontal className="w-4 h-4 text-amber-300" /><h2 className="font-display text-xl">Order Book</h2></div>
                                <OrderBookRows price={pairInfo.rate} />
                            </Card>
                            <Card hover={false}>
                                <div className="flex items-center gap-2 mb-4"><Wallet className="w-4 h-4 text-purple-300" /><h2 className="font-display text-xl">Portfolio</h2></div>
                                <p className="text-3xl font-display gradient-text-gold mb-4">{formatUsd(portfolio?.total_usd || 0)}</p>
                                <div className="space-y-2 max-h-[240px] overflow-y-auto">
                                    {(portfolio?.positions || []).map((pos) => <div key={pos.symbol} className="flex items-center justify-between gap-3 rounded-xl bg-black/35 border border-white/5 px-3 py-2">
                                        <div><p className="font-semibold">{pos.symbol}</p><p className="text-xs text-zinc-500">{formatAmount(pos.amount)}</p></div>
                                        <div className="text-right"><p className="text-sm">{formatUsd(pos.usd_value)}</p><p className={Number(pos.change_24h) >= 0 ? "text-xs text-emerald-300" : "text-xs text-rose-300"}>{pct(pos.change_24h)}</p></div>
                                    </div>)}
                                </div>
                            </Card>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <Card hover={false}>
                            <div className="flex items-center justify-between gap-3 mb-5"><h2 className="font-display text-xl">Place Order</h2><Badge color={tradeMode === "spot" ? (side === "buy" ? "emerald" : "rose") : "purple"}>{tradeMode === "spot" ? side.toUpperCase() : "TRADE-X"}</Badge></div>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                <button onClick={() => setTradeMode("spot")} className={`rounded-xl py-3 font-semibold border ${tradeMode === "spot" ? "bg-amber-500/15 text-amber-200 border-amber-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Spot</button>
                                <button onClick={() => setTradeMode("options")} className={`rounded-xl py-3 font-semibold border ${tradeMode === "options" ? "bg-purple-500/15 text-purple-200 border-purple-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Trade-X</button>
                            </div>
                            <label className="text-xs uppercase tracking-widest text-zinc-500">Pair</label>
                            <select className="input-eregon mt-2 mb-4" value={pairInfo.pair} onChange={(event) => setSelectedPair(event.target.value)}>{orderPairs.map((pair) => <option key={pair.pair}>{pair.pair}</option>)}</select>

                            {tradeMode === "spot" ? (
                                <>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <button onClick={() => setSide("buy")} className={`rounded-xl py-3 font-semibold border ${side === "buy" ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Buy</button>
                                        <button onClick={() => setSide("sell")} className={`rounded-xl py-3 font-semibold border ${side === "sell" ? "bg-rose-500/15 text-rose-200 border-rose-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Sell</button>
                                    </div>
                                    <label className="text-xs uppercase tracking-widest text-zinc-500">{side === "buy" ? `Spend amount (${pairInfo.quote})` : `Sell amount (${pairInfo.base})`}</label>
                                    <input className="input-eregon mt-2" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0" step="any" placeholder={side === "buy" ? `Available ${formatAmount(quoteBalance)} ${pairInfo.quote}` : `Available ${formatAmount(baseBalance)} ${pairInfo.base}`} />
                                    <div className="rounded-2xl bg-black/35 border border-white/5 p-4 my-4 space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-zinc-500">Market rate</span><span>{formatPrice(pairInfo.rate)} {pairInfo.quote}</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Estimated receive</span><span>{formatAmount(estimated)} {side === "buy" ? pairInfo.base : pairInfo.quote}</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Fee</span><span>{(Number(portfolio?.fee_rate || 0.001) * 100).toFixed(2)}%</span></div>
                                    </div>
                                    <button disabled={submitting} onClick={submit} className={side === "buy" ? "btn-gold w-full" : "btn-eregon w-full"}>{submitting ? "Filling order..." : `${side === "buy" ? "Buy" : "Sell"} ${pairInfo.base}`}</button>
                                    <p className="text-xs text-zinc-500 mt-3">Internal wallet conversion. This is not an external exchange withdrawal or real broker order.</p>
                                </>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-2 mb-4">
                                        <button onClick={() => setOptionDirection("up")} className={`rounded-xl py-3 font-semibold border ${optionDirection === "up" ? "bg-emerald-500/15 text-emerald-200 border-emerald-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}><ArrowUpRight className="w-4 h-4 inline" /> Up</button>
                                        <button onClick={() => setOptionDirection("down")} className={`rounded-xl py-3 font-semibold border ${optionDirection === "down" ? "bg-rose-500/15 text-rose-200 border-rose-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}><ArrowDownRight className="w-4 h-4 inline" /> Down</button>
                                    </div>
                                    <label className="text-xs uppercase tracking-widest text-zinc-500">Stake (USDT)</label>
                                    <input className="input-eregon mt-2 mb-4" value={optionStake} onChange={(event) => setOptionStake(event.target.value)} type="number" min="0" step="any" placeholder={`Available ${formatAmount(quoteBalance)} USDT`} />
                                    <label className="text-xs uppercase tracking-widest text-zinc-500">Duration</label>
                                    <select className="input-eregon mt-2" value={optionDuration} onChange={(event) => setOptionDuration(Number(event.target.value))}>{optionMeta.durations.map((duration) => <option key={duration} value={duration}>{duration < 60 ? `${duration}s` : `${duration / 60}m`}</option>)}</select>
                                    <div className="rounded-2xl bg-black/35 border border-white/5 p-4 my-4 space-y-2 text-sm">
                                        <div className="flex justify-between"><span className="text-zinc-500">Entry rate</span><span>{formatPrice(pairInfo.rate)} {pairInfo.quote}</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Win payout</span><span>{formatUsd(Number(optionStake || 0) * (1 + Number(optionMeta.payout_rate || 0.8)))}</span></div>
                                        <div className="flex justify-between"><span className="text-zinc-500">Profit on win</span><span>{formatUsd(Number(optionStake || 0) * Number(optionMeta.payout_rate || 0.8))}</span></div>
                                    </div>
                                    <button disabled={submitting} onClick={submitOption} className={optionDirection === "up" ? "btn-gold w-full" : "btn-eregon w-full"}>{submitting ? "Opening contract..." : `Open ${optionDirection.toUpperCase()} Contract`}</button>
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
                                    <div className="grid grid-cols-2 gap-2 text-xs mt-3"><span className="text-zinc-500">Filled</span><span className="text-right">{formatAmount(order.executed_base)} {order.base_symbol}</span><span className="text-zinc-500">Rate</span><span className="text-right">{formatPrice(order.rate)}</span></div>
                                </div>)}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
