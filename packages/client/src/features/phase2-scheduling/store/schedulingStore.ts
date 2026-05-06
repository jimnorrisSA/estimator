import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Discipline, Resource } from "@estimator/shared";

export type CalendarMode = "four-week" | "actual";
export type Currency = "GBP" | "USD" | "EUR" | "AUD";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  AUD: "A$",
};

export interface ScheduleSettings {
  projectName: string;
  startDate: string; // YYYY-MM-DD
  calendarMode: CalendarMode;
  contingencyPct: number;
  currency: Currency;
}

export interface TaskOverride {
  startDay?: number;
  endDay?: number;
  notes: string;
}

interface SchedulingStore {
  settings: ScheduleSettings;
  overrides: Record<string, TaskOverride>;
  resources: Resource[];

  updateSettings: (patch: Partial<ScheduleSettings>) => void;
  setOverride: (taskId: string, patch: Partial<TaskOverride>) => void;
  clearOverride: (taskId: string) => void;

  addResource: (role: Discipline, name: string) => void;
  updateResource: (id: string, patch: Partial<Pick<Resource, "name" | "dailyRate" | "allocationPct">>) => void;
  deleteResource: (id: string) => void;
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const add = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

function makeResource(role: Discipline, name: string): Resource {
  return {
    id: crypto.randomUUID(),
    projectId: "local",
    name,
    role,
    rollOnDate: "",
    rollOffDate: "",
    allocationPct: 100,
    dailyRate: 0,
    currency: "GBP",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

export const useSchedulingStore = create<SchedulingStore>()(
  persist(
    (set) => ({
      settings: {
        projectName: "New Project",
        startDate: nextMonday(),
        calendarMode: "four-week",
        contingencyPct: 15,
        currency: "GBP",
      },
      overrides: {},
      resources: [],

      updateSettings(patch) {
        set((s) => ({ settings: { ...s.settings, ...patch } }));
      },

      setOverride(taskId, patch) {
        set((s) => ({
          overrides: {
            ...s.overrides,
            [taskId]: { ...{ notes: "" }, ...s.overrides[taskId], ...patch },
          },
        }));
      },

      clearOverride(taskId) {
        set((s) => {
          const next = { ...s.overrides };
          delete next[taskId];
          return { overrides: next };
        });
      },

      addResource(role, name) {
        set((s) => ({ resources: [...s.resources, makeResource(role, name)] }));
      },

      updateResource(id, patch) {
        set((s) => ({
          resources: s.resources.map((r) =>
            r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
          ),
        }));
      },

      deleteResource(id) {
        set((s) => ({ resources: s.resources.filter((r) => r.id !== id) }));
      },
    }),
    { name: "estimator-scheduling-v1" }
  )
);
