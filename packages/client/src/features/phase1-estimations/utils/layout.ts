import type { DisciplineGroup, Feature } from "@estimator/shared";

export const FEATURE_HEADER_H = 38;
export const GROUP_HEADER_H = 26;
export const TASK_ROW_H = 26;
export const ADD_TASK_H = 26;
export const GROUP_BOTTOM_PAD = 6;
export const FEATURE_PAD = 10;
export const GROUP_GAP = 8;
export const ADD_GROUP_H = 32;
export const COLS = 2;
export const FEATURE_MIN_W = 320;

export function groupHeight(taskCount: number): number {
  return GROUP_HEADER_H + taskCount * TASK_ROW_H + ADD_TASK_H + GROUP_BOTTOM_PAD;
}

export function featureHeight(groups: DisciplineGroup[]): number {
  if (groups.length === 0) {
    return FEATURE_HEADER_H + FEATURE_PAD + ADD_GROUP_H + FEATURE_PAD;
  }
  let h = FEATURE_HEADER_H + FEATURE_PAD;
  for (let r = 0; r < Math.ceil(groups.length / COLS); r++) {
    const row = groups.slice(r * COLS, (r + 1) * COLS);
    const maxTasks = Math.max(...row.map((g) => g.tasks.length));
    h += groupHeight(maxTasks) + GROUP_GAP;
  }
  return h + ADD_GROUP_H + FEATURE_PAD;
}

export interface GroupLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeGroupLayouts(feature: Feature): GroupLayout[] {
  const colW = (feature.width - FEATURE_PAD * 2 - GROUP_GAP * (COLS - 1)) / COLS;
  const layouts: GroupLayout[] = [];
  let y = FEATURE_HEADER_H + FEATURE_PAD;

  for (let r = 0; r < Math.ceil(feature.groups.length / COLS); r++) {
    const row = feature.groups.slice(r * COLS, (r + 1) * COLS);
    const maxTasks = Math.max(...row.map((g) => g.tasks.length));
    const rowH = groupHeight(maxTasks);

    row.forEach((_, c) => {
      layouts.push({
        x: FEATURE_PAD + c * (colW + GROUP_GAP),
        y,
        width: colW,
        height: rowH,
      });
    });
    y += rowH + GROUP_GAP;
  }
  return layouts;
}

export function addGroupButtonY(feature: Feature): number {
  return featureHeight(feature.groups) - ADD_GROUP_H - FEATURE_PAD;
}
