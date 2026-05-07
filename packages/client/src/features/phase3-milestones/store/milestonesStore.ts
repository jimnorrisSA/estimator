import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Milestone {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  color: string;
}

export const MILESTONE_COLORS = [
  "#f59e0b", "#10b981", "#3b82f6", "#ef4444",
  "#8b5cf6", "#06b6d4", "#f97316", "#ec4899",
];

interface MilestonesStore {
  milestones: Milestone[];
  addMilestone: (title: string, startDate: string, endDate: string) => void;
  updateMilestone: (id: string, patch: Partial<Pick<Milestone, "title" | "startDate" | "endDate" | "color">>) => void;
  deleteMilestone: (id: string) => void;
}

export const useMilestonesStore = create<MilestonesStore>()(
  persist(
    (set, get) => ({
      milestones: [],

      addMilestone(title, startDate, endDate) {
        const color = MILESTONE_COLORS[get().milestones.length % MILESTONE_COLORS.length];
        set((s) => ({
          milestones: [...s.milestones, { id: crypto.randomUUID(), title, startDate, endDate, color }],
        }));
      },

      updateMilestone(id, patch) {
        set((s) => ({
          milestones: s.milestones.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }));
      },

      deleteMilestone(id) {
        set((s) => ({ milestones: s.milestones.filter((m) => m.id !== id) }));
      },
    }),
    { name: "vigo-milestones-v1" }
  )
);
