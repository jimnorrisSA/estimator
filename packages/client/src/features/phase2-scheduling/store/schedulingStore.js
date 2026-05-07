import { create } from "zustand";
import { persist } from "zustand/middleware";
export const CURRENCY_SYMBOLS = {
    GBP: "£",
    USD: "$",
    EUR: "€",
    AUD: "A$",
};
function nextMonday() {
    const d = new Date();
    const day = d.getDay();
    const add = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    d.setDate(d.getDate() + add);
    return d.toISOString().slice(0, 10);
}
function makeResource(role, name) {
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
export const useSchedulingStore = create()(persist((set) => ({
    settings: {
        projectName: "New Project",
        startDate: nextMonday(),
        targetEndDate: "",
        calendarMode: "four-week",
        contingencyPct: 15,
        currency: "GBP",
        defaultDailyRate: 0,
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
            resources: s.resources.map((r) => r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r),
        }));
    },
    deleteResource(id) {
        set((s) => ({ resources: s.resources.filter((r) => r.id !== id) }));
    },
}), { name: "estimator-scheduling-v1" }));
