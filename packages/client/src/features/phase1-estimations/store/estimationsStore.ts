import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Discipline, EstimateUnit, Feature } from "@estimator/shared";
import { makeFeature, makeGroup } from "../utils/defaults.js";

const MAX_HISTORY = 50;

interface EstimationsStore {
  features: Feature[];
  selectedId: string | null; // feature id or task id
  selectedIds: string[]; // multi-select feature ids
  _past: Feature[][];
  _future: Feature[][];

  undo: () => void;
  redo: () => void;

  generateFeatures: (names: string[]) => void;
  updateFeatureName: (id: string, name: string) => void;
  updateFeaturePosition: (id: string, pos: { x: number; y: number }) => void;
  updateFeatureWidth: (id: string, width: number) => void;
  batchUpdateFeaturePositions: (updates: { id: string; pos: { x: number; y: number } }[]) => void;

  deleteFeature: (id: string) => void;
  addGroup: (featureId: string, discipline: Discipline) => void;
  deleteGroup: (featureId: string, groupId: string) => void;

  addTask: (featureId: string, groupId: string, label: string) => string;
  duplicateTask: (featureId: string, groupId: string, taskId: string) => string;
  updateTaskLabel: (featureId: string, groupId: string, taskId: string, label: string) => void;
  updateTaskEstimate: (featureId: string, groupId: string, taskId: string, value: number, unit: EstimateUnit) => void;
  deleteTask: (featureId: string, groupId: string, taskId: string) => void;

  setSelected: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
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
      selectedIds: [],
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

      deleteFeature(id) {
        recorded(set, get, (fs) => fs.filter((f) => f.id !== id));
        // Clear selection if the deleted feature or one of its tasks was selected
        if (get().selectedId) {
          const stillExists = get().features.some(
            (f) => f.id === get().selectedId || f.groups.some((g) => g.tasks.some((t) => t.id === get().selectedId))
          );
          if (!stillExists) set({ selectedId: null });
        }
        set((s) => ({ selectedIds: s.selectedIds.filter((sid) => sid !== id) }));
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

      batchUpdateFeaturePositions(updates) {
        const posMap = new Map(updates.map((u) => [u.id, u.pos]));
        recorded(set, get, (fs) =>
          fs.map((f) => (posMap.has(f.id) ? { ...f, position: posMap.get(f.id)!, updatedAt: now() } : f))
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

      duplicateTask(featureId, groupId, taskId) {
        const newId = crypto.randomUUID();
        recorded(set, get, (fs) =>
          fs.map((f) =>
            f.id !== featureId
              ? f
              : {
                  ...f,
                  groups: f.groups.map((g) => {
                    if (g.id !== groupId) return g;
                    const idx = g.tasks.findIndex((t) => t.id === taskId);
                    if (idx < 0) return g;
                    const src = g.tasks[idx];
                    const copy = { id: newId, label: src.label, estimate: { ...src.estimate } };
                    return {
                      ...g,
                      tasks: [...g.tasks.slice(0, idx + 1), copy, ...g.tasks.slice(idx + 1)],
                      updatedAt: now(),
                    };
                  }),
                  updatedAt: now(),
                }
          )
        );
        return newId;
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

      setSelectedIds(ids) {
        set({ selectedIds: ids });
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
