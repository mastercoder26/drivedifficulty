import type { RouteStep } from "../types.js";

// Matches interstate, US routes, and all 50 state abbreviation highway codes
const HIGHWAY_INSTRUCTION_RE =
  /\b(I-\d+|Interstate\s*\d+|US\s*-?\s*\d+|US\s*Hwy\s*\d+|(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)-\d+|State\s*(?:Hwy|Route|Rd)\s*\d+|Hwy|Highway|Freeway|Expressway|Motorway|Turnpike|Tollway|Beltway|Bypass)\b/i;

const RAMP_MANEUVERS = new Set(["RAMP_LEFT", "RAMP_RIGHT", "MERGE"]);
const STRAIGHT_MANEUVERS = new Set(["STRAIGHT", "NAME_CHANGE"]);

// Proportion of highway share that counts as baseline "high-speed alertness" difficulty.
// Even on a straight highway, 70 mph driving demands sustained attention.
const HIGHWAY_SPEED_BASELINE = 0.3;

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

  // U-shape: pure local roads = max difficulty (1.0), pure highway = baseline
  // difficulty for high-speed sustained driving (0.3), mixed = higher of the two.
  const subscore = Math.max(1 - highwayShare, highwayShare * HIGHWAY_SPEED_BASELINE);

  return { highwayShare, subscore };
}
