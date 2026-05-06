import type { Discipline, DisciplineGroup, Feature } from "@estimator/shared";
import { FEATURE_MIN_W } from "./layout.js";

export const DISCIPLINE_COLORS: Record<Discipline, string> = {
  Art: "#FFB347",
  Design: "#DDA0DD",
  Code: "#87CEEB",
  Production: "#90EE90",
  Custom: "#E0E0E0",
};

export const DEFAULT_DISCIPLINES: Discipline[] = ["Art", "Design", "Code", "Production"];

export function makeGroup(discipline: Discipline, featureId: string): DisciplineGroup {
  return {
    id: crypto.randomUUID(),
    featureId,
    discipline,
    color: DISCIPLINE_COLORS[discipline],
    tasks: [],
    updatedAt: new Date().toISOString(),
  };
}

export function makeFeature(name: string, index: number): Feature {
  const COLS = 3;
  const GAP = 40;
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = 40 + col * (FEATURE_MIN_W + GAP);
  const y = 80 + row * (300 + GAP);

  const id = crypto.randomUUID();
  const groups: DisciplineGroup[] = [];

  return {
    id,
    projectId: "local",
    name,
    position: { x, y },
    width: FEATURE_MIN_W,
    color: "#FFFFFF",
    groups,
    updatedAt: new Date().toISOString(),
  };
}
