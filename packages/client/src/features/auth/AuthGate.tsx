import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../../lib/api.js";

export interface AuthUser {
  email: string;
  name?: string;
}

const AuthContext = createContext<AuthUser | null>(null);
export const useAuth = () => useContext(AuthContext);

type Status = "loading" | "authed" | "unauthed";

interface Props {
  children: React.ReactNode;
  onAuthed?: (user: AuthUser) => void;
}

export function AuthGate({ children, onAuthed }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const res = await api.auth.me();
      if (res.ok) {
        const u: AuthUser = await res.json();
        setUser(u);
        setStatus("authed");
        onAuthed?.(u);
      } else {
        const cfgRes = await api.auth.config();
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          setDevMode(cfg.devLoginAvailable === true);
        }
        setStatus("unauthed");
      }
    } catch {
      setStatus("unauthed");
    }
  }

  async function handleDevLogin() {
    try {
      const res = await api.auth.devLogin();
      if (res.ok) checkAuth();
    } catch {
      // server not running — skip for now
    }
  }

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center w-full h-full bg-[#080612]">
        <div className="text-[#5c5575] text-sm tracking-widest">Loading…</div>
      </div>
    );
  }

  if (status === "unauthed") {
    return (
      <div
        className="flex flex-col items-center justify-center w-full h-full gap-8"
        style={{ background: "#080612" }}
      >
        <div className="flex flex-col items-center gap-2">
          <h1
            className="text-6xl font-black tracking-[0.25em] text-white uppercase"
            style={{ textShadow: "0 0 60px rgba(139,92,246,0.6)" }}
          >
            VIGO
          </h1>
          <p className="text-sm tracking-[0.15em] uppercase text-[#9b93ba]">
            Project Estimation Suite
          </p>
        </div>

        <div className="flex flex-col gap-3 items-center">
          {devMode ? (
            <button
              onClick={handleDevLogin}
              className="px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                boxShadow: "0 0 24px rgba(124,58,237,0.4)",
              }}
            >
              Continue (dev mode)
            </button>
          ) : (
            <a
              href={api.auth.googleLoginUrl}
              className="px-10 py-3.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
                boxShadow: "0 0 24px rgba(124,58,237,0.4)",
              }}
            >
              Sign in with Google
            </a>
          )}
          <p className="text-xs text-[#3a3456]">Soul Assembly accounts only</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
  );
}
