import type { RouteStep } from "../types.js";
import { smoothstep } from "./smoothstep.js";

export interface SpeedResult {
  avgMph: number;
  maxMph: number;
  subscore: number;
}

const MPS_TO_MPH = 2.237;

export function mpsToMph(metersPerSecond: number): number {
  return metersPerSecond * MPS_TO_MPH;
}

export function impliedStepSpeedMph(step: RouteStep): number {
  if (step.staticDurationSeconds <= 0) return 0;
  const mps = step.distanceMeters / step.staticDurationSeconds;
  return mpsToMph(mps);
}

export function speedLimitToMph(
  limit: number,
  unit?: "KPH" | "MPH"
): number {
  if (unit === "KPH") return limit * 0.621371;
  return limit;
}

export function computeSpeedIntensity(
  steps: RouteStep[],
  stepSpeedsMph?: Map<number, number>
): SpeedResult {
  let totalMeters = 0;
  let weightedSpeedSum = 0;
  let maxMph = 0;

  steps.forEach((step, index) => {
    const distance = step.distanceMeters;
    if (distance <= 0) return;

    const mph = stepSpeedsMph?.get(index) ?? impliedStepSpeedMph(step);
    totalMeters += distance;
    weightedSpeedSum += mph * distance;
    maxMph = Math.max(maxMph, mph);
  });

  const avgMph = totalMeters > 0 ? weightedSpeedSum / totalMeters : 0;
  const avgNorm = smoothstep(avgMph / 65);
  const maxNorm = smoothstep(maxMph / 75);
  const subscore = 0.6 * avgNorm + 0.4 * maxNorm;

  return { avgMph, maxMph, subscore };
}
