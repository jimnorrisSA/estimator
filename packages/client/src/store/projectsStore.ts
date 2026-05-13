import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Feature } from "@estimator/shared";
import type { ScheduleSettings, TaskOverride } from "../features/phase2-scheduling/store/schedulingStore.js";
import type { Milestone } from "../features/phase3-milestones/store/milestonesStore.js";
import type { Resource } from "@estimator/shared";

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
    }),
    {
      name: "vigo-projects-v1",
    }
  )
);
