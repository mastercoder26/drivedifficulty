import { smoothstep } from "./smoothstep.js";

export interface SustainedEffortResult {
  durationHours: number;
  subscore: number;
}

// 2.5 hours of driving = full sustained effort score
const MAX_EFFORT_HOURS = 2.5;

export function computeSustainedEffort(
  staticDurationSeconds: number
): SustainedEffortResult {
  const durationHours = staticDurationSeconds / 3600;
  const subscore = smoothstep(durationHours / MAX_EFFORT_HOURS);
  return { durationHours, subscore };
}
