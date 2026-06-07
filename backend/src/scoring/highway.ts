import type { RouteStep } from "../types.js";

const HIGHWAY_INSTRUCTION_RE =
  /\b(I-\d+|US\s*\d+|SR-\d+|Hwy|Freeway|Expressway|Motorway|Turnpike)\b/i;

const RAMP_MANEUVERS = new Set(["RAMP_LEFT", "RAMP_RIGHT", "MERGE"]);
const STRAIGHT_MANEUVERS = new Set(["STRAIGHT", "NAME_CHANGE"]);

export interface HighwayResult {
  highwayShare: number;
  subscore: number;
}

export function isHighwayStep(
  step: RouteStep,
  stepSpeedMph?: number
): boolean {
  if (step.navigationInstruction && HIGHWAY_INSTRUCTION_RE.test(step.navigationInstruction)) {
    return true;
  }

  const maneuver = step.maneuver ?? "";
  if (RAMP_MANEUVERS.has(maneuver) && step.distanceMeters >= 500) {
    return true;
  }

  if (STRAIGHT_MANEUVERS.has(maneuver) && step.distanceMeters >= 2000) {
    return true;
  }

  if (stepSpeedMph !== undefined && stepSpeedMph >= 55) {
    return true;
  }

  return false;
}

export function computeHighwayShare(
  steps: RouteStep[],
  stepSpeedsMph?: Map<number, number>
): HighwayResult {
  let totalMeters = 0;
  let highwayMeters = 0;

  steps.forEach((step, index) => {
    const distance = step.distanceMeters;
    if (distance <= 0) return;

    totalMeters += distance;
    const speed = stepSpeedsMph?.get(index);
    if (isHighwayStep(step, speed)) {
      highwayMeters += distance;
    }
  });

  const highwayShare = totalMeters > 0 ? highwayMeters / totalMeters : 0;
  const subscore = 1 - highwayShare;

  return { highwayShare, subscore };
}
