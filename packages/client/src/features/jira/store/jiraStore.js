import { create } from "zustand";
import { api } from "../../../lib/api.js";
export const useJiraStore = create((set) => ({
    syncState: null,
    config: null,
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
    clear: () => set({ syncState: null, config: null, error: null }),
}));
