// In dev the Vite proxy handles /api → localhost:4000, so base is empty.
// In production set VITE_API_BASE_URL to the Railway server URL.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
async function apiFetch(path, options) {
    return fetch(`${API_BASE}${path}`, { credentials: "include", ...options });
}
function json(body) {
    return {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    };
}
export const api = {
    jira: {
        oauthStart: (projectId) => apiFetch(`/api/projects/${projectId}/jira/oauth/start`),
        disconnect: (projectId) => apiFetch(`/api/projects/${projectId}/jira/disconnect`, { method: "DELETE" }),
        syncStatus: (projectId) => apiFetch(`/api/projects/${projectId}/jira/sync/status`),
        syncConflicts: (projectId) => apiFetch(`/api/projects/${projectId}/jira/sync/conflicts`),
        syncedFeatures: (projectId) => apiFetch(`/api/projects/${projectId}/jira/sync/features`),
        resetMappings: (projectId) => apiFetch(`/api/projects/${projectId}/jira/sync/mappings`, { method: "DELETE" }),
        validateConnection: (projectId) => apiFetch(`/api/projects/${projectId}/jira/sync/validate`, { method: "POST" }),
        resolveConflict: (projectId, mappingId, winner) => apiFetch(`/api/projects/${projectId}/jira/sync/resolve`, {
            method: "POST",
            ...json({ mapping_id: mappingId, winner }),
        }),
        config: (projectId) => apiFetch(`/api/projects/${projectId}/jira/config`),
        updateConfig: (projectId, body) => apiFetch(`/api/projects/${projectId}/jira/config`, { method: "PATCH", ...json(body) }),
        importProject: (projectId, jiraProjectKey) => apiFetch(`/api/projects/${projectId}/jira/import/project`, {
            method: "POST",
            ...json({ jira_project_key: jiraProjectKey }),
        }),
        exportEstimates: (projectId, featureIds) => apiFetch(`/api/projects/${projectId}/jira/export/estimates`, {
            method: "POST",
            ...json(featureIds ? { feature_ids: featureIds } : {}),
        }),
        listProjects: (projectId) => apiFetch(`/api/projects/${projectId}/jira/projects`),
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
        create: (name) => apiFetch("/api/projects", { method: "POST", ...json({ name }) }),
        update: (apiId, data) => apiFetch(`/api/projects/${apiId}`, { method: "PUT", ...json(data) }),
        delete: (apiId) => apiFetch(`/api/projects/${apiId}`, { method: "DELETE" }),
        checkout: (apiId) => apiFetch(`/api/projects/${apiId}/checkout`, { method: "POST" }),
        checkin: (apiId) => apiFetch(`/api/projects/${apiId}/checkin`, { method: "POST" }),
    },
};
