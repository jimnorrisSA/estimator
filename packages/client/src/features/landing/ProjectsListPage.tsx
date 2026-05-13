import { useState } from "react";
import { useProjectsStore, emptySnapshot } from "../../store/projectsStore.js";

interface Props {
  onOpenProject: () => void;
  onBack: () => void;
}

export function ProjectsListPage({ onOpenProject, onBack }: Props) {
  const { projects, openProject, createProject, deleteProject, renameProject } = useProjectsStore();
  const [naming, setNaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  function handleCreate() {
    const name = newName.trim() || "Untitled Project";
    createProject(name, emptySnapshot());
    setNaming(false);
    setNewName("");
    onOpenProject();
  }

  function handleOpen(id: string) {
    openProject(id);
    onOpenProject();
  }

  function handleRename(id: string) {
    const trimmed = editingName.trim();
    if (trimmed) renameProject(id, trimmed);
    setEditingId(null);
    setEditingName("");
  }

  const sorted = [...projects].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0d0b16]">
      {/* Header */}
      <header className="flex items-center px-6 py-4 border-b border-[#2e2848] bg-[#14112a] gap-4 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#5c5575] hover:text-[#9b93ba] transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3 ml-2">
          <img src="/logo.png" alt="Vigo" className="w-7 h-7 object-contain rounded-md" />
          <span className="text-sm font-bold tracking-widest uppercase text-[#9b93ba]">Vigo</span>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setNaming(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
              boxShadow: "0 0 16px rgba(124,58,237,0.35)",
            }}
          >
            + New Project
          </button>
        </div>
      </header>

      {/* New project name modal */}
      {naming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="flex flex-col gap-5 p-8 rounded-2xl"
            style={{
              background: "#14112a",
              border: "1px solid rgba(139,92,246,0.4)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(124,58,237,0.15)",
              minWidth: 360,
            }}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-[#9b93ba]">New Project</p>
            <input
              autoFocus
              type="text"
              placeholder="Project name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setNaming(false); setNewName(""); }
              }}
              className="w-full text-xl font-semibold text-white bg-transparent border-b-2 border-[#7c3aed] outline-none pb-2 placeholder:text-[#3a3456] caret-[#a78bfa]"
            />
            <div className="flex gap-3">
              <button
                onClick={handleCreate}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", boxShadow: "0 0 16px rgba(124,58,237,0.4)" }}
              >
                Create
              </button>
              <button
                onClick={() => { setNaming(false); setNewName(""); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#5c5575] hover:text-[#9b93ba] transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="flex flex-col gap-5 p-8 rounded-2xl"
            style={{
              background: "#14112a",
              border: "1px solid rgba(239,68,68,0.3)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              minWidth: 320,
            }}
          >
            <p className="text-base font-semibold text-white">Delete this project?</p>
            <p className="text-sm text-[#5c5575]">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { deleteProject(confirmDelete); setConfirmDelete(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-500 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#5c5575] hover:text-[#9b93ba] transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <h2 className="text-2xl font-bold text-white mb-1">Your Projects</h2>
        <p className="text-sm text-[#5c5575] mb-8">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="text-4xl opacity-20">⊞</div>
            <p className="text-[#5c5575] text-sm">No projects yet. Create your first one.</p>
            <button
              onClick={() => setNaming(true)}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white mt-2"
              style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)" }}
            >
              + New Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sorted.map((project) => (
              <div
                key={project.id}
                className="group flex flex-col rounded-2xl border border-[#2e2848] bg-[#14112a] overflow-hidden transition-all duration-200 hover:border-[#7c3aed]/60 hover:shadow-[0_0_24px_rgba(124,58,237,0.15)]"
              >
                {/* Card colour strip */}
                <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #7c3aed, #5b21b6)" }} />

                <div className="flex flex-col gap-3 p-5 flex-1">
                  {/* Project name */}
                  {editingId === project.id ? (
                    <input
                      autoFocus
                      className="text-base font-semibold text-white bg-transparent border-b border-[#7c3aed] outline-none caret-[#a78bfa] pb-0.5"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleRename(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(project.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                  ) : (
                    <h3
                      className="text-base font-semibold text-white cursor-pointer hover:text-[#a78bfa] transition-colors"
                      onDoubleClick={() => { setEditingId(project.id); setEditingName(project.name); }}
                      title="Double-click to rename"
                    >
                      {project.name}
                    </h3>
                  )}

                  {/* Metadata */}
                  <div className="flex flex-col gap-1 text-xs text-[#5c5575]">
                    <span>{project.snapshot.features.length} feature{project.snapshot.features.length !== 1 ? "s" : ""}</span>
                    <span>Updated {formatDate(project.updatedAt)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-[#2e2848]">
                    <button
                      onClick={() => handleOpen(project.id)}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold text-white transition-all"
                      style={{
                        background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
                        boxShadow: "0 0 12px rgba(124,58,237,0.3)",
                      }}
                    >
                      Open →
                    </button>
                    <button
                      onClick={() => setConfirmDelete(project.id)}
                      className="p-2 rounded-lg text-[#3a3456] hover:text-red-400 transition-colors"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                      title="Delete project"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
