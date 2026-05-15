import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Discipline, Resource, ResourceType } from "@estimator/shared";

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
  startDate: string;    // YYYY-MM-DD
  targetEndDate: string; // YYYY-MM-DD, empty = no target
  calendarMode: CalendarMode;
  contingencyPct: number;
  currency: Currency;
  defaultMonthlyRate: number; // fallback rate when task has no assigned resource
  workingDaysPerMonth: number; // used to convert monthly rate → daily cost (typically 22)
  exchangeRates: Record<string, number>; // GBP → X conversion rates
  revenueGBP: number; // client revenue stored in GBP
}

export function getConversionRate(settings: ScheduleSettings): number {
  if (settings.currency === "GBP") return 1;
  return settings.exchangeRates?.[settings.currency] ?? 1;
}

export interface TaskOverride {
  startDay?: number;
  endDay?: number;
  notes: string;
  assignedResourceId?: string;
  slotIndex?: number;
}

interface SchedulingStore {
  settings: ScheduleSettings;
  overrides: Record<string, TaskOverride>;
  resources: Resource[];

  updateSettings: (patch: Partial<ScheduleSettings>) => void;
  setOverride: (taskId: string, patch: Partial<TaskOverride>) => void;
  clearOverride: (taskId: string) => void;
  assignResource: (taskId: string, resourceId: string | null) => void;

  addResource: (role: Discipline, name: string) => void;
  updateResource: (id: string, patch: Partial<Pick<Resource, "name" | "resourceType" | "monthlyRate" | "allocationPct" | "rollOnDate" | "rollOffDate">>) => void;
  deleteResource: (id: string) => void;

  condenseAllTasks: () => void;
}

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const add = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + add);
  return d.toISOString().slice(0, 10);
}

function makeResource(role: Discipline, name: string, resourceType: ResourceType = "Contractor"): Resource {
  return {
    id: crypto.randomUUID(),
    projectId: "local",
    name,
    role,
    resourceType,
    rollOnDate: "",
    rollOffDate: "",
    allocationPct: 100,
    monthlyRate: 0,
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
        targetEndDate: "",
        calendarMode: "four-week",
        contingencyPct: 15,
        currency: "GBP",
        defaultMonthlyRate: 6700,
        workingDaysPerMonth: 22,
        exchangeRates: { USD: 1.35, EUR: 1.17, AUD: 1.94 },
        revenueGBP: 0,
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

      assignResource(taskId, resourceId) {
        set((s) => ({
          overrides: {
            ...s.overrides,
            [taskId]: {
              ...{ notes: "" },
              ...s.overrides[taskId],
              assignedResourceId: resourceId ?? undefined,
            },
          },
        }));
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

      condenseAllTasks() {
        set((s) => {
          const nextOverrides: Record<string, TaskOverride> = {};
          for (const [id, ov] of Object.entries(s.overrides)) {
            // Strip position pins; preserve notes, resource assignment, slot
            const kept: TaskOverride = { notes: ov.notes };
            if (ov.assignedResourceId != null) kept.assignedResourceId = ov.assignedResourceId;
            if (ov.slotIndex != null) kept.slotIndex = ov.slotIndex;
            if (kept.notes || kept.assignedResourceId != null || kept.slotIndex != null) {
              nextOverrides[id] = kept;
            }
          }
          return { overrides: nextOverrides };
        });
      },
    }),
    {
      name: "estimator-scheduling-v1",
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SchedulingStore>),
        settings: {
          ...current.settings,
          ...((persisted as Partial<SchedulingStore>)?.settings ?? {}),
        },
      }),
    }
  )
);
