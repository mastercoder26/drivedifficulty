import { smoothstep } from "./smoothstep.js";

export interface SustainedEffortResult {
  durationHours: number;
  subscore: number;
}

// First 15 minutes are "free"; 4 hours of driving = full sustained effort
const GRACE_HOURS = 0.25;
const MAX_EFFORT_HOURS = 4;

export function computeSustainedEffort(
  staticDurationSeconds: number
): SustainedEffortResult {
  const durationHours = staticDurationSeconds / 3600;
  const effectiveHours = Math.max(0, durationHours - GRACE_HOURS);
  const subscore = smoothstep(effectiveHours / MAX_EFFORT_HOURS);
  return { durationHours, subscore };
}

export function computeSustainedEffortFromHours(
  durationHours: number
): SustainedEffortResult {
  return computeSustainedEffort(durationHours * 3600);
}
