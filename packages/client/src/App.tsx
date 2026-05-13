import { useEffect, useState } from "react";
import { EstimationsPage } from "./features/phase1-estimations/EstimationsPage.js";
import { SchedulingPage } from "./features/phase2-scheduling/SchedulingPage.js";
import { MilestonesPage } from "./features/phase3-milestones/MilestonesPage.js";
import { ExportMenu } from "./features/phase2-scheduling/components/ExportMenu.js";
import { LandingPage } from "./features/landing/LandingPage.js";
import { ProjectsListPage } from "./features/landing/ProjectsListPage.js";
import { AuthGate } from "./features/auth/AuthGate.js";
import { useProjectsStore, migrateFromLegacyStores } from "./store/projectsStore.js";
import { useEstimationsStore } from "./features/phase1-estimations/store/estimationsStore.js";
import { useSchedulingStore } from "./features/phase2-scheduling/store/schedulingStore.js";
import { useMilestonesStore } from "./features/phase3-milestones/store/milestonesStore.js";

type AppView = "landing" | "projects" | "app";
type Phase = 1 | 2 | 3;

const TABS: { phase: Phase; label: string; sub: string }[] = [
  { phase: 1, label: "Phase 1", sub: "Estimations" },
  { phase: 2, label: "Phase 2", sub: "Schedule" },
  { phase: 3, label: "Phase 3", sub: "Milestones" },
];

function AppContent() {
  const [view, setView] = useState<AppView>("landing");
  const [activePhase, setActivePhase] = useState<Phase>(1);

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
  function saveCurrentProject() {
    const active = getActiveProject();
    if (!active) return;
    const snapshot = {
      features: useEstimationsStore.getState().features,
      schedulingSettings: useSchedulingStore.getState().settings,
      overrides: useSchedulingStore.getState().overrides,
      resources: useSchedulingStore.getState().resources,
      milestones: useMilestonesStore.getState().milestones,
    };
    saveActiveSnapshot(snapshot);
    // Fire-and-forget push to server
    pushToServer(active.id);
  }

  // Load a project's snapshot into all phase stores
  function loadProjectSnapshot(projectId: string) {
    const entry = useProjectsStore.getState().projects.find((p) => p.id === projectId);
    if (!entry) return;
    const { snapshot } = entry;
    useEstimationsStore.setState({
      features: snapshot.features,
      selectedId: null,
      selectedIds: [],
      _past: [],
      _future: [],
    });
    useSchedulingStore.setState({
      settings: snapshot.schedulingSettings,
      overrides: snapshot.overrides,
      resources: snapshot.resources,
    });
    useMilestonesStore.setState({ milestones: snapshot.milestones });
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

  function handleBackToProjects() {
    saveCurrentProject();
    setView("projects");
  }

  function handleBackToLanding() {
    saveCurrentProject();
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
          <img src="/logo.png" alt="Vigo" className="h-9 w-9 object-contain rounded-lg" />
        </button>

        {/* Active phase tabs */}
        {TABS.map(({ phase, label, sub }) => (
          <button
            key={phase}
            onClick={() => setActivePhase(phase)}
            className={`flex flex-col items-start justify-center px-4 py-2.5 text-left border-b-2 transition-colors ${
              activePhase === phase
                ? "border-[#8b5cf6] text-[#a78bfa]"
                : "border-transparent text-[#5c5575] hover:text-[#9b93ba] hover:border-[#3d366a]"
            }`}
          >
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
        </div>

        {/* Future phase tab */}
        <div className="flex items-stretch gap-1">
          <button
            disabled
            className="flex flex-col items-start justify-center px-4 py-2.5 text-left border-b-2 border-transparent opacity-30 cursor-not-allowed"
          >
            <span className="text-xs font-semibold uppercase tracking-wide leading-none text-[#5c5575]">Phase 4</span>
            <span className="text-sm font-medium leading-tight mt-0.5 text-[#5c5575]">Timeline</span>
          </button>
        </div>
      </nav>

      {/* Page content */}
      <div className="flex-1 min-h-0">
        {activePhase === 1 && <EstimationsPage />}
        {activePhase === 2 && <SchedulingPage />}
        {activePhase === 3 && <MilestonesPage />}
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
