import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { EstimationsPage } from "./features/phase1-estimations/EstimationsPage.js";
import { SchedulingPage } from "./features/phase2-scheduling/SchedulingPage.js";
import { MilestonesPage } from "./features/phase3-milestones/MilestonesPage.js";
import { CostSheetPage } from "./features/phase4-costs/CostSheetPage.js";
import { ExportMenu } from "./features/phase2-scheduling/components/ExportMenu.js";
import { JiraMenu } from "./features/jira/components/JiraMenu.js";
import { LandingPage } from "./features/landing/LandingPage.js";
import { ProjectsListPage } from "./features/landing/ProjectsListPage.js";
import { AuthGate } from "./features/auth/AuthGate.js";
import { api } from "./lib/api.js";
import { useProjectsStore, migrateFromLegacyStores } from "./store/projectsStore.js";
import { useEstimationsStore } from "./features/phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore } from "./features/phase2-scheduling/store/schedulingStore.js";
import { useMilestonesStore } from "./features/phase3-milestones/store/milestonesStore.js";

type AppView = "landing" | "projects" | "app";
type Phase = 1 | 2 | 3 | 4;

const TABS: { phase: Phase; label: string; sub: string }[] = [
  { phase: 1, label: "Phase 1", sub: "Estimations" },
  { phase: 2, label: "Phase 2", sub: "Schedule" },
  { phase: 3, label: "Phase 3", sub: "Milestones" },
  { phase: 4, label: "Phase 4", sub: "Costs" },
];

