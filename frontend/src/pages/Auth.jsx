import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, User, ArrowRight, TicketCheck, Crown } from "lucide-react";
import { useAuth } from "../lib/auth";
import { formatApiError, api } from "../lib/api";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const nav = useNavigate();

    const submit = async (e) => {
        e.preventDefault();
        setErr(""); setLoading(true);
        try {
            const u = await login(email, password);
            nav(u.role === "admin" ? "/admin" : "/dashboard");
        } catch (e) {
            setErr(formatApiError(e));
        } finally { setLoading(false); }
    };

    return (
        <AuthFrame title="Welcome back" subtitle="Sign in to your Eregon wallet">
            <form onSubmit={submit} className="space-y-4" data-testid="login-form">
                <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} testId="login-email" />
                <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} testId="login-password" />
                {err && <p className="text-sm text-rose-400" data-testid="login-error">{err}</p>}
                <button type="submit" disabled={loading} className="btn-eregon w-full" data-testid="login-submit">
                    {loading ? "Signing in..." : "Enter Eregon Wallet"} <ArrowRight className="w-4 h-4" />
                </button>
                <div className="flex justify-between text-xs text-zinc-500 pt-2">
                    <Link to="/forgot" className="hover:text-white">Forgot password?</Link>
                    <Link to="/register" className="hover:text-white">Create account</Link>
                </div>
            </form>
        </AuthFrame>
    );
}

export function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [registrationCode, setRegistrationCode] = useState("");
    const [err, setErr] = useState("");
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const nav = useNavigate();

    const submit = async (e) => {
        e.preventDefault();
        setErr(""); setLoading(true);
        try {
            await register({
                name,
                email,
                password,
                registration_code: registrationCode.trim().toUpperCase(),
            });
            nav("/dashboard");
        } catch (e) { setErr(formatApiError(e)); }
        finally { setLoading(false); }
    };

    return (
        <AuthFrame title="Create your account" subtitle="Open your Eregon account in seconds">
            <form onSubmit={submit} className="space-y-4" data-testid="register-form">
                <Field icon={User} placeholder="Full name" value={name} onChange={setName} testId="register-name" />
                <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} testId="register-email" />
                <Field icon={Lock} type="password" placeholder="Password (min 6 chars)" value={password} onChange={setPassword} testId="register-password" />
                <Field icon={TicketCheck} placeholder="Registration code (required)" value={registrationCode} onChange={(v) => setRegistrationCode(v.toUpperCase())} testId="register-code" />
                <p className="-mt-2 text-[11px] text-amber-300/80">Ask admin for your unique Eregon registration code. Your first-task reward is linked to this code.</p>
                {err && <p className="text-sm text-rose-400" data-testid="register-error">{err}</p>}
                <button type="submit" disabled={loading} className="btn-gold w-full" data-testid="register-submit">
                    {loading ? "Creating..." : "Open Eregon Account"} <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-xs text-zinc-500 pt-2 text-center">
                    Already a member? <Link to="/login" className="text-amber-300 hover:underline">Sign in</Link>
                </p>
            </form>
        </AuthFrame>
    );
}

export function Forgot() {
    const [email, setEmail] = useState("");
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");
    const submit = async (e) => {
        e.preventDefault();
        setErr(""); setMsg("");
        try {
            const { data } = await api.post("/auth/forgot-password", { email });
            setMsg(data.debug_token ? `Reset token (dev): ${data.debug_token}` : data.message);
        } catch (e) { setErr(formatApiError(e)); }
    };
    return (
        <AuthFrame title="Need a reset?" subtitle="We&rsquo;ll send a reset token to the Eregon support desk.">
            <form onSubmit={submit} className="space-y-4" data-testid="forgot-form">
                <Field icon={Mail} type="email" placeholder="Email" value={email} onChange={setEmail} testId="forgot-email" />
                {err && <p className="text-sm text-rose-400">{err}</p>}
                {msg && <p className="text-sm text-emerald-300 break-all" data-testid="forgot-message">{msg}</p>}
                <button className="btn-eregon w-full" type="submit" data-testid="forgot-submit">Send Reset Token</button>
                <p className="text-xs text-zinc-500 pt-2 text-center">
                    <Link to="/login" className="hover:text-white">Back to login</Link>
                </p>
            </form>
        </AuthFrame>
    );
}

function Field({ icon: Icon, type = "text", placeholder, value, onChange, testId }) {
    return (
        <div className="relative">
            <Icon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input data-testid={testId} type={type} className="input-eregon pl-10" placeholder={placeholder}
                value={value} onChange={(e) => onChange(e.target.value)} required />
        </div>
    );
}

function AuthFrame({ title, subtitle, children }) {
    return (
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center px-6 py-12 relative overflow-hidden">
            <div className="absolute inset-0 eregon-grid opacity-30"></div>
            <div className="absolute inset-0 eregon-radial"></div>
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl"></div>

            <div className="relative w-full max-w-md">
                <Link to="/" className="flex items-center gap-2 justify-center mb-6">
                    <span className="w-10 h-10 rounded-xl gradient-purple flex items-center justify-center neon-purple">
                        <Crown className="w-5 h-5 text-white" strokeWidth={1.6} />
                    </span>
                    <span className="font-display text-xl font-semibold">Eregon<span className="gradient-text-gold">Marketing</span></span>
                </Link>
                <div className="glass-strong p-4 sm:p-6 lg:p-8 relative">
                    <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent"></div>
                    <h1 className="font-display text-2xl font-semibold">{title}</h1>
                    <p className="text-sm text-zinc-400 mb-6">{subtitle}</p>
                    {children}
                </div>
            </div>
        </div>
    );
}
