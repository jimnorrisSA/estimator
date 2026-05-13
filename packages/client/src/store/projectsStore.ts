import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Feature } from "@estimator/shared";
import type { ScheduleSettings, TaskOverride } from "../features/phase2-scheduling/store/schedulingStore.js";
import type { Milestone } from "../features/phase3-milestones/store/milestonesStore.js";
import type { Resource } from "@estimator/shared";
import { api } from "../lib/api.js";

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectSnapshot {
  features: Feature[];
  schedulingSettings: ScheduleSettings;
  overrides: Record<string, TaskOverride>;
  resources: Resource[];
  milestones: Milestone[];
}

interface ProjectEntry extends ProjectMeta {
  snapshot: ProjectSnapshot;
  apiId?: string; // MongoDB _id — present once synced to server
}

interface ProjectsStore {
  projects: ProjectEntry[];
  activeProjectId: string | null;

  createProject: (name: string, initialSnapshot?: ProjectSnapshot) => string;
  openProject: (id: string) => void;
  saveActiveSnapshot: (snapshot: ProjectSnapshot) => void;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  getActiveProject: () => ProjectEntry | null;

  // Server sync
  setApiId: (localId: string, apiId: string) => void;
  replaceFromServer: (serverProjects: ProjectEntry[]) => void;
  syncFromServer: () => Promise<void>;
  pushToServer: (localId: string) => Promise<void>;
}

const DEFAULT_SETTINGS: ScheduleSettings = {
  projectName: "New Project",
  startDate: "",
  targetEndDate: "",
  calendarMode: "four-week",
  contingencyPct: 15,
  currency: "GBP",
  defaultDailyRate: 0,
  exchangeRates: { USD: 1.27, EUR: 1.17, AUD: 1.94 },
};

export function emptySnapshot(): ProjectSnapshot {
  return {
    features: [],
    schedulingSettings: { ...DEFAULT_SETTINGS },
    overrides: {},
    resources: [],
    milestones: [],
  };
}

function readPersistedState<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed?.state ?? null) as T | null;
  } catch {
    return null;
  }
}

export function migrateFromLegacyStores(): ProjectSnapshot | null {
  const estimations = readPersistedState<{ features: Feature[] }>("estimator-phase1-v2");
  if (!estimations?.features?.length) return null;

  const scheduling = readPersistedState<{
    settings: ScheduleSettings;
    overrides: Record<string, TaskOverride>;
    resources: Resource[];
  }>("estimator-scheduling-v1");

  const milestones = readPersistedState<{ milestones: Milestone[] }>("vigo-milestones-v1");

  return {
    features: estimations.features,
    schedulingSettings: scheduling?.settings ?? { ...DEFAULT_SETTINGS },
    overrides: scheduling?.overrides ?? {},
    resources: scheduling?.resources ?? [],
    milestones: milestones?.milestones ?? [],
  };
}

export const useProjectsStore = create<ProjectsStore>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,

      createProject(name, initialSnapshot) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const entry: ProjectEntry = {
          id,
          name,
          createdAt: now,
          updatedAt: now,
          snapshot: initialSnapshot ?? emptySnapshot(),
        };
        set((s) => ({ projects: [...s.projects, entry], activeProjectId: id }));
        return id;
      },

      openProject(id) {
        set({ activeProjectId: id });
      },

      saveActiveSnapshot(snapshot) {
        const { activeProjectId } = get();
        if (!activeProjectId) return;
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === activeProjectId
              ? { ...p, snapshot, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      renameProject(id, name) {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      deleteProject(id) {
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        }));
      },

      getActiveProject() {
        const { projects, activeProjectId } = get();
        return projects.find((p) => p.id === activeProjectId) ?? null;
      },

      setApiId(localId, apiId) {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === localId ? { ...p, apiId } : p
          ),
        }));
      },

      replaceFromServer(serverProjects) {
        const { activeProjectId } = get();
        // Preserve active project selection if it still exists on server
        const newActive =
          serverProjects.find((p) => p.id === activeProjectId || p.apiId === activeProjectId)?.id ??
          serverProjects[0]?.id ??
          null;
        set({ projects: serverProjects, activeProjectId: newActive });
      },

      async syncFromServer() {
        try {
          const res = await api.projects.list();
          if (!res.ok) return;
          const serverProjects: Array<{
            id: string; name: string; createdAt: string; updatedAt: string;
            snapshot?: ProjectSnapshot;
          }> = await res.json();

          if (serverProjects.length > 0) {
            // Server has data — it's the source of truth
            const entries: ProjectEntry[] = serverProjects.map((sp) => ({
              id: sp.id,
              apiId: sp.id,
              name: sp.name,
              createdAt: sp.createdAt,
              updatedAt: sp.updatedAt,
              snapshot: sp.snapshot ?? emptySnapshot(),
            }));
            get().replaceFromServer(entries);
          } else {
            // Server is empty — push local projects up to seed it
            const local = get().projects;
            for (const p of local) {
              await get().pushToServer(p.id);
            }
          }
        } catch {
          // server unreachable — stay with local data
        }
      },

      async pushToServer(localId) {
        const project = get().projects.find((p) => p.id === localId);
        if (!project) return;
        try {
          if (project.apiId) {
            await api.projects.update(project.apiId, {
              name: project.name,
              snapshot: project.snapshot,
            });
          } else {
            const res = await api.projects.create(project.name);
            if (res.ok) {
              const sp: { id: string } = await res.json();
              get().setApiId(localId, sp.id);
              await api.projects.update(sp.id, { snapshot: project.snapshot });
            }
          }
        } catch {
          // offline — will sync later
        }
      },
    }),
    {
      name: "vigo-projects-v1",
    }
  )
);
