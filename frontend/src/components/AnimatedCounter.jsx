import React, { useEffect, useRef, useState } from "react";

/**
 * AnimatedCounter — Cinematic number reveal with easing.
 * Props: value (number), decimals (int), prefix, suffix, duration (ms), className
 */
export function AnimatedCounter({ value = 0, decimals = 0, prefix = "", suffix = "", duration = 1200, className = "" }) {
    const [display, setDisplay] = useState(0);
    const startRef = useRef(null);
    const fromRef = useRef(0);

    useEffect(() => {
        fromRef.current = display;
        startRef.current = performance.now();
        let raf;
        const tick = (t) => {
            const p = Math.min(1, (t - startRef.current) / duration);
            const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
            const next = fromRef.current + (value - fromRef.current) * eased;
            setDisplay(next);
            if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, duration]);

    const formatted = Number(display).toLocaleString(undefined, {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    });
    return <span className={className}>{prefix}{formatted}{suffix}</span>;
}

export default AnimatedCounter;
