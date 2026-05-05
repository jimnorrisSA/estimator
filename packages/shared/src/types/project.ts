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

// A single named, estimated task within a discipline group
export interface TaskItem {
  id: string;
  label: string;
  estimate: Estimate;
}

// A discipline "card" inside a feature box — groups related tasks by discipline
export interface DisciplineGroup {
  id: string;
  featureId: string;
  discipline: Discipline;
  color: string;
  tasks: TaskItem[];
  // Plantastic sync — each task maps to a Plantastic issue
  plantasticIssueIds?: Record<string, string>; // taskId → plantastic issue id
  updatedAt: string;
}

export interface Feature {
  id: string;
  projectId: string;
  name: string;
  position: { x: number; y: number };
  width: number; // height is derived from content
  color: string;
  groups: DisciplineGroup[];
  plantasticEpicId?: string;
  updatedAt: string;
}

export interface Resource {
  id: string;
  projectId: string;
  name: string;
  role: Discipline;
  rollOnDate: string;
  rollOffDate: string;
  allocationPct: number;
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
  featureId?: string;
  date?: string;
  anchorFeatureId?: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  owner: string;
  contingencyPct: number;
  calendarMode: "actual" | "four-week";
  features: Feature[];
  resources: Resource[];
  milestones: Milestone[];
  plantasticProjectId?: string;
  createdAt: string;
  updatedAt: string;
}
