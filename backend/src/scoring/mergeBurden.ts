import type { RouteStep } from "../types.js";
import { smoothstep } from "./smoothstep.js";

export interface MergeBurdenResult {
  mergeCount: number;
  weaveCount: number;
  rampCount: number;
  exponentialSpacing: number;
  mergeClusterCount: number;
  rampDensity: number;
  interchangeDensity: number;
  weaveScore: number;
  weaveSectionScore: number;
  subscore: number;
}

/** Distance decay constant (meters) for merge spacing penalty. */
export const MERGE_TAU_METERS = 800;

export const MERGE_COEFFICIENTS = {
  b1: 0.18,
  b2: 0.22,
  b3: 0.35,
  b4: 0.15,
  b5: 0.1,
} as const;

const MERGE_MANEUVERS = new Set(["MERGE", "RAMP_LEFT", "RAMP_RIGHT"]);
const WEAVE_WINDOW_METERS = 500;

interface MergeEvent {
  distanceMeters: number;
  maneuver: string;
}

function collectMergeEvents(steps: RouteStep[]): MergeEvent[] {
  const events: MergeEvent[] = [];
  let cumulative = 0;

  for (const step of steps) {
    cumulative += step.distanceMeters;
    const maneuver = step.maneuver ?? "";
    if (MERGE_MANEUVERS.has(maneuver)) {
      events.push({ distanceMeters: cumulative, maneuver });
    }
  }

  return events;
}

function countWeaves(events: MergeEvent[]): number {
  let weaves = 0;
  for (let i = 1; i < events.length; i++) {
    const gap = events[i].distanceMeters - events[i - 1].distanceMeters;
    if (gap <= WEAVE_WINDOW_METERS) weaves++;
  }
  return weaves;
}

function countMergeClusters(events: MergeEvent[]): number {
  if (events.length < 2) return 0;

  let clusters = 0;
  let clusterSize = 1;

  for (let i = 1; i < events.length; i++) {
    const gap = events[i].distanceMeters - events[i - 1].distanceMeters;
    if (gap > WEAVE_WINDOW_METERS * 2) {
      if (clusterSize >= 2) clusters++;
      clusterSize = 1;
    } else {
      clusterSize++;
    }
  }
  if (clusterSize >= 2) clusters++;

  return clusters;
}

function exponentialSpacingSum(events: MergeEvent[], tau: number): number {
  if (events.length <= 1) return events.length;

  let sum = 0;
  for (let i = 1; i < events.length; i++) {
    const d = events[i].distanceMeters - events[i - 1].distanceMeters;
    sum += Math.exp(-d / tau);
  }
  return sum + 1;
}

export function computeMergeBurden(
  steps: RouteStep[],
  distanceMeters: number,
  trafficRatio: number
): MergeBurdenResult {
  const delayRatio = Math.max(0, trafficRatio - 1);
  const events = collectMergeEvents(steps);
  const mergeCount = events.filter((e) => e.maneuver === "MERGE").length;
  const rampCount = events.filter((e) => e.maneuver.startsWith("RAMP_")).length;
  const weaveCount = countWeaves(events);
  const mergeClusterCount = countMergeClusters(events);
  const exponentialSpacing = exponentialSpacingSum(events, MERGE_TAU_METERS);

  const distanceMiles = distanceMeters / 1609.34;
  const rampDensity = distanceMiles > 0 ? (mergeCount + rampCount) / distanceMiles : 0;
  const interchangeDensity = rampDensity;
  const weaveScore = smoothstep(weaveCount / 4);
  const mergeTraffic = smoothstep(delayRatio / 0.25);

  const raw =
    MERGE_COEFFICIENTS.b1 * mergeCount +
    MERGE_COEFFICIENTS.b2 * weaveCount +
    MERGE_COEFFICIENTS.b3 * exponentialSpacing +
    MERGE_COEFFICIENTS.b4 * rampDensity * 6 +
    MERGE_COEFFICIENTS.b5 * mergeTraffic;

  const subscore = smoothstep(raw / 2.5);

  return {
    mergeCount,
    weaveCount,
    rampCount,
    exponentialSpacing,
    mergeClusterCount,
    rampDensity,
    interchangeDensity,
    weaveScore,
    weaveSectionScore: weaveScore,
    subscore,
  };
}
