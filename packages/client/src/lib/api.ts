// In dev the Vite proxy handles /api → localhost:4000, so base is empty.
// In production set VITE_API_BASE_URL to the Railway server URL.
const API_BASE: string =
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_BASE_URL ?? "";

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: "include", ...options });
}

function json(body: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const api = {
  auth: {
    me: () => apiFetch("/api/auth/me"),
    config: () => apiFetch("/api/auth/config"),
    devLogin: () => apiFetch("/api/auth/dev-login", { method: "POST" }),
    logout: () => apiFetch("/api/auth/logout", { method: "POST" }),
    googleLoginUrl: "/api/auth/google",
  },
  projects: {
    list: () => apiFetch("/api/projects"),
    create: (name: string) =>
      apiFetch("/api/projects", { method: "POST", ...json({ name }) }),
    update: (apiId: string, data: object) =>
      apiFetch(`/api/projects/${apiId}`, { method: "PUT", ...json(data) }),
    delete: (apiId: string) =>
      apiFetch(`/api/projects/${apiId}`, { method: "DELETE" }),
  },
};
