import type { Discipline, Feature, PostIt } from "@estimator/shared";

export const DISCIPLINE_COLORS: Record<Discipline, string> = {
  Art: "#FFB347",
  Design: "#DDA0DD",
  Code: "#87CEEB",
  Production: "#90EE90",
  Custom: "#E0E0E0",
};

export const FEATURE_BOX_W = 330;
export const FEATURE_BOX_H = 380;
export const FEATURE_HEADER_H = 38;
export const POSTIT_W = 140;
export const POSTIT_H = 155;
const POSTIT_GAD = 10; // gap between post-its

const DISCIPLINES: Discipline[] = ["Art", "Design", "Code", "Production"];

// 2×2 grid inside the feature box
const POSTIT_POSITIONS = [
  { x: 10, y: FEATURE_HEADER_H + 10 },
  { x: 10 + POSTIT_W + POSTIT_GAD, y: FEATURE_HEADER_H + 10 },
  { x: 10, y: FEATURE_HEADER_H + 10 + POSTIT_H + POSTIT_GAD },
  { x: 10 + POSTIT_W + POSTIT_GAD, y: FEATURE_HEADER_H + 10 + POSTIT_H + POSTIT_GAD },
];

export function makeFeature(name: string, index: number): Feature {
  const COLS = 3;
  const GAP = 40;
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = 40 + col * (FEATURE_BOX_W + GAP);
  const y = 80 + row * (FEATURE_BOX_H + GAP);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const postits: PostIt[] = DISCIPLINES.map((discipline, i) => ({
    id: crypto.randomUUID(),
    featureId: id,
    discipline,
    color: DISCIPLINE_COLORS[discipline],
    position: POSTIT_POSITIONS[i],
    width: POSTIT_W,
    height: POSTIT_H,
    taskLabel: "",
    estimate: { value: 1, unit: "day" },
    updatedAt: now,
    updatedBy: "me",
  }));

  return {
    id,
    projectId: "local",
    name,
    position: { x, y },
    width: FEATURE_BOX_W,
    height: FEATURE_BOX_H,
    color: "#FFFFFF",
    postits,
    updatedAt: now,
  };
}
