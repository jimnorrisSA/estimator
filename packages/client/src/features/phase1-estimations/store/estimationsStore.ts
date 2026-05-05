import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Feature, EstimateUnit } from "@estimator/shared";
import { makeFeature } from "../utils/defaults.js";

const MAX_HISTORY = 50;

interface EstimationsStore {
  features: Feature[];
  selectedId: string | null;
  _past: Feature[][];
  _future: Feature[][];

  undo: () => void;
  redo: () => void;

  generateFeatures: (names: string[]) => void;
  updateFeaturePosition: (id: string, pos: { x: number; y: number }) => void;
  updateFeatureSize: (id: string, w: number, h: number) => void;

  updatePostItPosition: (fid: string, pid: string, pos: { x: number; y: number }) => void;
  updatePostItSize: (fid: string, pid: string, w: number, h: number) => void;
  updatePostItLabel: (fid: string, pid: string, label: string) => void;
  updatePostItEstimate: (fid: string, pid: string, value: number, unit: EstimateUnit) => void;
  updatePostItColor: (fid: string, pid: string, color: string) => void;

  setSelected: (id: string | null) => void;
}

// Wraps a features update with history recording
function recorded(
  set: (fn: (s: EstimationsStore) => Partial<EstimationsStore>) => void,
  get: () => EstimationsStore,
  updater: (features: Feature[]) => Feature[]
) {
  const current = get().features;
  set((s) => ({
    features: updater(s.features),
    _past: [...s._past.slice(-(MAX_HISTORY - 1)), current],
    _future: [],
  }));
}

export const useEstimationsStore = create<EstimationsStore>()(
  persist(
    (set, get) => ({
      features: [],
      selectedId: null,
      _past: [],
      _future: [],

      undo() {
        const { _past, features, _future } = get();
        if (!_past.length) return;
        set({
          features: _past[_past.length - 1],
          _past: _past.slice(0, -1),
          _future: [features, ..._future.slice(0, MAX_HISTORY - 1)],
        });
      },

      redo() {
        const { _future, features, _past } = get();
        if (!_future.length) return;
        set({
          features: _future[0],
          _past: [..._past.slice(-(MAX_HISTORY - 1)), features],
          _future: _future.slice(1),
        });
      },

      generateFeatures(names) {
        const existing = new Set(get().features.map((f) => f.name));
        const offset = get().features.length;
        const newFeatures = names
          .map((n) => n.trim())
          .filter((n) => n && !existing.has(n))
          .map((n, i) => makeFeature(n, offset + i));
        if (newFeatures.length) {
          recorded(set, get, (fs) => [...fs, ...newFeatures]);
        }
      },

      updateFeaturePosition(id, pos) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id === id ? { ...f, position: pos, updatedAt: new Date().toISOString() } : f
          )
        );
      },

      updateFeatureSize(id, w, h) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id === id ? { ...f, width: w, height: h, updatedAt: new Date().toISOString() } : f
          )
        );
      },

      updatePostItPosition(fid, pid, pos) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  postits: f.postits.map((p) =>
                    p.id === pid ? { ...p, position: pos, updatedAt: new Date().toISOString() } : p
                  ),
                }
          )
        );
      },

      updatePostItSize(fid, pid, w, h) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  postits: f.postits.map((p) =>
                    p.id === pid ? { ...p, width: w, height: h, updatedAt: new Date().toISOString() } : p
                  ),
                }
          )
        );
      },

      updatePostItLabel(fid, pid, label) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  postits: f.postits.map((p) =>
                    p.id === pid ? { ...p, taskLabel: label, updatedAt: new Date().toISOString() } : p
                  ),
                }
          )
        );
      },

      updatePostItEstimate(fid, pid, value, unit) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  postits: f.postits.map((p) =>
                    p.id === pid
                      ? { ...p, estimate: { value, unit }, updatedAt: new Date().toISOString() }
                      : p
                  ),
                }
          )
        );
      },

      updatePostItColor(fid, pid, color) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  postits: f.postits.map((p) =>
                    p.id === pid ? { ...p, color, updatedAt: new Date().toISOString() } : p
                  ),
                }
          )
        );
      },

      setSelected(id) {
        set({ selectedId: id });
      },
    }),
    {
      name: "estimator-phase1",
      // Don't persist history — only current state matters across sessions
      partialize: (s) => ({ features: s.features }),
    }
  )
);
