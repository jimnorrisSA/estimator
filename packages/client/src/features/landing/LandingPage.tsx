import { useState } from "react";
import { useProjectsStore, emptySnapshot } from "../../store/projectsStore.js";

interface Props {
  onEnterApp: () => void;
  onOpenProjects: () => void;
}

export function LandingPage({ onEnterApp, onOpenProjects }: Props) {
  const [naming, setNaming] = useState(false);
  const [projectName, setProjectName] = useState("");
  const { createProject, projects } = useProjectsStore();

  function handleCreate() {
    const name = projectName.trim() || "Untitled Project";
    createProject(name, emptySnapshot());
    setNaming(false);
    setProjectName("");
    onEnterApp();
  }

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#080612" }}>

      {/* Full-screen hero */}
      <img src="/HERO.png" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover" />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(8,6,18,0.45) 0%, rgba(8,6,18,0.35) 35%, rgba(8,6,18,0.65) 70%, rgba(8,6,18,0.92) 100%)" }} />

      {/* Purple ambience fallback */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(109,40,217,0.35) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(59,7,100,0.25) 0%, transparent 70%)" }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 gap-8">

        {/* Title */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-7xl font-black tracking-[0.25em] text-white uppercase" style={{ textShadow: "0 0 60px rgba(139,92,246,0.6), 0 2px 4px rgba(0,0,0,0.8)" }}>
            VIGO
          </h1>
          <p className="text-base font-medium tracking-[0.15em] uppercase text-[#9b93ba]">
            Project Estimation Suite
          </p>
        </div>

        {/* Tagline */}
        <p className="text-xl text-[#c5bedf] font-light text-center max-w-md" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
          From post-its to production schedules,<br />all in one place.
        </p>

        {/* CTA */}
        {!naming ? (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={() => setNaming(true)}
              className="group relative px-10 py-4 rounded-2xl text-lg font-semibold text-white transition-all duration-200 overflow-hidden"
              style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)", boxShadow: "0 0 32px rgba(124,58,237,0.5), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)", minWidth: 220 }}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <span className="text-xl">+</span> New Project
              </span>
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" }} />
            </button>

            <button
              onClick={onOpenProjects}
              disabled={projects.length === 0}
              className="group px-10 py-4 rounded-2xl text-lg font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ minWidth: 220, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(139,92,246,0.4)", color: "#c5bedf", boxShadow: "0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)", backdropFilter: "blur(12px)" }}
              onMouseEnter={(e) => { if (projects.length > 0) (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(139,92,246,0.8)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(139,92,246,0.4)"; }}
            >
              <span className="flex items-center justify-center gap-2">
                <span>⊞</span> Open Project
                {projects.length > 0 && (
                  <span className="text-xs bg-[#7c3aed] text-white rounded-full px-2 py-0.5 ml-1">{projects.length}</span>
                )}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-8 rounded-2xl" style={{ background: "rgba(20,17,42,0.85)", border: "1px solid rgba(139,92,246,0.4)", backdropFilter: "blur(20px)", boxShadow: "0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(124,58,237,0.15)", minWidth: 360 }}>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#9b93ba]">New Project</p>
            <input
              autoFocus type="text" placeholder="Project name…" value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setNaming(false); setProjectName(""); } }}
              className="w-full text-center text-xl font-semibold text-white bg-transparent border-b-2 border-[#7c3aed] outline-none pb-2 placeholder:text-[#3a3456] caret-[#a78bfa]"
            />
            <div className="flex gap-3 pt-1">
              <button onClick={handleCreate} className="px-8 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ background: "linear-gradient(135deg, #7c3aed, #5b21b6)", boxShadow: "0 0 16px rgba(124,58,237,0.4)" }}>Create</button>
              <button onClick={() => { setNaming(false); setProjectName(""); }} className="px-8 py-2.5 rounded-xl text-sm font-semibold text-[#5c5575] hover:text-[#9b93ba] transition-colors" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center z-10">
        <p className="text-xs text-[#3a3456] tracking-widest uppercase">
          Soul Assembly · {new Date().getFullYear()}
        </p>
      </div>

    </div>
  );
}
