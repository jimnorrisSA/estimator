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
  jira: {
    oauthStart: (projectId: string) =>
      apiFetch(`/api/projects/${projectId}/jira/oauth/start`),
    disconnect: (projectId: string) =>
      apiFetch(`/api/projects/${projectId}/jira/disconnect`, { method: "DELETE" }),
    syncStatus: (projectId: string) =>
      apiFetch(`/api/projects/${projectId}/jira/sync/status`),
    syncConflicts: (projectId: string) =>
      apiFetch(`/api/projects/${projectId}/jira/sync/conflicts`),
    validateConnection: (projectId: string) =>
      apiFetch(`/api/projects/${projectId}/jira/sync/validate`, { method: "POST" }),
    resolveConflict: (projectId: string, mappingId: string, winner: "estimator" | "jira") =>
      apiFetch(`/api/projects/${projectId}/jira/sync/resolve`, {
        method: "POST",
        ...json({ mapping_id: mappingId, winner }),
      }),
    config: (projectId: string) =>
      apiFetch(`/api/projects/${projectId}/jira/config`),
    updateConfig: (projectId: string, body: { jira_project_key?: string }) =>
      apiFetch(`/api/projects/${projectId}/jira/config`, { method: "PATCH", ...json(body) }),
    importProject: (projectId: string, jiraProjectKey: string) =>
      apiFetch(`/api/projects/${projectId}/jira/import/project`, {
        method: "POST",
        ...json({ jira_project_key: jiraProjectKey }),
      }),
    exportEstimates: (projectId: string, featureIds?: string[]) =>
      apiFetch(`/api/projects/${projectId}/jira/export/estimates`, {
        method: "POST",
        ...json(featureIds ? { feature_ids: featureIds } : {}),
      }),
  },
  auth: {
    me: () => apiFetch("/api/auth/me"),
    config: () => apiFetch("/api/auth/config"),
    devLogin: () => apiFetch("/api/auth/dev-login", { method: "POST" }),
    logout: () => apiFetch("/api/auth/logout", { method: "POST" }),
    googleLoginUrl: `${API_BASE}/api/auth/google`,
  },
  projects: {
    list: () => apiFetch("/api/projects"),
    listShared: () => apiFetch("/api/projects/shared"),
    create: (name: string) =>
      apiFetch("/api/projects", { method: "POST", ...json({ name }) }),
    update: (apiId: string, data: object) =>
      apiFetch(`/api/projects/${apiId}`, { method: "PUT", ...json(data) }),
    delete: (apiId: string) =>
      apiFetch(`/api/projects/${apiId}`, { method: "DELETE" }),
    checkout: (apiId: string) =>
      apiFetch(`/api/projects/${apiId}/checkout`, { method: "POST" }),
    checkin: (apiId: string) =>
      apiFetch(`/api/projects/${apiId}/checkin`, { method: "POST" }),
  },
};
