import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../../lib/api.js";
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthGate({ children, onAuthed }) {
    const [status, setStatus] = useState("loading");
    const [user, setUser] = useState(null);
    const [devMode, setDevMode] = useState(false);
    useEffect(() => {
        checkAuth();
    }, []);
    async function checkAuth() {
        try {
            const res = await api.auth.me();
            if (res.ok) {
                const u = await res.json();
                setUser(u);
                setStatus("authed");
                onAuthed?.(u);
            }
            else {
                const cfgRes = await api.auth.config();
                if (cfgRes.ok) {
                    const cfg = await cfgRes.json();
                    setDevMode(cfg.devLoginAvailable === true);
                }
                setStatus("unauthed");
            }
        }
        catch {
            setStatus("unauthed");
        }
    }
    async function handleDevLogin() {
        try {
            const res = await api.auth.devLogin();
            if (res.ok)
                checkAuth();
        }
        catch {
            // server not running — skip for now
        }
    }
    if (status === "loading") {
        return (_jsx("div", { className: "flex items-center justify-center w-full h-full bg-[#080612]", children: _jsx("div", { className: "text-[#5c5575] text-sm tracking-widest", children: "Loading\u2026" }) }));
    }
    if (status === "unauthed") {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center w-full h-full gap-8", style: { background: "#080612" }, children: [_jsxs("div", { className: "flex flex-col items-center gap-2", children: [_jsx("h1", { className: "text-6xl font-black tracking-[0.25em] text-white uppercase", style: { textShadow: "0 0 60px rgba(139,92,246,0.6)" }, children: "VIGO" }), _jsx("p", { className: "text-sm tracking-[0.15em] uppercase text-[#9b93ba]", children: "Project Estimation Suite" })] }), _jsxs("div", { className: "flex flex-col gap-3 items-center", children: [devMode ? (_jsx("button", { onClick: handleDevLogin, className: "px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all", style: {
                                background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                                boxShadow: "0 0 24px rgba(124,58,237,0.4)",
                            }, children: "Continue (dev mode)" })) : (_jsx("a", { href: api.auth.googleLoginUrl, className: "px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all", style: {
                                background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                                boxShadow: "0 0 24px rgba(124,58,237,0.4)",
                            }, children: "Sign in with Google" })), _jsx("p", { className: "text-xs text-[#3a3456]", children: "Soul Assembly accounts only" })] })] }));
    }
    return (_jsx(AuthContext.Provider, { value: user, children: children }));
}