function AppContent() {
  const [view, setView] = useState<AppView>("landing");
  const [activePhase, setActivePhase] = useState<Phase>(1);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const { getActiveProject, saveActiveSnapshot, pushToServer } =
    useProjectsStore();

  // On first authenticated load: pull from server, fallback to legacy migration
  useEffect(() => {
    const store = useProjectsStore.getState();
    store.syncFromServer().then(() => {
      // If still empty after server load, try legacy migration
      if (useProjectsStore.getState().projects.length === 0) {
        const legacy = migrateFromLegacyStores();
        if (legacy) {
          const name = legacy.schedulingSettings.projectName || "My Project";
          const localId = store.createProject(name, legacy);
          store.pushToServer(localId);
        }
      }
    });
  }, []);

  // Collect the current phase store states into a snapshot and save locally + server
  async function saveCurrentProject() {
    const active = useProjectsStore.getState().getActiveProject();
    if (!active) return;
    const snapshot = {
      features: useEstimationsStore.getState().features,
      schedulingSettings: useSchedulingStore.getState().settings,
      overrides: useSchedulingStore.getState().overrides,
      resources: useSchedulingStore.getState().resources,
      milestones: useMilestonesStore.getState().milestones,
    };
    saveActiveSnapshot(snapshot);
    if (active.checkedOutBy && active.apiId) {
      // Save first, then release the lock — order matters
      const apiId = active.apiId;
      await pushToServer(active.id);
      api.projects.checkin(apiId).catch(() => {});
    } else {
      await pushToServer(active.id);
    }
  }

  async function handleSave() {
    if (saveState === "saving") return;
    setSaveState("saving");
    await saveCurrentProject();
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  }

  // Load a project's snapshot into all phase stores
  function loadProjectSnapshot(projectId: string) {
    const entry = useProjectsStore.getState().projects.find((p) => p.id === projectId);
    if (!entry) return;
    const { snapshot } = entry;
    useEstimationsStore.setState({
      features: snapshot.features ?? [],
      selectedId: null,
      selectedIds: [],
      _past: [],
      _future: [],
    });
    useSchedulingStore.setState({
      settings: snapshot.schedulingSettings,
      overrides: snapshot.overrides ?? {},
      // Normalise resourceType — old snapshots may have "" from a persist bug
      resources: (snapshot.resources ?? []).map((r) => ({
        ...r,
        resourceType: (r.resourceType || "Contractor") as "FTE" | "Contractor",
      })),
    });
    useMilestonesStore.setState({ milestones: snapshot.milestones ?? [] });
  }

  function handleEnterApp() {
    const active = useProjectsStore.getState().getActiveProject();
    if (active) loadProjectSnapshot(active.id);
    setView("app");
    setActivePhase(1);
  }

  function handleOpenProjectFromList() {
    const active = useProjectsStore.getState().getActiveProject();
    if (active) loadProjectSnapshot(active.id);
    setView("app");
    setActivePhase(1);
  }

  async function handleBackToProjects() {
    await saveCurrentProject();
    setView("projects");
  }

  async function handleBackToLanding() {
    await saveCurrentProject();
    setView("landing");
  }

  if (view === "landing") {
    return (
      <LandingPage
        onEnterApp={handleEnterApp}
        onOpenProjects={() => setView("projects")}
      />
    );
  }

  if (view === "projects") {
    return (
      <ProjectsListPage
        onOpenProject={handleOpenProjectFromList}
        onBack={handleBackToLanding}
      />
    );
  }

  const activeProject = getActiveProject();

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0b16]">
      {/* Navigation */}
      <nav className="flex items-stretch bg-[#14112a] border-b border-[#2e2848] flex-shrink-0 px-4 gap-1">
        {/* Back to projects */}
        <button
          onClick={handleBackToProjects}
          className="flex items-center gap-1.5 pr-4 mr-2 border-r border-[#2e2848] text-xs text-[#5c5575] hover:text-[#9b93ba] transition-colors"
          title="All projects"
        >
          ←
        </button>

        {/* Logo / brand */}
        <button
          onClick={handleBackToLanding}
          className="flex items-center pr-4 mr-2 border-r border-[#2e2848]"
          title="Home"
        >
          <img src="/HERO.png" alt="Vigo" className="h-9 w-9 object-contain rounded-lg" />
        </button>

        {/* Active phase tabs — sliding indicator */}
        {TABS.map(({ phase, label, sub }) => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`relative flex flex-col items-start justify-center px-4 py-2.5 text-left transition-colors ${
              activePhase === phase
                ? "text-[#a78bfa]"
                : "text-[#5c5575] hover:text-[#9b93ba]"
            }`}
          >
            {/* Animated sliding underline indicator */}
            {activePhase === phase && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8b5cf6] rounded-t-sm"
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              />
            )}
            <span className="text-xs font-semibold uppercase tracking-wide leading-none">{label}</span>
            <span className="text-sm font-medium leading-tight mt-0.5">{sub}</span>
          </button>
        ))}

        {/* Nav actions */}
        <div className="flex items-center ml-auto gap-3 pr-2">
          {activeProject && (
            <span className="text-xs text-[#5c5575] truncate max-w-48" title={activeProject.name}>
              {activeProject.name}
            </span>
          )}
          {activePhase === 2 && <ExportMenu />}
          <JiraMenu />

          {/* Save button with label morph animation */}
          <button
            onClick={handleSave}
            disabled={saveState === "saving"}
            className="relative flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 overflow-hidden min-w-[56px]"
            style={
              saveState === "saved"
                ? { background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#86efac" }
                : { background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)", color: "#a78bfa" }
            }
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={saveState}
                initial={{ opacity: 0, filter: "blur(4px)", y: 4 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                exit={{ opacity: 0, filter: "blur(4px)", y: -4 }}
                transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
                style={{ display: "block" }}
              >
                {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save"}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>

      </nav>

      {/* Page content — crossfade between phases */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activePhase}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
          >
            {activePhase === 1 && <EstimationsPage />}
            {activePhase === 2 && <SchedulingPage />}
            {activePhase === 3 && <MilestonesPage />}
            {activePhase === 4 && <CostSheetPage />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AuthGate>
      <AppContent />
    </AuthGate>
  );
}
