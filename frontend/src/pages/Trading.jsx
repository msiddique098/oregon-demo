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
    Minimize2,
    RefreshCcw,
    Search,
    SlidersHorizontal,
    Star,
    Wallet,
} from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import CinematicLoader from "../components/CinematicLoader";
import NotificationBell from "../components/NotificationBell";
import RealtimeStatus from "../components/RealtimeStatus";
import { Badge, Card } from "../components/ui-eregon";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";
import { createChart, CandlestickSeries, HistogramSeries, LineSeries } from "lightweight-charts";

const FX_PKR = 278;
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
    return Array.from({ length: 420 }).map((_, index) => {
        const wave = Math.sin(index / 5.5) * 0.012 + Math.cos(index / 9) * 0.006;
        const drift = (index - 210) * 0.000025;
        return Math.max(0.00000001, base * (1 + wave + drift));
    });
}

function buildCandles(prices = [], timeframe = "15m") {
    const cleaned = prices.map((price) => Number(price || 0)).filter((price) => price > 0);
    if (cleaned.length < 2) return [];
    const config = TIMEFRAMES.find((item) => item.key === timeframe) || TIMEFRAMES[0];
    const values = cleaned.slice(-Math.min(cleaned.length, config.window));
    const target = timeframe === "15m" ? 240 : timeframe === "1h" ? 220 : timeframe === "4h" ? 200 : 180;
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
            <div className={`grid grid-cols-2 gap-1.5 ${compactMode ? "text-[10px]" : "text-xs"} text-zinc-500 mb-2`}>
                <span>Price</span>
                <span className="text-right">Amount</span>
            </div>
            <div className="space-y-1">
                {rows.slice().reverse().map((row, index) => (
                    <div key={`ask-${index}`} className={`grid grid-cols-2 gap-1 ${compactMode ? "text-[9.5px]" : "text-sm"}`}>
                        <span className="relative overflow-hidden rounded-sm px-1 text-rose-400">
                            <span className="absolute inset-y-0 right-0 bg-rose-500/10" style={{ width: `${Math.min(94, row.askSize * 10)}%` }} />
                            <span className="relative">{formatPrice(row.ask)}</span>
                        </span>
                        <span className="text-right text-zinc-100">{formatAmount(row.askSize, 5)}</span>
                    </div>
                ))}
            </div>
            <div className="py-2">
                <p className="font-display text-[18px] leading-none text-rose-400">{formatPrice(p)}</p>
                <p className="text-[11px] text-zinc-500">≈ Rs{(p * FX_PKR).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="space-y-1">
                {rows.map((row, index) => (
                    <div key={`bid-${index}`} className={`grid grid-cols-2 gap-1 ${compactMode ? "text-[9.5px]" : "text-sm"}`}>
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

const TF_SECONDS = {
    "15m": 15 * 60,
    "1h": 60 * 60,
    "4h": 4 * 60 * 60,
    "1D": 24 * 60 * 60,
    "1w": 7 * 24 * 60 * 60,
};

function toChartCandles(candles = [], timeframe = "15m") {
    const step = TF_SECONDS[timeframe] || TF_SECONDS["15m"];
    const now = Math.floor(Date.now() / step) * step;
    const start = now - Math.max(0, candles.length - 1) * step;
    return candles
        .map((candle, index) => ({
            time: start + index * step,
            open: Number(candle.open || 0),
            high: Number(candle.high || 0),
            low: Number(candle.low || 0),
            close: Number(candle.close || 0),
            volume: Number(candle.volume || 0),
        }))
        .filter((item) => item.time && item.open > 0 && item.high > 0 && item.low > 0 && item.close > 0)
        .sort((a, b) => a.time - b.time);
}

function buildMaLine(data = [], period = 7) {
    const output = [];
    for (let index = period - 1; index < data.length; index += 1) {
        const slice = data.slice(index - period + 1, index + 1);
        const value = slice.reduce((sum, candle) => sum + candle.close, 0) / period;
        output.push({ time: data[index].time, value });
    }
    return output;
}

function buildRsiLine(data = [], period = 6) {
    const output = [];
    for (let i = period; i < data.length; i += 1) {
        let gains = 0;
        let losses = 0;
        for (let j = i - period + 1; j <= i; j += 1) {
            const delta = data[j].close - data[j - 1].close;
            if (delta >= 0) gains += delta;
            else losses += Math.abs(delta);
        }
        const rs = losses === 0 ? 100 : gains / Math.max(losses, 0.00000001);
        const value = Math.max(0, Math.min(100, 100 - 100 / (1 + rs)));
        output.push({ time: data[i].time, value });
    }
    return output;
}

function safeRange(range) {
    if (!range || !Number.isFinite(range.from) || !Number.isFinite(range.to)) return null;
    if (range.to <= range.from) return null;
    return { from: Number(range.from), to: Number(range.to) };
}

function clampLogicalRange(range, totalBars) {
    const clean = safeRange(range);
    if (!clean || !totalBars) return null;
    const minBars = 6;
    const maxBars = Math.max(36, totalBars + 12);
    const span = Math.max(minBars, Math.min(maxBars, clean.to - clean.from));
    const center = (clean.from + clean.to) / 2;
    let from = center - span / 2;
    let to = center + span / 2;

    // Keep a little whitespace at both ends but avoid losing the data area completely.
    const hardMin = -8;
    const hardMax = totalBars + 8;
    if (from < hardMin) {
        to += hardMin - from;
        from = hardMin;
    }
    if (to > hardMax) {
        from -= to - hardMax;
        to = hardMax;
    }
    return { from, to };
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
    const mainContainerRef = useRef(null);
    const rsiContainerRef = useRef(null);
    const mainChartRef = useRef(null);
    const rsiChartRef = useRef(null);
    const seriesRef = useRef({});
    const syncingRef = useRef(false);
    const chartStorageKey = `eregon-native-lwc-visible-range-${variant}-${pair}-${timeframe}`;
    const chartData = useMemo(() => toChartCandles(candles, timeframe), [candles, timeframe]);
    const [visibleBars, setVisibleBars] = useState(0);

    const chartHeightClass = variant === "analysis" ? "h-full min-h-[330px]" : fullscreen ? "h-full min-h-[420px]" : "h-full min-h-[250px]";
    const mainHeight = variant === "analysis" ? "calc(100% - 82px)" : "calc(100% - 72px)";
    const rsiHeight = variant === "analysis" ? 82 : 72;

    useEffect(() => {
        if (!mainContainerRef.current || !rsiContainerRef.current) return undefined;

        const common = {
            autoSize: true,
            layout: {
                background: { type: "solid", color: "#1f2732" },
                textColor: "rgba(234, 239, 247, 0.72)",
                fontSize: variant === "analysis" ? 10 : 9,
                fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
            },
            grid: {
                vertLines: { color: "rgba(255,255,255,0.055)" },
                horzLines: { color: "rgba(255,255,255,0.075)" },
            },
            crosshair: {
                vertLine: { color: "rgba(234,239,247,.36)", width: 1, style: 3, labelBackgroundColor: "#2a3441" },
                horzLine: { color: "rgba(234,239,247,.36)", width: 1, style: 3, labelBackgroundColor: "#2a3441" },
                mode: 0,
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false,
            },
            handleScale: {
                mouseWheel: true,
                pinch: true,
                axisPressedMouseMove: true,
                axisDoubleClickReset: false,
            },
            kineticScroll: { mouse: true, touch: true },
            localization: {
                priceFormatter: (price) => formatPrice(price),
            },
        };

        const mainChart = createChart(mainContainerRef.current, {
            ...common,
            rightPriceScale: {
                borderVisible: false,
                scaleMargins: { top: 0.07, bottom: 0.22 },
            },
            timeScale: {
                visible: false,
                timeVisible: true,
                secondsVisible: false,
                borderVisible: false,
                rightOffset: 5,
                barSpacing: variant === "analysis" ? 4.4 : 3.8,
                minBarSpacing: 0.5,
                maxBarSpacing: 64,
                lockVisibleTimeRangeOnResize: true,
                shiftVisibleRangeOnNewBar: false,
                enableConflation: true,
            },
        });

        const rsiChart = createChart(rsiContainerRef.current, {
            ...common,
            rightPriceScale: {
                borderVisible: false,
                scaleMargins: { top: 0.12, bottom: 0.12 },
                minimumWidth: 48,
            },
            timeScale: {
                visible: true,
                timeVisible: true,
                secondsVisible: false,
                borderVisible: false,
                rightOffset: 5,
                barSpacing: variant === "analysis" ? 4.4 : 3.8,
                minBarSpacing: 0.5,
                maxBarSpacing: 64,
                lockVisibleTimeRangeOnResize: true,
                shiftVisibleRangeOnNewBar: false,
                enableConflation: true,
            },
        });

        const candleSeries = mainChart.addSeries(CandlestickSeries, {
            upColor: "#35c98b",
            downColor: "#f6465d",
            wickUpColor: "#35c98b",
            wickDownColor: "#f6465d",
            borderVisible: false,
            priceLineColor: "rgba(234,239,247,.55)",
            lastValueVisible: true,
            priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
        });
        const closeLineSeries = mainChart.addSeries(LineSeries, {
            color: "#f0b90b",
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: false,
            visible: false,
            priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
        });
        const ma7Series = mainChart.addSeries(LineSeries, { color: "#f0b90b", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        const ma25Series = mainChart.addSeries(LineSeries, { color: "#8b5cf6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        const volumeSeries = mainChart.addSeries(HistogramSeries, {
            priceScaleId: "volume",
            priceFormat: { type: "volume" },
            lastValueVisible: false,
            priceLineVisible: false,
        });
        mainChart.priceScale("volume").applyOptions({
            scaleMargins: { top: 0.78, bottom: 0 },
            borderVisible: false,
        });
        const rsiSeries = rsiChart.addSeries(LineSeries, {
            color: "#f0b90b",
            lineWidth: 1,
            priceLineVisible: false,
            lastValueVisible: false,
            priceScaleId: "right",
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
        });

        const syncFromMain = (range) => {
            const next = clampLogicalRange(range, seriesRef.current.totalBars || 0);
            if (!next || syncingRef.current) return;
            syncingRef.current = true;
            rsiChart.timeScale().setVisibleLogicalRange(next);
            try { window.localStorage?.setItem(chartStorageKey, JSON.stringify(next)); } catch (_) { /* ignore */ }
            setVisibleBars(Math.max(0, Math.round(next.to - next.from)));
            requestAnimationFrame(() => { syncingRef.current = false; });
        };
        const syncFromRsi = (range) => {
            const next = clampLogicalRange(range, seriesRef.current.totalBars || 0);
            if (!next || syncingRef.current) return;
            syncingRef.current = true;
            mainChart.timeScale().setVisibleLogicalRange(next);
            try { window.localStorage?.setItem(chartStorageKey, JSON.stringify(next)); } catch (_) { /* ignore */ }
            setVisibleBars(Math.max(0, Math.round(next.to - next.from)));
            requestAnimationFrame(() => { syncingRef.current = false; });
        };
        mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncFromMain);
        rsiChart.timeScale().subscribeVisibleLogicalRangeChange(syncFromRsi);

        mainChartRef.current = mainChart;
        rsiChartRef.current = rsiChart;
        seriesRef.current = {
            candleSeries,
            closeLineSeries,
            ma7Series,
            ma25Series,
            volumeSeries,
            rsiSeries,
            totalBars: chartData.length,
        };

        const saveAndApplyRange = (range) => {
            const next = clampLogicalRange(range, seriesRef.current.totalBars || chartData.length || 0);
            if (!next) return;
            syncingRef.current = true;
            mainChart.timeScale().setVisibleLogicalRange(next);
            rsiChart.timeScale().setVisibleLogicalRange(next);
            try { window.localStorage?.setItem(chartStorageKey, JSON.stringify(next)); } catch (_) { /* ignore */ }
            setVisibleBars(Math.max(0, Math.round(next.to - next.from)));
            requestAnimationFrame(() => { syncingRef.current = false; });
        };
        const getCurrentRange = () => safeRange(mainChart.timeScale().getVisibleLogicalRange()) || clampLogicalRange({ from: Math.max(0, chartData.length - 54), to: chartData.length + 4 }, chartData.length);
        const zoomRange = (factor, anchorRatio = 0.5) => {
            const current = getCurrentRange();
            if (!current) return;
            const span = current.to - current.from;
            const anchor = current.from + span * anchorRatio;
            const nextSpan = Math.max(6, Math.min(Math.max(36, (seriesRef.current.totalBars || chartData.length) + 12), span * factor));
            saveAndApplyRange({ from: anchor - nextSpan * anchorRatio, to: anchor + nextSpan * (1 - anchorRatio) });
        };
        const panRange = (deltaX, width) => {
            const current = getCurrentRange();
            if (!current || !width) return;
            const span = current.to - current.from;
            const bars = (deltaX / width) * span;
            saveAndApplyRange({ from: current.from - bars, to: current.to - bars });
        };
        const containers = [mainContainerRef.current, rsiContainerRef.current].filter(Boolean);
        const dragState = { active: false, x: 0 };
        const touchState = { lastX: 0, lastDistance: 0 };
        const onWheel = (event) => {
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            const anchorRatio = rect.width ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0.5;
            const factor = event.deltaY > 0 ? 1.12 : 0.88;
            zoomRange(factor, anchorRatio);
        };
        const onPointerDown = (event) => {
            if (event.pointerType === "touch") return;
            dragState.active = true;
            dragState.x = event.clientX;
            event.currentTarget.setPointerCapture?.(event.pointerId);
        };
        const onPointerMove = (event) => {
            if (!dragState.active || event.pointerType === "touch") return;
            const dx = event.clientX - dragState.x;
            dragState.x = event.clientX;
            panRange(dx, event.currentTarget.clientWidth);
        };
        const onPointerUp = () => { dragState.active = false; };
        const touchDistance = (touches) => Math.abs(touches[0].clientX - touches[1].clientX);
        const touchCenterRatio = (touches, element) => {
            const rect = element.getBoundingClientRect();
            const center = (touches[0].clientX + touches[1].clientX) / 2;
            return rect.width ? Math.max(0, Math.min(1, (center - rect.left) / rect.width)) : 0.5;
        };
        const onTouchStart = (event) => {
            if (event.touches.length === 1) {
                touchState.lastX = event.touches[0].clientX;
                touchState.lastDistance = 0;
            } else if (event.touches.length === 2) {
                touchState.lastDistance = touchDistance(event.touches);
            }
        };
        const onTouchMove = (event) => {
            if (event.touches.length === 1) {
                event.preventDefault();
                const x = event.touches[0].clientX;
                const dx = x - touchState.lastX;
                touchState.lastX = x;
                panRange(dx, event.currentTarget.clientWidth);
            } else if (event.touches.length === 2) {
                event.preventDefault();
                const distance = touchDistance(event.touches);
                if (touchState.lastDistance > 0 && distance > 0) {
                    const factor = Math.max(0.75, Math.min(1.35, touchState.lastDistance / distance));
                    zoomRange(factor, touchCenterRatio(event.touches, event.currentTarget));
                }
                touchState.lastDistance = distance;
            }
        };
        const onTouchEnd = () => {
            touchState.lastDistance = 0;
            dragState.active = false;
        };
        containers.forEach((container) => {
            container.addEventListener("wheel", onWheel, { passive: false });
            container.addEventListener("pointerdown", onPointerDown);
            container.addEventListener("pointermove", onPointerMove);
            container.addEventListener("pointerup", onPointerUp);
            container.addEventListener("pointercancel", onPointerUp);
            container.addEventListener("touchstart", onTouchStart, { passive: false });
            container.addEventListener("touchmove", onTouchMove, { passive: false });
            container.addEventListener("touchend", onTouchEnd);
            container.addEventListener("touchcancel", onTouchEnd);
        });

        return () => {
            containers.forEach((container) => {
                container.removeEventListener("wheel", onWheel);
                container.removeEventListener("pointerdown", onPointerDown);
                container.removeEventListener("pointermove", onPointerMove);
                container.removeEventListener("pointerup", onPointerUp);
                container.removeEventListener("pointercancel", onPointerUp);
                container.removeEventListener("touchstart", onTouchStart);
                container.removeEventListener("touchmove", onTouchMove);
                container.removeEventListener("touchend", onTouchEnd);
                container.removeEventListener("touchcancel", onTouchEnd);
            });
            mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncFromMain);
            rsiChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncFromRsi);
            mainChart.remove();
            rsiChart.remove();
            mainChartRef.current = null;
            rsiChartRef.current = null;
            seriesRef.current = {};
        };
    // Recreate only when the chart mode shell changes. Data updates are handled in the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variant, fullscreen]);

    useEffect(() => {
        const refs = seriesRef.current;
        if (!mainChartRef.current || !rsiChartRef.current || !refs.candleSeries || !chartData.length) return;
        refs.totalBars = chartData.length;
        const candleData = chartData.map((item) => ({ time: item.time, open: item.open, high: item.high, low: item.low, close: item.close }));
        const closeData = chartData.map((item) => ({ time: item.time, value: item.close }));
        const volumeData = chartData.map((item) => ({
            time: item.time,
            value: item.volume,
            color: item.close >= item.open ? "rgba(53,201,139,.28)" : "rgba(246,70,93,.26)",
        }));

        refs.candleSeries.setData(candleData);
        refs.closeLineSeries.setData(closeData);
        refs.ma7Series.setData(buildMaLine(chartData, 7));
        refs.ma25Series.setData(buildMaLine(chartData, 25));
        refs.volumeSeries.setData(volumeData);
        refs.rsiSeries.setData(buildRsiLine(chartData, 6));
        refs.candleSeries.applyOptions({ visible: chartType === "candles" });
        refs.closeLineSeries.applyOptions({ visible: chartType === "line" });
        refs.ma7Series.applyOptions({ visible: chartType === "candles" });
        refs.ma25Series.applyOptions({ visible: chartType === "candles" });

        let applied = false;
        try {
            const stored = JSON.parse(window.localStorage?.getItem(chartStorageKey) || "null");
            const restored = clampLogicalRange(stored, chartData.length);
            if (restored) {
                mainChartRef.current.timeScale().setVisibleLogicalRange(restored);
                rsiChartRef.current.timeScale().setVisibleLogicalRange(restored);
                setVisibleBars(Math.round(restored.to - restored.from));
                applied = true;
            }
        } catch (_) { /* ignore invalid saved ranges */ }
        if (!applied) {
            const defaultBars = variant === "analysis" ? 78 : 54;
            const initialRange = clampLogicalRange({ from: Math.max(0, chartData.length - defaultBars), to: chartData.length + 4 }, chartData.length);
            if (initialRange) {
                mainChartRef.current.timeScale().setVisibleLogicalRange(initialRange);
                rsiChartRef.current.timeScale().setVisibleLogicalRange(initialRange);
                setVisibleBars(Math.round(initialRange.to - initialRange.from));
            }
        }
    }, [chartData, chartType, chartStorageKey, variant]);

    useEffect(() => {
        const refs = seriesRef.current;
        if (!refs.closeLineSeries || !refs.candleSeries || !refs.ma7Series || !refs.ma25Series) return;
        refs.candleSeries.applyOptions({ visible: chartType === "candles" });
        refs.closeLineSeries.applyOptions({ visible: chartType === "line" });
        refs.ma7Series.applyOptions({ visible: chartType === "candles" });
        refs.ma25Series.applyOptions({ visible: chartType === "candles" });
    }, [chartType]);

    if (!chartData.length) {
        return <div className="h-full min-h-[260px] bg-[#1f2732] flex items-center justify-center text-zinc-500">Waiting for chart data...</div>;
    }

    const showChrome = variant !== "analysis";

    return (
        <div className={`${fullscreen ? "fixed inset-0 z-[90] bg-[#1f2732]" : chartHeightClass} flex flex-col overflow-hidden bg-[#1f2732]`}>
            {showChrome && <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/5 bg-[#1f2732]">
                <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-zinc-200 truncate">{pair} Chart</p>
                    <p className="text-[9px] uppercase tracking-[0.14em] text-zinc-600">Native Lightweight Charts zoom/pan</p>
                </div>
                <div className="flex items-center gap-1">
                    {onToggleFullscreen && (
                        <button type="button" onClick={onToggleFullscreen} className="w-8 h-8 rounded-lg bg-white/5 text-zinc-300 flex items-center justify-center" aria-label="Toggle chart fullscreen">
                            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>}
            <div className="relative min-h-0" style={{ height: mainHeight, touchAction: "none", overscrollBehavior: "contain" }}>
                <div ref={mainContainerRef} className="absolute inset-0" />
                <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/25 px-1.5 py-0.5 text-[9px] font-medium text-zinc-400">
                    {visibleBars ? `${visibleBars} bars` : "native zoom"}
                </div>
            </div>
            <div className="relative shrink-0 border-t border-white/5" style={{ height: rsiHeight, touchAction: "none", overscrollBehavior: "contain" }}>
                <div ref={rsiContainerRef} className="absolute inset-0" />
                <div className="pointer-events-none absolute left-2 top-1 text-[9px] font-semibold text-[#f0b90b]">RSI(6)</div>
            </div>
            {showChrome && <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-t border-white/5 bg-[#1f2732] overflow-x-auto">
                <div className="flex items-center gap-1">
                    {TIMEFRAMES.map((tf) => (
                        <button key={tf.key} type="button" onClick={() => onTimeframe?.(tf.key)} className={`px-3 py-1.5 text-[12px] rounded-lg font-medium ${timeframe === tf.key ? "text-[#f0b90b] border-b-2 border-[#f0b90b]" : "text-zinc-500"}`}>{tf.label}</button>
                    ))}
                </div>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onChartType?.("candles")} className={`w-8 h-8 rounded-lg flex items-center justify-center ${chartType === "candles" ? "text-[#f0b90b] bg-white/5" : "text-zinc-500"}`}><BarChart3 className="w-4 h-4" /></button>
                    <button type="button" onClick={() => onChartType?.("line")} className={`w-8 h-8 rounded-lg flex items-center justify-center ${chartType === "line" ? "text-[#f0b90b] bg-white/5" : "text-zinc-500"}`}><LineChart className="w-4 h-4" /></button>
                </div>
            </div>}
        </div>
    );
}

function MobileChartView({ pairInfo, candles, timeframe, setTimeframe, chartType, setChartType, up, onBack, side, setSide, setTradeMode }) {
    return (
        <div className="fixed inset-0 z-[90] bg-[#1f2732] text-zinc-100 overflow-y-auto pb-[env(safe-area-inset-bottom)] text-[12px]">
            <div className="sticky top-0 z-10 bg-[#1f2732]/95 backdrop-blur-xl border-b border-white/5">
                <div className="flex items-center justify-between px-3 h-11">
                    <div className="flex items-center gap-4 min-w-0">
                        <button onClick={onBack} className="w-8 h-8 -ml-2 flex items-center justify-center text-zinc-100" aria-label="Back to trade"><ArrowLeft className="w-5 h-5" /></button>
                        <button className="flex items-center gap-1 text-[17px] font-bold truncate">{pairInfo.pair}<ChevronDown className="w-5 h-5 text-zinc-300" /></button>
                    </div>
                    <div className="flex items-center gap-4 text-zinc-100">
                        <Star className="w-5 h-5" />
                        <Bell className="w-5 h-5" />
                    </div>
                </div>
            </div>

            <div className="px-3 pt-3">
                <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div>
                        <p className="text-[30px] leading-none font-bold tracking-tight text-white">{formatPrice(pairInfo.rate)}</p>
                        <p className="mt-1 text-[12px] font-semibold text-white">Rs{(pairInfo.rate * FX_PKR).toLocaleString(undefined, { maximumFractionDigits: 2 })} <span className={up ? "text-emerald-400" : "text-rose-400"}>{pct(pairInfo.baseMarket?.price_change_percentage_24h)}</span></p>
                        <div className="mt-1.5 flex items-center gap-1.5 text-[#f0b90b] text-[10px] font-semibold">
                            <span>Payments</span><span className="text-zinc-500">|</span><span>Vol</span><span className="text-zinc-500">|</span><span>Price Protection</span><ChevronDown className="w-4 h-4 -rotate-90" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] min-w-[152px]">
                        <div><p className="text-zinc-500">24h High</p><p className="text-white font-medium">{formatPrice(pairInfo.baseMarket?.high_24h || pairInfo.rate * 1.018)}</p></div>
                        <div><p className="text-zinc-500">24h Vol({pairInfo.base})</p><p className="text-white font-medium">{compact(pairInfo.baseMarket?.total_volume || 0)}</p></div>
                        <div><p className="text-zinc-500">24h Low</p><p className="text-white font-medium">{formatPrice(pairInfo.baseMarket?.low_24h || pairInfo.rate * 0.982)}</p></div>
                        <div><p className="text-zinc-500">24h Vol({pairInfo.quote})</p><p className="text-white font-medium">{compact((pairInfo.baseMarket?.total_volume || 0) * pairInfo.rate)}</p></div>
                    </div>
                </div>
            </div>

            <div className="px-3 mt-3 flex items-center justify-between gap-2 text-[12px] text-zinc-400 border-b border-white/5 pb-2">
                <div className="flex items-center gap-4 overflow-x-auto">
                    <span>Time</span>
                    {TIMEFRAMES.map((tf) => (
                        <button key={tf.key} onClick={() => setTimeframe(tf.key)} className={`whitespace-nowrap font-semibold ${timeframe === tf.key ? "text-white" : "text-zinc-500"}`}>{tf.label}{tf.key === "1w" && timeframe === "1w" ? "⌄" : ""}</button>
                    ))}
                </div>
                <div className="flex items-center gap-4 text-zinc-100 shrink-0">
                    <Maximize2 className="w-4 h-4" />
                    <SlidersHorizontal className="w-4 h-4" />
                    <BarChart3 className="w-4 h-4" />
                </div>
            </div>

            <div className="mt-0 h-[calc(100vh-316px)] min-h-[350px] max-h-[540px] border-y border-white/5">
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

            <div className="px-3 pt-3">
                <div className="mt-3 grid grid-cols-[auto_auto_auto_1fr_1fr] gap-2.5 items-center pb-4">
                    <button className="text-center text-zinc-100"><span className="mx-auto mb-1 w-7 h-7 rounded-full border border-white/50 flex items-center justify-center">•••</span><span className="text-[11px]">More</span></button>
                    <button className="text-center text-zinc-100"><span className="mx-auto mb-1 w-7 h-7 grid grid-cols-2 gap-1 p-1"><i className="border border-white rounded-sm" /><i className="border border-white rounded-sm rotate-45" /><i className="border border-white rounded-sm rotate-45" /><i className="border border-white rounded-sm" /></span><span className="text-[11px]">Hub</span></button>
                    <button className="text-center text-zinc-100"><span className="mx-auto mb-1 w-7 h-7 flex items-center justify-center text-2xl">↗</span><span className="text-[11px]">Margin</span></button>
                    <button onClick={() => { setSide("buy"); setTradeMode("spot"); onBack(); }} className="h-10 rounded-lg bg-emerald-500 text-white text-[15px] font-bold">Buy</button>
                    <button onClick={() => { setSide("sell"); setTradeMode("spot"); onBack(); }} className="h-10 rounded-lg bg-rose-500 text-white text-[15px] font-bold">Sell</button>
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
        <div className="xl:hidden -mx-3 sm:mx-0 bg-[#1f2732] min-h-[calc(100vh-72px)] pb-20 text-zinc-100 text-[12px]">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 text-[11px] text-zinc-200">
                <span className="text-[#f0b90b] text-base">♛</span>
                <span className="truncate">Hot Campaign: Eregon exchange mode is live with protected internal wallet trades</span>
                <span className="text-zinc-300 text-base">×</span>
            </div>

            <div className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div>
                        <button className="flex items-center gap-1 text-[19px] leading-none font-bold tracking-tight text-white">
                            {pairInfo.pair}<ChevronDown className="w-5 h-5" />
                        </button>
                        <p className={`mt-1 text-[12px] font-semibold ${up ? "text-emerald-400" : "text-rose-400"}`}>{pct(pairInfo.baseMarket?.price_change_percentage_24h)}</p>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-200">
                        <button onClick={onOpenChart} className="relative w-7 h-7 flex items-center justify-center"><BarChart3 className="w-5 h-5" /></button>
                        <button className="relative w-7 h-7 flex items-center justify-center"><span className="absolute -top-1 right-0 w-3 h-3 rounded-full bg-[#f0b90b]" /><span className="text-2xl leading-none tracking-[1px]">…</span></button>
                    </div>
                </div>

                <div className="grid grid-cols-[minmax(0,1.08fr)_minmax(104px,0.92fr)] gap-2.5">
                    <div className="min-w-0 space-y-2">
                        <div className="grid grid-cols-2 rounded-lg border border-white/10 bg-[#2a3441] p-0.5">
                            <button onClick={() => { setTradeMode("spot"); setSide("buy"); }} className={`h-8 rounded-md text-[15px] font-bold ${tradeMode === "spot" && side === "buy" ? "bg-emerald-500 text-white" : "text-zinc-400"}`}>Buy</button>
                            <button onClick={() => { setTradeMode("spot"); setSide("sell"); }} className={`h-8 rounded-md text-[15px] font-bold ${tradeMode === "spot" && side === "sell" ? "bg-rose-500 text-white" : "text-zinc-400"}`}>Sell</button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={() => setTradeMode("spot")} className={`h-8 rounded-lg text-[12px] font-bold ${tradeMode === "spot" ? "bg-[#2a3441] text-white" : "bg-[#151c26] text-zinc-500"}`}>Market</button>
                            <button onClick={() => setTradeMode("options")} className={`h-8 rounded-lg text-[12px] font-bold ${tradeMode === "options" ? "bg-purple-500/25 text-purple-100" : "bg-[#151c26] text-zinc-500"}`}>Trade-X</button>
                        </div>

                        <select className="w-full h-9 rounded-lg border-0 bg-[#2a3441] px-2.5 text-[12px] font-semibold text-white outline-none" value={pairInfo.pair} onChange={(event) => setSelectedPair(event.target.value)}>
                            {orderPairs.map((pair) => <option key={pair.pair}>{pair.pair}</option>)}
                        </select>

                        {tradeMode === "spot" ? (
                            <>
                                <div className="grid grid-cols-[1fr_auto] items-center h-10 rounded-lg bg-[#2a3441] overflow-hidden">
                                    <input className="h-full min-w-0 bg-transparent px-2 text-[12px] text-white outline-none placeholder:text-zinc-500" value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0" step="any" placeholder={side === "buy" ? "Total" : "Amount"} />
                                    <span className="px-2 text-[12px] font-bold text-white border-l border-white/5">{side === "buy" ? pairInfo.quote : pairInfo.base}<ChevronDown className="w-4 h-4 inline ml-1 text-zinc-400" /></span>
                                </div>
                                <div className="relative pt-1.5 pb-2.5">
                                    <div className="absolute left-0 right-0 top-[13px] h-0.5 bg-zinc-600/50" />
                                    <div className="relative flex items-center justify-between">
                                        {[0, 25, 50, 75, 100].map((item) => (
                                            <button key={item} onClick={() => setPresetAmount(item)} className={`relative w-3.5 h-3.5 rotate-45 border-2 ${percent === item ? "border-white bg-[#2a3441]" : "border-zinc-600 bg-[#1f2732]"}`} aria-label={`${item}%`} />
                                        ))}
                                    </div>
                                    <span className="absolute -top-1.5 left-0 -translate-x-1 rounded-md bg-zinc-300 px-1.5 py-0 text-[9px] font-semibold text-zinc-800">{percent}%</span>
                                </div>
                                <label className="flex items-center gap-2 text-[12px] text-white"><span className="w-4 h-4 rounded border-2 border-zinc-500" />Slippage Tolerance</label>
                                <div className="space-y-0.5 text-[12px]">
                                    <div className="flex justify-between"><span className="text-zinc-400">Avbl</span><span>{formatAmount(available)} {side === "buy" ? pairInfo.quote : pairInfo.base} <button className="ml-1 w-5 h-5 rounded-full bg-[#f0b90b] text-black font-bold">+</button></span></div>
                                    <div className="flex justify-between"><span className="text-zinc-400">Max {side === "buy" ? "Buy" : "Sell"}</span><span>{side === "buy" ? formatAmount(Number(amount || 0) / Math.max(pairInfo.rate, 0.00000001)) : formatAmount(Number(amount || 0) * pairInfo.rate)} {side === "buy" ? pairInfo.base : pairInfo.quote}</span></div>
                                    <div className="flex justify-between"><span className="text-zinc-400">Est. Fee</span><span>{(Number(portfolio?.fee_rate || 0.001) * 100).toFixed(2)}%</span></div>
                                </div>
                                <button disabled={submitting} onClick={submit} className={`w-full h-10 rounded-lg text-[15px] font-bold text-white ${side === "buy" ? "bg-emerald-500" : "bg-rose-500"}`}>{submitting ? "Processing..." : `${side === "buy" ? "Buy" : "Sell"} ${pairInfo.base}`}</button>
                            </>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button onClick={() => setOptionDirection("up")} className={`h-9 rounded-lg text-[12px] font-bold ${optionDirection === "up" ? "bg-emerald-500 text-white" : "bg-[#2a3441] text-zinc-400"}`}>↗ Up</button>
                                    <button onClick={() => setOptionDirection("down")} className={`h-9 rounded-lg text-[12px] font-bold ${optionDirection === "down" ? "bg-rose-500 text-white" : "bg-[#2a3441] text-zinc-400"}`}>↘ Down</button>
                                </div>
                                <input className="w-full h-10 rounded-lg border-0 bg-[#2a3441] px-2.5 text-[13px] text-white outline-none placeholder:text-zinc-500" value={optionStake} onChange={(event) => setOptionStake(event.target.value)} type="number" min="0" step="any" placeholder="Stake USDT" />
                                <select className="w-full h-9 rounded-lg border-0 bg-[#2a3441] px-2.5 text-[12px] text-white outline-none" value={optionDuration} onChange={(event) => setOptionDuration(Number(event.target.value))}>{optionMeta.durations.map((duration) => <option key={duration} value={duration}>{duration < 60 ? `${duration}s` : `${duration / 60}m`}</option>)}</select>
                                <div className="space-y-0.5 text-[12px]">
                                    <div className="flex justify-between"><span className="text-zinc-400">Avbl</span><span>{formatAmount(quoteBalance)} USDT</span></div>
                                    <div className="flex justify-between"><span className="text-zinc-400">Win payout</span><span>{formatUsd(Number(optionStake || 0) * (1 + Number(optionMeta.payout_rate || 0.8)))}</span></div>
                                </div>
                                <button disabled={submitting} onClick={submitOption} className={`w-full h-10 rounded-lg text-[13px] font-bold text-white ${optionDirection === "up" ? "bg-emerald-500" : "bg-rose-500"}`}>{submitting ? "Opening..." : `Open ${optionDirection.toUpperCase()} Contract`}</button>
                            </>
                        )}
                    </div>

                    <OrderBookRows price={pairInfo.rate} compactMode />
                </div>

                <div className="mt-3 border-t border-white/5 pt-2.5">
                    <div className="flex items-center gap-4 text-[14px] font-bold overflow-x-auto">
                        <button className="relative pb-3 text-white whitespace-nowrap">Open Orders ({orders?.filter((item) => item.status === "open").length || 0})<span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-1 w-8 rounded-full bg-[#f0b90b]" /></button>
                        <button className="pb-3 text-zinc-500 whitespace-nowrap">Holdings ({portfolio?.positions?.length || 0})</button>
                        <button className="pb-3 text-zinc-500 whitespace-nowrap">Bots</button>
                    </div>
                    <div className="py-5 text-center text-zinc-100">
                        <div className="mx-auto mb-2 w-10 h-10 rounded-full border-2 border-white/70 flex items-center justify-center text-2xl">◇</div>
                        <p className="text-[13px] font-semibold">Available Funds: {formatAmount(quoteBalance)} {pairInfo.quote}</p>
                    </div>
                </div>

                <button onClick={onOpenChart} className="w-full h-10 rounded-lg border border-white/10 bg-[#202936] px-3 flex items-center justify-between text-left text-[13px] font-semibold">
                    <span>{pairInfo.pair} Chart</span>
                    <ChevronDown className="w-5 h-5 rotate-180 text-zinc-400" />
                </button>

                {(options || []).length > 0 && (
                    <div className="mt-3 rounded-xl border border-white/5 bg-[#151c26] p-3">
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
    const [optionMeta, setOptionMeta] = useState({ payout_rate: 0.8, durations: [300, 600, 900, 1800] });
    const [selectedPair, setSelectedPair] = useState(queryPair);
    const [side, setSide] = useState("buy");
    const [amount, setAmount] = useState("");
    const [tradeMode, setTradeMode] = useState("options");
    const [optionDirection, setOptionDirection] = useState("up");
    const [optionStake, setOptionStake] = useState("");
    const [optionDuration, setOptionDuration] = useState(300);
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
                    durations: optionsResult.value.data.durations || [300, 600, 900, 1800],
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
                <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 mb-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.28em] text-amber-400/80">Eregon Exchange</p>
                        <h1 className="text-3xl font-display font-semibold mt-1">Spot Trading</h1>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Badge color={marketPayload?.source === "coingecko" ? "emerald" : "gold"}>{marketPayload?.provider || DEFAULT_MARKET_SOURCE}</Badge>
                        <Badge color="purple">Fee {(Number(portfolio?.fee_rate || 0.001) * 100).toFixed(2)}%</Badge>
                        <button className="btn-ghost px-4 py-2 text-sm" onClick={() => load(true)}><RefreshCcw className="w-4 h-4" /> Refresh</button>
                        <RealtimeStatus />
                        <NotificationBell />
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
                            <div className="grid grid-cols-2 gap-1.5 mb-4">
                                <button onClick={() => setTradeMode("spot")} className={`rounded-xl py-3 font-semibold border ${tradeMode === "spot" ? "bg-amber-500/15 text-amber-200 border-amber-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Spot</button>
                                <button onClick={() => setTradeMode("options")} className={`rounded-xl py-3 font-semibold border ${tradeMode === "options" ? "bg-purple-500/15 text-purple-200 border-purple-400/30" : "bg-white/5 border-white/10 text-zinc-400"}`}>Trade-X</button>
                            </div>
                            <label className="text-xs uppercase tracking-widest text-zinc-500">Pair</label>
                            <select className="input-eregon mt-2 mb-4" value={pairInfo.pair} onChange={(event) => setSelectedPair(event.target.value)}>{orderPairs.map((pair) => <option key={pair.pair}>{pair.pair}</option>)}</select>

                            {tradeMode === "spot" ? (
                                <>
                                    <div className="grid grid-cols-2 gap-1.5 mb-4">
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
                                    <div className="grid grid-cols-2 gap-1.5 mb-4">
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
                                    <div className="grid grid-cols-2 gap-1.5 text-xs mt-3"><span className="text-zinc-500">Filled</span><span className="text-right">{formatAmount(order.executed_base)} {order.base_symbol}</span><span className="text-zinc-500">Rate</span><span className="text-right">{formatPrice(order.rate)}</span></div>
                                </div>)}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
