import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Feature, EstimateUnit } from "@estimator/shared";
import { makeFeature } from "../utils/defaults.js";

interface EstimationsStore {
  features: Feature[];
  selectedId: string | null;

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

export const useEstimationsStore = create<EstimationsStore>()(
  persist(
    (set, get) => ({
      features: [],
      selectedId: null,

      generateFeatures(names) {
        const existing = new Set(get().features.map((f) => f.name));
        const offset = get().features.length;
        const newFeatures = names
          .map((n) => n.trim())
          .filter((n) => n && !existing.has(n))
          .map((n, i) => makeFeature(n, offset + i));
        if (newFeatures.length) {
          set((s) => ({ features: [...s.features, ...newFeatures] }));
        }
      },

      updateFeaturePosition(id, pos) {
        set((s) => ({
          features: s.features.map((f) =>
            f.id === id ? { ...f, position: pos, updatedAt: new Date().toISOString() } : f
          ),
        }));
      },

      updateFeatureSize(id, w, h) {
        set((s) => ({
          features: s.features.map((f) =>
            f.id === id ? { ...f, width: w, height: h, updatedAt: new Date().toISOString() } : f
          ),
        }));
      },

      updatePostItPosition(fid, pid, pos) {
        set((s) => ({
          features: s.features.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  postits: f.postits.map((p) =>
                    p.id === pid ? { ...p, position: pos, updatedAt: new Date().toISOString() } : p
                  ),
                }
          ),
        }));
      },

      updatePostItSize(fid, pid, w, h) {
        set((s) => ({
          features: s.features.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  postits: f.postits.map((p) =>
                    p.id === pid ? { ...p, width: w, height: h, updatedAt: new Date().toISOString() } : p
                  ),
                }
          ),
        }));
      },

      updatePostItLabel(fid, pid, label) {
        set((s) => ({
          features: s.features.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  postits: f.postits.map((p) =>
                    p.id === pid ? { ...p, taskLabel: label, updatedAt: new Date().toISOString() } : p
                  ),
                }
          ),
        }));
      },

      updatePostItEstimate(fid, pid, value, unit) {
        set((s) => ({
          features: s.features.map((f) =>
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
          ),
        }));
      },

      updatePostItColor(fid, pid, color) {
        set((s) => ({
          features: s.features.map((f) =>
            f.id !== fid
              ? f
              : {
                  ...f,
                  postits: f.postits.map((p) =>
                    p.id === pid ? { ...p, color, updatedAt: new Date().toISOString() } : p
                  ),
                }
          ),
        }));
      },

      setSelected(id) {
        set({ selectedId: id });
      },
    }),
    { name: "estimator-phase1" }
  )
);
