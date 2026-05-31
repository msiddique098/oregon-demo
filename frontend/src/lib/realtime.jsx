import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "./auth";

const RealtimeCtx = createContext({ connected: false, lastEvent: null });

function wsUrl() {
    const base = process.env.REACT_APP_BACKEND_URL || window.location.origin;
    return base.replace(/^http/i, "ws") + "/api/ws";
}

export function RealtimeProvider({ children }) {
    const { user, setUser, refresh } = useAuth();
    const [connected, setConnected] = useState(false);
    const [lastEvent, setLastEvent] = useState(null);
    const reconnectRef = useRef(null);
    const wsRef = useRef(null);

    useEffect(() => {
        const token = localStorage.getItem("eregon_token");
        if (!token || !user) return undefined;

        let closed = false;
        const connect = () => {
            const socket = new WebSocket(`${wsUrl()}?token=${encodeURIComponent(token)}`);
            wsRef.current = socket;

            socket.onopen = () => setConnected(true);
            socket.onclose = () => {
                setConnected(false);
                if (!closed) reconnectRef.current = setTimeout(connect, 2500);
            };
            socket.onerror = () => setConnected(false);
            socket.onmessage = (message) => {
                try {
                    const data = JSON.parse(message.data);
                    setLastEvent(data);
                    const event = data.event;
                    const payload = data.payload || {};

                    if (event === "balance.updated") {
                        setUser((prev) => prev ? { ...prev, balance: payload.balance ?? prev.balance, bonus_balance: payload.bonus_balance ?? prev.bonus_balance } : prev);
                        toast.success(`Reward credited: +${payload.delta || 0} ${user.coin_symbol || "USDT"}`);
                    }
                    if (event === "notification.created") toast(payload.title || "New notification", { description: payload.body });
                    if (event === "deposit.updated") toast.success(`Deposit ${payload.status}`);
                    if (event === "withdrawal.updated") toast(`Withdrawal ${payload.status}`);
                    if (event === "task.completed") toast.success("Task reward unlocked", { description: `+${payload.reward} ${user.coin_symbol || "USDT"}` });
                    if (["user.updated", "reward.checkin", "reward.spin"].includes(event)) refresh?.();
                } catch (e) {
                    void e;
                }
            };
        };

        connect();
        return () => {
            closed = true;
            clearTimeout(reconnectRef.current);
            wsRef.current?.close();
        };
    }, [user?.id, setUser, refresh]);

    const value = useMemo(() => ({ connected, lastEvent }), [connected, lastEvent]);
    return <RealtimeCtx.Provider value={value}>{children}</RealtimeCtx.Provider>;
}

export const useRealtime = () => useContext(RealtimeCtx);
