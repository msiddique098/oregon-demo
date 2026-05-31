import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
    baseURL: API,
    withCredentials: false,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem("eregon_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export function formatApiError(err) {
    const detail = err?.response?.data?.detail;
    if (!detail) return err?.message || "Something went wrong";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail))
        return detail
            .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
            .join(" ");
    if (typeof detail?.msg === "string") return detail.msg;
    if (typeof detail?.message === "string") {
        const failed = Array.isArray(detail.failed) && detail.failed.length
            ? " " + detail.failed.map((f) => f?.message || JSON.stringify(f)).join(" ")
            : "";
        return detail.message + failed;
    }
    try { return JSON.stringify(detail); } catch { return String(detail); }
}
