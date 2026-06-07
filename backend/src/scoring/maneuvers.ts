import type { RouteStep } from "../types.js";
import { smoothstep } from "./smoothstep.js";

export interface ManeuverResult {
  weightedCount: number;
  maneuversPer10Mi: number;
  subscore: number;
}

const EXCLUDED = new Set(["DEPART", "STRAIGHT", "NAME_CHANGE"]);

const MANEUVER_WEIGHTS: Record<string, number> = {
  TURN_SHARP_LEFT: 2.0,
  TURN_SHARP_RIGHT: 2.0,
  UTURN_LEFT: 2.0,
  UTURN_RIGHT: 2.0,
  ROUNDABOUT_LEFT: 2.0,
  ROUNDABOUT_RIGHT: 2.0,
  ROUNDABOUT_STRAIGHT: 2.0,
  ROUNDABOUT_U_TURN: 2.0,
  TURN_LEFT: 1.5,
  TURN_RIGHT: 1.5,
  FORK_LEFT: 1.5,
  FORK_RIGHT: 1.5,
  TURN_SLIGHT_LEFT: 1.0,
  TURN_SLIGHT_RIGHT: 1.0,
  RAMP_LEFT: 1.0,
  RAMP_RIGHT: 1.0,
  MERGE: 1.0,
};

function maneuverWeight(maneuver: string): number {
  if (maneuver.startsWith("TURN_SHARP_")) return 2.0;
  if (maneuver.startsWith("UTURN_")) return 2.0;
  if (maneuver.startsWith("ROUNDABOUT_")) return 2.0;
  if (maneuver.startsWith("FORK_")) return 1.5;
  if (maneuver.startsWith("TURN_SLIGHT_")) return 1.0;
  if (maneuver.startsWith("RAMP_")) return 1.0;
  return MANEUVER_WEIGHTS[maneuver] ?? 1.0;
}

export function computeManeuverComplexity(
  steps: RouteStep[],
  distanceMeters: number
): ManeuverResult {
  let weightedCount = 0;

  for (const step of steps) {
    const maneuver = step.maneuver ?? "";
    if (!maneuver || EXCLUDED.has(maneuver)) continue;
    weightedCount += maneuverWeight(maneuver);
  }

  const distanceMiles = distanceMeters / 1609.34;
  const maneuversPer10Mi =
    distanceMiles > 0 ? weightedCount / (distanceMiles / 10) : 0;
  // 6 weighted maneuvers per 10 miles = dense urban complexity (was 12, which under-scored urban routes)
  const subscore = smoothstep(maneuversPer10Mi / 6);

  return { weightedCount, maneuversPer10Mi, subscore };
}
