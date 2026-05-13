import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Crown, Menu, X, LogOut, LayoutDashboard, ShieldCheck } from "lucide-react";
import { useAuth } from "../lib/auth";

const links = [
    { to: "/", label: "Home" },
    { to: "/plans", label: "Plans" },
    { to: "/about", label: "About" },
    { to: "/support", label: "Support" },
];

export default function PublicNav() {
    const { user, logout } = useAuth();
    const [open, setOpen] = React.useState(false);
    const loc = useLocation();
    React.useEffect(() => { setOpen(false); }, [loc.pathname]);

    return (
        <header className="sticky top-0 z-50" data-testid="public-nav">
            <div className="absolute inset-0 backdrop-blur-xl bg-black/60 border-b border-white/5"></div>
            <div className="relative max-w-7xl mx-auto px-6 lg:px-12 py-4 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
                    <span className="w-9 h-9 rounded-xl gradient-purple flex items-center justify-center neon-purple">
                        <Crown className="w-5 h-5 text-white" strokeWidth={1.6} />
                    </span>
                    <span className="font-display text-lg font-semibold">
                        Oregon<span className="gradient-text-gold">Tasks</span>
                    </span>
                </Link>

                <nav className="hidden md:flex items-center gap-1">
                    {links.map((l) => (
                        <NavLink key={l.to} to={l.to} end
                            data-testid={`nav-link-${l.label.toLowerCase()}`}
                            className={({ isActive }) =>
                                `px-4 py-2 rounded-lg text-sm transition-all ${isActive ? "text-white bg-white/5" : "text-zinc-400 hover:text-white hover:bg-white/5"}`
                            }>
                            {l.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="hidden md:flex items-center gap-2">
                    {user ? (
                        <>
                            <Link to={user.role === "admin" ? "/admin" : "/dashboard"} className="btn-ghost text-sm py-2 px-4" data-testid="nav-dashboard-btn">
                                {user.role === "admin" ? <ShieldCheck className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                                {user.role === "admin" ? "Admin" : "Dashboard"}
                            </Link>
                            <button onClick={logout} className="btn-ghost text-sm py-2 px-4" data-testid="nav-logout-btn">
                                <LogOut className="w-4 h-4" /> Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="btn-ghost text-sm py-2 px-4" data-testid="nav-login-btn">Login</Link>
                            <Link to="/register" className="btn-royal text-sm py-2 px-4" data-testid="nav-register-btn">Get Started</Link>
                        </>
                    )}
                </div>

                <button onClick={() => setOpen(!open)} className="md:hidden text-white p-2" data-testid="nav-mobile-toggle">
                    {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {open && (
                <div className="md:hidden relative bg-black/90 backdrop-blur-xl border-b border-white/5">
                    <div className="px-6 py-4 flex flex-col gap-2">
                        {links.map((l) => (
                            <NavLink key={l.to} to={l.to} end className="px-4 py-2 rounded-lg text-zinc-300 hover:bg-white/5">
                                {l.label}
                            </NavLink>
                        ))}
                        {user ? (
                            <>
                                <Link to={user.role === "admin" ? "/admin" : "/dashboard"} className="btn-ghost text-sm">Open Dashboard</Link>
                                <button onClick={logout} className="btn-ghost text-sm">Logout</button>
                            </>
                        ) : (
                            <>
                                <Link to="/login" className="btn-ghost text-sm">Login</Link>
                                <Link to="/register" className="btn-royal text-sm">Get Started</Link>
                            </>
                        )}
                    </div>
                </div>
            )}
        </header>
    );
}
