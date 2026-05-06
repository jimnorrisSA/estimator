import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Discipline, EstimateUnit, Feature } from "@estimator/shared";
import { makeFeature, makeGroup } from "../utils/defaults.js";

const MAX_HISTORY = 50;

interface EstimationsStore {
  features: Feature[];
  selectedId: string | null; // feature id or task id
  _past: Feature[][];
  _future: Feature[][];

  undo: () => void;
  redo: () => void;

  generateFeatures: (names: string[]) => void;
  updateFeatureName: (id: string, name: string) => void;
  updateFeaturePosition: (id: string, pos: { x: number; y: number }) => void;
  updateFeatureWidth: (id: string, width: number) => void;

  addGroup: (featureId: string, discipline: Discipline) => void;
  deleteGroup: (featureId: string, groupId: string) => void;

  addTask: (featureId: string, groupId: string, label: string) => string;
  updateTaskLabel: (featureId: string, groupId: string, taskId: string, label: string) => void;
  updateTaskEstimate: (featureId: string, groupId: string, taskId: string, value: number, unit: EstimateUnit) => void;
  deleteTask: (featureId: string, groupId: string, taskId: string) => void;

  setSelected: (id: string | null) => void;
}

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

      updateFeatureName(id, name) {
        recorded(set, get, (fs) =>
          fs.map((f) => (f.id === id ? { ...f, name, updatedAt: now() } : f))
        );
      },

      updateFeaturePosition(id, pos) {
        recorded(set, get, (fs) =>
          fs.map((f) => (f.id === id ? { ...f, position: pos, updatedAt: now() } : f))
        );
      },

      updateFeatureWidth(id, width) {
        recorded(set, get, (fs) =>
          fs.map((f) => (f.id === id ? { ...f, width, updatedAt: now() } : f))
        );
      },

      addGroup(featureId, discipline) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== featureId
              ? f
              : { ...f, groups: [...f.groups, makeGroup(discipline, featureId)], updatedAt: now() }
          )
        );
      },

      deleteGroup(featureId, groupId) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== featureId
              ? f
              : { ...f, groups: f.groups.filter((g) => g.id !== groupId), updatedAt: now() }
          )
        );
      },

      addTask(featureId, groupId, label) {
        const taskId = crypto.randomUUID();
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== featureId
              ? f
              : {
                  ...f,
                  groups: f.groups.map((g) =>
                    g.id !== groupId
                      ? g
                      : {
                          ...g,
                          tasks: [
                            ...g.tasks,
                            { id: taskId, label, estimate: { value: 1, unit: "day" } },
                          ],
                          updatedAt: now(),
                        }
                  ),
                  updatedAt: now(),
                }
          )
        );
        return taskId;
      },

      updateTaskLabel(featureId, groupId, taskId, label) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== featureId
              ? f
              : {
                  ...f,
                  groups: f.groups.map((g) =>
                    g.id !== groupId
                      ? g
                      : {
                          ...g,
                          tasks: g.tasks.map((t) => (t.id === taskId ? { ...t, label } : t)),
                          updatedAt: now(),
                        }
                  ),
                }
          )
        );
      },

      updateTaskEstimate(featureId, groupId, taskId, value, unit) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== featureId
              ? f
              : {
                  ...f,
                  groups: f.groups.map((g) =>
                    g.id !== groupId
                      ? g
                      : {
                          ...g,
                          tasks: g.tasks.map((t) =>
                            t.id === taskId ? { ...t, estimate: { value, unit } } : t
                          ),
                          updatedAt: now(),
                        }
                  ),
                }
          )
        );
      },

      deleteTask(featureId, groupId, taskId) {
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== featureId
              ? f
              : {
                  ...f,
                  groups: f.groups.map((g) =>
                    g.id !== groupId
                      ? g
                      : { ...g, tasks: g.tasks.filter((t) => t.id !== taskId), updatedAt: now() }
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
      name: "estimator-phase1-v2",
      partialize: (s) => ({ features: s.features }),
    }
  )
);

function now() {
  return new Date().toISOString();
}
