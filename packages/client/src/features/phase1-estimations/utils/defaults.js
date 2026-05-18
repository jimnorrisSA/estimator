import { FEATURE_MIN_W } from "./layout.js";
export const DISCIPLINE_COLORS = {
    Art: "#c05621",
    Design: "#9333ea",
    Code: "#0369a1",
    Production: "#15803d",
    Custom: "#374151",
};
export const DEFAULT_DISCIPLINES = ["Art", "Design", "Code", "Production"];
export function makeGroup(discipline, featureId) {
    return {
        id: crypto.randomUUID(),
        featureId,
        discipline,
        color: DISCIPLINE_COLORS[discipline],
        tasks: [],
        updatedAt: new Date().toISOString(),
    };
}
export function makeFeature(name, index) {
    const COLS = 3;
    const GAP = 40;
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const x = 40 + col * (FEATURE_MIN_W + GAP);
    const y = 80 + row * (300 + GAP);
    const id = crypto.randomUUID();
    const groups = [];
    return {
        id,
        projectId: "local",
        name,
        position: { x, y },
        width: FEATURE_MIN_W,
        color: "#1d1930",
        groups,
        updatedAt: new Date().toISOString(),
    };
}
