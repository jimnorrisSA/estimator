import { create } from "zustand";
import { persist } from "zustand/middleware";
export const CURRENCY_SYMBOLS = {
    GBP: "£",
    USD: "$",
    EUR: "€",
    AUD: "A$",
};
export function getConversionRate(settings) {
    if (settings.currency === "GBP")
        return 1;
    return settings.exchangeRates?.[settings.currency] ?? 1;
}
function nextMonday() {
    const d = new Date();
    const day = d.getDay();
    const add = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    d.setDate(d.getDate() + add);
    return d.toISOString().slice(0, 10);
}
function makeResource(role, name, resourceType = "Contractor") {
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
export const useSchedulingStore = create()(persist((set) => ({
    settings: {
        projectName: "New Project",
        startDate: nextMonday(),
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
    setMonthlyAllocation(resourceId, month, value) {
        set((s) => ({
            resources: s.resources.map((r) => {
                if (r.id !== resourceId)
                    return r;
                const allocs = { ...(r.monthlyAllocations ?? {}) };
                if (value <= 0)
                    delete allocs[month];
                else
                    allocs[month] = value;
                return { ...r, monthlyAllocations: allocs, updatedAt: new Date().toISOString() };
            }),
        }));
    },
    deleteResource(id) {
        set((s) => ({ resources: s.resources.filter((r) => r.id !== id) }));
    },
    condenseAllTasks() {
        set((s) => {
            const nextOverrides = {};
            for (const [id, ov] of Object.entries(s.overrides)) {
                // Strip position pins; preserve notes, resource assignment, slot
                const kept = { notes: ov.notes };
                if (ov.assignedResourceId != null)
                    kept.assignedResourceId = ov.assignedResourceId;
                if (ov.slotIndex != null)
                    kept.slotIndex = ov.slotIndex;
                if (kept.notes || kept.assignedResourceId != null || kept.slotIndex != null) {
                    nextOverrides[id] = kept;
                }
            }
            return { overrides: nextOverrides };
        });
    },
}), {
    name: "estimator-scheduling-v1",
    merge: (persisted, current) => ({
        ...current,
        ...persisted,
        settings: {
            ...current.settings,
            ...(persisted?.settings ?? {}),
        },
    }),
}));
