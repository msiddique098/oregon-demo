import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        const token = localStorage.getItem("eregon_token");
        if (!token) {
            setUser(null);
            setLoading(false);
            return;
        }
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
        } catch (err) {
            const status = err?.response?.status;
            if (status === 401 || status === 403) {
                localStorage.removeItem("eregon_token");
                setUser(null);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { refresh(); }, [refresh]);

    const login = async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        localStorage.setItem("eregon_token", data.access_token);
        setUser(data.user);
        return data.user;
    };

    const register = async (payload) => {
        const { data } = await api.post("/auth/register", payload);
        localStorage.setItem("eregon_token", data.access_token);
        setUser(data.user);
        return data.user;
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch (e) { void e; }
        localStorage.removeItem("eregon_token");
        setUser(null);
    };

    return (
        <AuthCtx.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
            {children}
        </AuthCtx.Provider>
    );
}

export const useAuth = () => useContext(AuthCtx);
