import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "../lib/api.js";
const DEFAULT_SETTINGS = {
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
export function emptySnapshot() {
    return {
        features: [],
        schedulingSettings: { ...DEFAULT_SETTINGS },
        overrides: {},
        resources: [],
        milestones: [],
    };
}
function readPersistedState(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        return (parsed?.state ?? null);
    }
    catch {
        return null;
    }
}
export function migrateFromLegacyStores() {
    const estimations = readPersistedState("estimator-phase1-v2");
    if (!estimations?.features?.length)
        return null;
    const scheduling = readPersistedState("estimator-scheduling-v1");
    const milestones = readPersistedState("vigo-milestones-v1");
    return {
        features: estimations.features,
        schedulingSettings: scheduling?.settings ?? { ...DEFAULT_SETTINGS },
        overrides: scheduling?.overrides ?? {},
        resources: scheduling?.resources ?? [],
        milestones: milestones?.milestones ?? [],
    };
}
export const useProjectsStore = create()(persist((set, get) => ({
    projects: [],
    activeProjectId: null,
    createProject(name, initialSnapshot) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const entry = {
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
        if (!activeProjectId)
            return;
        set((s) => ({
            projects: s.projects.map((p) => p.id === activeProjectId
                ? { ...p, snapshot, updatedAt: new Date().toISOString() }
                : p),
        }));
    },
    renameProject(id, name) {
        set((s) => ({
            projects: s.projects.map((p) => p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p),
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
            projects: s.projects.map((p) => p.id === localId ? { ...p, apiId } : p),
        }));
    },
    replaceFromServer(serverProjects) {
        const { activeProjectId } = get();
        // Preserve active project selection if it still exists on server
        const newActive = serverProjects.find((p) => p.id === activeProjectId || p.apiId === activeProjectId)?.id ??
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
            const mine = await myRes.json();
            const shared = sharedRes.ok ? await sharedRes.json() : [];
            console.log("[sync] mine:", mine.length, "shared:", shared.length, "| shared status:", sharedRes.status);
            if (mine.length > 0)
                console.log("[sync] my projects:", mine.map(p => ({ name: p.name, owner: p.owner, published: p.published })));
            if (shared.length > 0)
                console.log("[sync] shared projects:", shared.map(p => ({ name: p.name, owner: p.owner, published: p.published })));
            const toEntry = (sp) => ({
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
            }
            else {
                const local = get().projects;
                for (const p of local) {
                    await get().pushToServer(p.id);
                }
            }
        }
        catch (e) {
            console.warn("[sync] error:", e);
        }
    },
    async pushToServer(localId) {
        const project = get().projects.find((p) => p.id === localId);
        if (!project)
            return;
        try {
            if (project.apiId) {
                await api.projects.update(project.apiId, {
                    name: project.name,
                    snapshot: project.snapshot,
                });
            }
            else {
                const res = await api.projects.create(project.name);
                if (res.ok) {
                    const sp = await res.json();
                    get().setApiId(localId, sp.id);
                    await api.projects.update(sp.id, { snapshot: project.snapshot });
                }
            }
        }
        catch {
            // offline — will sync later
        }
    },
}), {
    name: "vigo-projects-v1",
}));
