import type { RouteStep } from "../types.js";
import { smoothstep } from "./smoothstep.js";

export interface NavDensityResult {
  stepsPerMile: number;
  subscore: number;
}

// 1.5 navigation decisions per mile = dense urban complexity
const MAX_STEPS_PER_MILE = 1.5;

export function computeNavigationDensity(
  steps: RouteStep[],
  distanceMeters: number
): NavDensityResult {
  const distanceMiles = distanceMeters / 1609.34;
  const stepsPerMile = distanceMiles > 0 ? steps.length / distanceMiles : 0;
  const subscore = smoothstep(stepsPerMile / MAX_STEPS_PER_MILE);
  return { stepsPerMile, subscore };
}
