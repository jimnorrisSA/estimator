import { create } from "zustand";
import { api } from "../../../lib/api.js";
export const useJiraStore = create((set) => ({
    syncState: null,
    config: null,
    syncedFeatures: {},
    loading: false,
    error: null,
    fetchSyncState: async (projectId) => {
        set({ loading: true, error: null });
        try {
            const res = await api.jira.syncStatus(projectId);
            if (!res.ok)
                throw new Error(await res.text());
            const data = (await res.json());
            set({ syncState: data, loading: false });
        }
        catch (e) {
            set({ loading: false, error: String(e) });
        }
    },
    fetchConfig: async (projectId) => {
        try {
            const res = await api.jira.config(projectId);
            if (!res.ok)
                return;
            const data = (await res.json());
            set({ config: data });
        }
        catch {
            // not connected — ignore
        }
    },
    fetchSyncedFeatures: async (projectId) => {
        try {
            const res = await api.jira.syncedFeatures(projectId);
            if (!res.ok)
                return;
            const data = (await res.json());
            const map = {};
            for (const d of data)
                map[d.estimatorId] = d.jiraKey;
            set({ syncedFeatures: map });
        }
        catch {
            // ignore
        }
    },
    markFeaturesSynced: (results) => {
        set((s) => {
            const next = { ...s.syncedFeatures };
            for (const r of results) {
                if (r.jiraKey && (r.status === "created" || r.status === "updated")) {
                    next[r.estimatorId] = r.jiraKey;
                }
            }
            return { syncedFeatures: next };
        });
    },
    clear: () => set({ syncState: null, config: null, syncedFeatures: {}, error: null }),
}));
