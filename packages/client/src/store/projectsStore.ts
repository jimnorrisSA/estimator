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
  apiId?: string;
  owner?: string;
  published?: boolean;
  checkedOutBy?: string;
  checkedOutAt?: string;
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
  defaultMonthlyRate: 6700,
  workingDaysPerMonth: 22,
  agencyFeePct: 10,
  agencyFeeLabel: "DDM",
  exchangeRates: { USD: 1.35, EUR: 1.17, AUD: 1.94 },
  revenueGBP: 0,
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
          const [myRes, sharedRes] = await Promise.all([
            api.projects.list(),
            api.projects.listShared(),
          ]);
          if (!myRes.ok) {
            console.warn("[sync] /api/projects returned", myRes.status);
            return;
          }

          type SP = {
            id: string; name: string; createdAt: string; updatedAt: string;
            owner?: string; published?: boolean;
            checkedOutBy?: string; checkedOutAt?: string;
            snapshot?: ProjectSnapshot;
          };

          const mine: SP[] = await myRes.json();
          const shared: SP[] = sharedRes.ok ? await sharedRes.json() : [];

          console.log("[sync] mine:", mine.length, "shared:", shared.length, "| shared status:", sharedRes.status);
          if (mine.length > 0) console.log("[sync] my projects:", mine.map(p => ({ name: p.name, owner: p.owner, published: p.published })));
          if (shared.length > 0) console.log("[sync] shared projects:", shared.map(p => ({ name: p.name, owner: p.owner, published: p.published })));

          const toEntry = (sp: SP): ProjectEntry => ({
            id: sp.id,
            apiId: sp.id,
            name: sp.name,
            createdAt: sp.createdAt,
            updatedAt: sp.updatedAt,
            owner: sp.owner,
            published: sp.published,
            checkedOutBy: sp.checkedOutBy,
            checkedOutAt: sp.checkedOutAt,
            snapshot: sp.snapshot ?? emptySnapshot(),
          });

          if (mine.length > 0 || shared.length > 0) {
            get().replaceFromServer([...mine.map(toEntry), ...shared.map(toEntry)]);
          } else {
            const local = get().projects;
            for (const p of local) {
              await get().pushToServer(p.id);
            }
          }
        } catch (e) {
          console.warn("[sync] error:", e);
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
