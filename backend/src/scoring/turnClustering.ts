import type { RouteStep } from "../types.js";
import { smoothstep } from "./smoothstep.js";

export interface TurnClusterResult {
  turnCount: number;
  closeTurnPairs: number;
  turnClusterCount: number;
  exponentialSpacing: number;
  turnSpacingPressure: number;
  peakDecisionsPerMile: number;
  sharpTurnCount: number;
  subscore: number;
}

/** Turns within this distance count as close together. */
export const TURN_CLUSTER_WINDOW_METERS = 400;

/** Distance decay constant (meters) for turn spacing penalty. */
export const TURN_TAU_METERS = 600;

/** Gap beyond which a new turn cluster starts. */
export const TURN_CLUSTER_GAP_METERS = 800;

export const TURN_CLUSTER_COEFFICIENTS = {
  c1: 0.2,
  c2: 0.25,
  c3: 0.35,
  c4: 0.2,
} as const;

const EXCLUDED = new Set(["DEPART", "STRAIGHT", "NAME_CHANGE", "MERGE", "RAMP_LEFT", "RAMP_RIGHT"]);

interface TurnEvent {
  distanceMeters: number;
  maneuver: string;
  isSharp: boolean;
}

function isTurnManeuver(maneuver: string): boolean {
  if (!maneuver || EXCLUDED.has(maneuver)) return false;
  return (
    maneuver.startsWith("TURN_") ||
    maneuver.startsWith("FORK_") ||
    maneuver.startsWith("ROUNDABOUT_") ||
    maneuver.startsWith("UTURN_")
  );
}

function isSharpManeuver(maneuver: string): boolean {
  return (
    maneuver.includes("SHARP") ||
    maneuver.startsWith("UTURN_") ||
    maneuver.startsWith("ROUNDABOUT_")
  );
}

function collectTurnEvents(steps: RouteStep[]): TurnEvent[] {
  const events: TurnEvent[] = [];
  let cumulative = 0;

  for (const step of steps) {
    cumulative += step.distanceMeters;
    const maneuver = step.maneuver ?? "";
    if (isTurnManeuver(maneuver)) {
      events.push({
        distanceMeters: cumulative,
        maneuver,
        isSharp: isSharpManeuver(maneuver),
      });
    }
  }

  return events;
}

function countCloseTurnPairs(events: TurnEvent[]): number {
  let pairs = 0;
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].distanceMeters - events[i - 1].distanceMeters;
    if (gap <= TURN_CLUSTER_WINDOW_METERS) pairs++;
  }
  return pairs;
}

function countTurnClusters(events: TurnEvent[]): number {
  if (events.length < 2) return 0;

  let clusters = 0;
  let clusterSize = 1;

  for (let i = 1; i < events.length; i++) {
    const gap = events[i].distanceMeters - events[i - 1].distanceMeters;
    if (gap > TURN_CLUSTER_GAP_METERS) {
      if (clusterSize >= 2) clusters++;
      clusterSize = 1;
    } else {
      clusterSize++;
    }
  }
  if (clusterSize >= 2) clusters++;

  return clusters;
}

function exponentialSpacingSum(events: TurnEvent[], tau: number): number {
  if (events.length <= 1) return events.length > 0 ? 0.5 : 0;

  let sum = 0;
  for (let i = 1; i < events.length; i++) {
    const d = events[i].distanceMeters - events[i - 1].distanceMeters;
    sum += Math.exp(-d / tau);
  }
  return sum;
}

function computePeakDecisionsPerMile(steps: RouteStep[]): number {
  const windowMeters = 800;
  const events: Array<{ distanceMeters: number }> = [];
  let cumulative = 0;

  for (const step of steps) {
    cumulative += step.distanceMeters;
    const maneuver = step.maneuver ?? "";
    if (maneuver && !EXCLUDED.has(maneuver)) {
      events.push({ distanceMeters: cumulative });
    }
  }

  if (events.length === 0) return 0;

  let maxDensity = 0;
  for (let i = 0; i < events.length; i++) {
    const windowStart = events[i].distanceMeters;
    const windowEnd = windowStart + windowMeters;
    let decisions = 0;
    for (let j = i; j < events.length; j++) {
      if (events[j].distanceMeters <= windowEnd) decisions++;
      else break;
    }
    const miles = windowMeters / 1609.34;
    maxDensity = Math.max(maxDensity, decisions / miles);
  }

  return maxDensity;
}

export function computeTurnClustering(
  steps: RouteStep[],
  distanceMeters: number
): TurnClusterResult {
  const events = collectTurnEvents(steps);
  const turnCount = events.length;
  const closeTurnPairs = countCloseTurnPairs(events);
  const turnClusterCount = countTurnClusters(events);
  const exponentialSpacing = exponentialSpacingSum(events, TURN_TAU_METERS);
  const peakDecisionsPerMile = computePeakDecisionsPerMile(steps);
  const sharpTurnCount = events.filter((e) => e.isSharp).length;

  const distanceMiles = distanceMeters / 1609.34;
  const turnDensity = distanceMiles > 0 ? turnCount / distanceMiles : 0;

  const turnSpacingPressure = smoothstep(
    (closeTurnPairs * 0.4 + exponentialSpacing * 0.3 + turnClusterCount * 0.5) / 3
  );

  const raw =
    TURN_CLUSTER_COEFFICIENTS.c1 * closeTurnPairs +
    TURN_CLUSTER_COEFFICIENTS.c2 * turnClusterCount +
    TURN_CLUSTER_COEFFICIENTS.c3 * exponentialSpacing +
    TURN_CLUSTER_COEFFICIENTS.c4 * smoothstep(turnDensity * 2);

  const subscore = smoothstep(raw / 1.7);

  return {
    turnCount,
    closeTurnPairs,
    turnClusterCount,
    exponentialSpacing,
    turnSpacingPressure,
    peakDecisionsPerMile,
    sharpTurnCount,
    subscore,
  };
}
