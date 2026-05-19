import { create } from "zustand";
import { api } from "../../../lib/api.js";

// Matches safeIntegration JSON from Go (camelCase)
export interface JiraConfig {
  id: string;
  projectId: string;
  jiraInstanceUrl: string;
  jiraCloudId: string;
  jiraProjectKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Matches SyncState JSON from Go (camelCase); pendingConflicts is a count, not an array
export interface SyncState {
  projectId: string;
  isConnected: boolean;
  lastSyncedAt: string;
  lastSyncedBy: string;
  pendingConflicts: number;
}

// Matches JiraMapping JSON from Go (camelCase)
export interface PendingConflict {
  id: string;
  projectId: string;
  estimatorType: string; // "feature" | "task"
  estimatorId: string;
  jiraIssueKey: string;
  jiraIssueType: string;
  direction: string;
  origin: string;
}

// Matches ProjectImportResult JSON from Go
export interface ImportResult {
  epicsImported: number;
  storiesCreated: number;
  mappingsAdded: number;
  errors: string[];
  durationMs: number;
}

// Matches ExportResult JSON from Go
export interface ExportResult {
  estimatorId: string;
  jiraKey: string;
  status: string;
  reason: string;
  errorMessage?: string;
}

interface JiraStore {
  syncState: SyncState | null;
  config: JiraConfig | null;
  syncedFeatures: Record<string, string>; // featureId → jiraKey
  loading: boolean;
  error: string | null;
  fetchSyncState: (projectId: string) => Promise<void>;
  fetchConfig: (projectId: string) => Promise<void>;
  fetchSyncedFeatures: (projectId: string) => Promise<void>;
  markFeaturesSynced: (results: ExportResult[]) => void;
  clear: () => void;
}

export const useJiraStore = create<JiraStore>((set) => ({
  syncState: null,
  config: null,
  syncedFeatures: {},
  loading: false,
  error: null,

  fetchSyncState: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const res = await api.jira.syncStatus(projectId);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as SyncState;
      set({ syncState: data, loading: false });
    } catch (e) {
      set({ loading: false, error: String(e) });
    }
  },

  fetchConfig: async (projectId: string) => {
    try {
      const res = await api.jira.config(projectId);
      if (!res.ok) return;
      const data = (await res.json()) as JiraConfig;
      set({ config: data });
    } catch {
      // not connected — ignore
    }
  },

  fetchSyncedFeatures: async (projectId: string) => {
    try {
      const res = await api.jira.syncedFeatures(projectId);
      if (!res.ok) return;
      const data = (await res.json()) as { estimatorId: string; jiraKey: string }[];
      const map: Record<string, string> = {};
      for (const d of data) map[d.estimatorId] = d.jiraKey;
      set({ syncedFeatures: map });
    } catch {
      // ignore
    }
  },

  markFeaturesSynced: (results: ExportResult[]) => {
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
