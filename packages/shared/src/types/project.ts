export type Discipline = "Art" | "Design" | "Code" | "Production" | "Custom";

export type EstimateUnit = "half_day" | "day" | "week" | "month";

export const WORKING_DAYS: Record<EstimateUnit, number> = {
  half_day: 0.5,
  day: 1,
  week: 5,
  month: 20,
};

export interface Estimate {
  value: number;
  unit: EstimateUnit;
}

export interface PostIt {
  id: string;
  featureId: string;
  discipline: Discipline;
  color: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  taskLabel: string;
  estimate: Estimate;
  // Derived — not stored
  resolvedWorkingDays?: number;
  // Plantastic sync
  plantasticIssueId?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Feature {
  id: string;
  projectId: string;
  name: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  color: string;
  postits: PostIt[];
  // Plantastic sync
  plantasticEpicId?: string;
  updatedAt: string;
}

export interface Resource {
  id: string;
  projectId: string;
  name: string;
  role: Discipline;
  rollOnDate: string;   // ISO date
  rollOffDate: string;  // ISO date
  allocationPct: number; // 0–100
  dailyRate: number;
  currency: string;
  notes: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  label: string;
  type: "feature-derived" | "manual";
  // feature-derived: featureId is set; date is computed from last task end
  featureId?: string;
  // manual: date or anchorFeatureId is set
  date?: string;         // ISO date
  anchorFeatureId?: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  owner: string;  // Google account email
  contingencyPct: number;  // default 15
  calendarMode: "actual" | "four-week";
  features: Feature[];
  resources: Resource[];
  milestones: Milestone[];
  // Plantastic sync
  plantasticProjectId?: string;
  createdAt: string;
  updatedAt: string;
}
