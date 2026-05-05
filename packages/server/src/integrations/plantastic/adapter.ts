// Plantastic integration adapter — built against a stub until the live API is available.
// See spec §7.3 for mapping: Project→Project, Feature→Epic, PostIt→Issue, etc.

import type { Project } from "@estimator/shared";

export interface PlantasticConfig {
  baseUrl: string;
  apiKey: string;
}

export async function pushToPlantastic(
  _project: Project,
  _config: PlantasticConfig
): Promise<void> {
  throw new Error("Plantastic adapter not yet implemented");
}

export async function pullFromPlantastic(
  _plantasticProjectId: string,
  _config: PlantasticConfig
): Promise<Partial<Project>> {
  throw new Error("Plantastic adapter not yet implemented");
}
