import { useState } from "react";
import { useProjectsStore, emptySnapshot } from "../../store/projectsStore.js";
import { useAuth } from "../auth/AuthGate.js";
import { api } from "../../lib/api.js";

interface Props {
  onOpenProject: () => void;
  onBack: () => void;
}

export function ProjectsListPage({ onOpenProject, onBack }: Props) {
  const { projects, openProject, createProject, deleteProject, renameProject, setApiId, syncFromServer } =
    useProjectsStore();
  const auth = useAuth();
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const myProjects = projects.filter((p) => !p.owner || p.owner === auth?.email);
  const teamProjects = projects.filter((p) => p.owner && p.owner !== auth?.email);

  function handleCreate() {
    const name = newName.trim() || "Untitled Project";
    const localId = createProject(name, emptySnapshot());
    setNaming(false);
    setNewName("");
    // Push to server in background
    api.projects.create(name).then(async (res) => {
      if (res.ok) {
        const sp: { id: string } = await res.json();
        setApiId(localId, sp.id);
      }
    });
    openProject(localId);
    onOpenProject();
  }

  function handleOpen(id: string) {
    openProject(id);
    onOpenProject();
  }

  async function handleCheckout(id: string) {
    const project = projects.find((p) => p.id === id);
    if (!project?.apiId) return;
    const res = await api.projects.checkout(project.apiId);
    if (res.ok) {
      await syncFromServer();
      openProject(id);
      onOpenProject();
    } else {
      const body = await res.json();
      setCheckoutError(body.error ?? "Could not check out project");
      setTimeout(() => setCheckoutError(null), 4000);
    }
  }

  async function handleTogglePublish(id: string) {
    let project = useProjectsStore.getState().projects.find((p) => p.id === id);
    if (!project) return;

    if (!project.apiId) {
      await useProjectsStore.getState().pushToServer(id);
      project = useProjectsStore.getState().projects.find((p) => p.id === id);
      if (!project?.apiId) {
        setCheckoutError("Could not sync project to server. Please try again.");
        setTimeout(() => setCheckoutError(null), 4000);
        return;
      }
    }

    const res = await api.projects.update(project.apiId, { published: !project.published });
    if (!res.ok) {
      const body: { error?: string } = await res.json().catch(() => ({}));
      setCheckoutError(body.error ?? "Could not update sharing. Please try again.");
      setTimeout(() => setCheckoutError(null), 4000);
      return;
    }
    await syncFromServer();
  }

  async function handleCheckin(id: string) {
    const project = projects.find((p) => p.id === id);
    if (!project?.apiId) return;
    await api.projects.checkin(project.apiId);
    await syncFromServer();
  }

  function handleRename(id: string) {
    const trimmed = editingName.trim();
    if (trimmed) renameProject(id, trimmed);
    setEditingId(null);
    setEditingName("");
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0b16]">
      {/* Header */}
      <header className="flex items-center px-6 py-4 border-b border-[#2e2848] bg-[#14112a] gap-4 flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-[#5c5575] hover:text-[#9b93ba] transition-colors">
          ← Back
        </button>
        <div className="flex items-center gap-3 ml-2">
          <img src="/HERO.png" alt="Vigo" className="w-7 h-7 object-contain rounded-md" />
          <span className="text-sm font-bold tracking-widest uppercase text-[#9b93ba]">Vigo</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {auth && <span className="text-xs text-[#3a3456]">{auth.email}</span>}
          <button
            onClick={() => setNaming(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", boxShadow: "0 0 16px rgba(124,58,237,0.35)" }}
          >
            + New Project
          </button>
        </div>
      </header>

      {/* Checkout error toast */}
      {checkoutError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white bg-red-600 shadow-lg">
          {checkoutError}
        </div>
      )}

      {/* New project modal */}
      {naming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col gap-5 p-8 rounded-2xl" style={{ background: "#14112a", border: "1px solid rgba(139,92,246,0.4)", boxShadow: "0 8px 40px rgba(0,0,0,0.6)", minWidth: 360 }}>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#9b93ba]">New Project</p>
            <input
              autoFocus type="text" placeholder="Project name…" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setNaming(false); setNewName(""); } }}
              className="w-full text-xl font-semibold text-white bg-transparent border-b-2 border-[#7c3aed] outline-none pb-2 placeholder:text-[#3a3456] caret-[#a78bfa]"
            />
            <div className="flex gap-3">
              <button onClick={handleCreate} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>Create</button>
              <button onClick={() => { setNaming(false); setNewName(""); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#5c5575] hover:text-[#9b93ba]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="flex flex-col gap-5 p-8 rounded-2xl" style={{ background: "#14112a", border: "1px solid rgba(239,68,68,0.3)", minWidth: 320 }}>
            <p className="text-base font-semibold text-white">Delete this project?</p>
            <p className="text-sm text-[#5c5575]">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { deleteProject(confirmDelete); setConfirmDelete(null); }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors">Delete</button>
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#5c5575] hover:text-[#9b93ba]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-10">

        {/* My Projects */}
        <section>
          <h2 className="text-2xl font-bold text-white mb-1">My Projects</h2>
          <p className="text-sm text-[#5c5575] mb-6">{myProjects.length} project{myProjects.length !== 1 ? "s" : ""}</p>
          {myProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
              <p className="text-[#5c5575] text-sm">No projects yet.</p>
              <button onClick={() => setNaming(true)} className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>+ New Project</button>
            </div>
          ) : (
            <ProjectGrid>
              {[...myProjects].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((project) => (
                <ProjectCard key={project.id}>
                  <ProjectName project={project} editingId={editingId} editingName={editingName} setEditingId={setEditingId} setEditingName={setEditingName} onRename={handleRename} />
                  <div className="flex flex-col gap-1 text-xs text-[#5c5575]">
                    <span>{project.snapshot.features.length} feature{project.snapshot.features.length !== 1 ? "s" : ""}</span>
                    <span>Updated {formatDate(project.updatedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-[#2e2848]">
                    <button onClick={() => handleOpen(project.id)} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>Open →</button>
                    <button
                      onClick={() => handleTogglePublish(project.id)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
                      style={project.published
                        ? { background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.5)", color: "#a78bfa" }
                        : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(139,92,246,0.35)", color: "#9b93ba" }}
                      title={project.published ? "Unshare with team" : "Share with team"}
                    >
                      {project.published ? "Shared" : "Share"}
                    </button>
                    <button onClick={() => setConfirmDelete(project.id)} className="p-2 rounded-lg text-[#3a3456] hover:text-red-400 transition-colors" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>×</button>
                  </div>
                </ProjectCard>
              ))}
            </ProjectGrid>
          )}
        </section>

        {/* Team Projects */}
        {teamProjects.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-white mb-1">Team Projects</h2>
            <p className="text-sm text-[#5c5575] mb-6">Shared by your team</p>
            <ProjectGrid>
              {teamProjects.map((project) => {
                const checkedOutByMe = project.checkedOutBy === auth?.email;
                const lockedByOther = project.checkedOutBy && !checkedOutByMe;
                return (
                  <ProjectCard key={project.id}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold text-white">{project.name}</h3>
                      {lockedByOther && (
                        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>Locked</span>
                      )}
                      {checkedOutByMe && (
                        <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.4)" }}>Checked out</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-[#5c5575]">
                      <span>by {project.owner}</span>
                      <span>{project.snapshot.features.length} feature{project.snapshot.features.length !== 1 ? "s" : ""}</span>
                      {lockedByOther && <span className="text-red-400">Editing: {project.checkedOutBy}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-auto pt-3 border-t border-[#2e2848]">
                      {checkedOutByMe ? (
                        <>
                          <button onClick={() => handleOpen(project.id)} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>Open →</button>
                          <button onClick={() => handleCheckin(project.id)} className="px-3 py-2 rounded-lg text-xs font-semibold text-[#5c5575] hover:text-[#9b93ba]" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>Check in</button>
                        </>
                      ) : lockedByOther ? (
                        <button disabled className="flex-1 py-2 rounded-lg text-sm font-semibold text-[#3a3456] cursor-not-allowed" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>Unavailable</button>
                      ) : (
                        <button onClick={() => handleCheckout(project.id)} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}>Check Out →</button>
                      )}
                    </div>
                  </ProjectCard>
                );
              })}
            </ProjectGrid>
          </section>
        )}
      </div>
    </div>
  );
}

function ProjectGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{children}</div>;
}

function ProjectCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="group flex flex-col rounded-2xl border border-[#2e2848] bg-[#14112a] overflow-hidden transition-all duration-200 hover:border-[#7c3aed]/60 hover:shadow-[0_0_24px_rgba(124,58,237,0.15)]">
      <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #7c3aed, #5b21b6)" }} />
      <div className="flex flex-col gap-3 p-5 flex-1">{children}</div>
    </div>
  );
}

interface ProjectNameProps {
  project: { id: string; name: string };
  editingId: string | null;
  editingName: string;
  setEditingId: (id: string | null) => void;
  setEditingName: (name: string) => void;
  onRename: (id: string) => void;
}

function ProjectName({ project, editingId, editingName, setEditingId, setEditingName, onRename }: ProjectNameProps) {
  if (editingId === project.id) {
    return (
      <input
        autoFocus
        className="text-base font-semibold text-white bg-transparent border-b border-[#7c3aed] outline-none caret-[#a78bfa] pb-0.5"
        value={editingName}
        onChange={(e) => setEditingName(e.target.value)}
        onBlur={() => onRename(project.id)}
        onKeyDown={(e) => { if (e.key === "Enter") onRename(project.id); if (e.key === "Escape") setEditingId(null); }}
      />
    );
  }
  return (
    <h3
      className="text-base font-semibold text-white cursor-pointer hover:text-[#a78bfa] transition-colors"
      onDoubleClick={() => { setEditingId(project.id); setEditingName(project.name); }}
      title="Double-click to rename"
    >
      {project.name}
    </h3>
  );
}
