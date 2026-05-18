import { create } from "zustand";
import { api } from "../../../lib/api.js";

export interface JiraConfig {
  id: string;
  jira_instance_url: string;
  jira_cloud_id: string;
  jira_project_key: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PendingConflict {
  mapping_id: string;
  jira_issue_key: string;
  estimator_label: string;
  jira_summary: string;
  field: string;
  estimator_value: string;
  jira_value: string;
}

export interface SyncState {
  is_connected: boolean;
  last_synced_at?: string;
  last_synced_by?: string;
  pending_conflicts: PendingConflict[];
}

export interface ImportResult {
  features_created: number;
  features_updated: number;
  tasks_created: number;
  tasks_updated: number;
  skipped: number;
  errors: string[];
}

export interface ExportResult {
  feature_id: string;
  jira_issue_key: string;
  action: string;
  error?: string;
}

interface JiraStore {
  syncState: SyncState | null;
  config: JiraConfig | null;
  loading: boolean;
  error: string | null;
  fetchSyncState: (projectId: string) => Promise<void>;
  fetchConfig: (projectId: string) => Promise<void>;
  clear: () => void;
}

export const useJiraStore = create<JiraStore>((set) => ({
  syncState: null,
  config: null,
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

  clear: () => set({ syncState: null, config: null, error: null }),
}));
