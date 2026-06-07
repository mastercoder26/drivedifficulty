import type { ParsedRoute, RouteStep } from "../types.js";
import { isHighwayStep } from "./highway.js";

export interface RouteSegment {
  index: number;
  stepIndices: number[];
  distanceMeters: number;
  durationSeconds: number;
  staticDurationSeconds: number;
  maneuvers: string[];
  cumulativeTimeSeconds: number;
  /** Alias used by feature engineering */
  cumulativeSecondsFromStart: number;
  isHighway: boolean;
  impliedSpeedMph: number;
  polyline?: string;
}

const TARGET_DURATION_SEC = 60;
const MIN_DISTANCE_M = 800; // ~0.5 mi
const MAX_DISTANCE_M = 1609; // ~1.0 mi

function stepDuration(step: RouteStep): number {
  return step.staticDurationSeconds > 0
    ? step.staticDurationSeconds
    : Math.max(1, step.distanceMeters / 15);
}

function mergeSegment(
  acc: Omit<RouteSegment, "index">,
  step: RouteStep,
  stepIndex: number,
  stepSpeedMph?: number
): Omit<RouteSegment, "index"> {
  const duration = stepDuration(step);
  const maneuver = step.maneuver ?? "";
  const highway = isHighwayStep(step, stepSpeedMph);

  return {
    stepIndices: [...acc.stepIndices, stepIndex],
    distanceMeters: acc.distanceMeters + step.distanceMeters,
    durationSeconds: acc.durationSeconds + duration,
    staticDurationSeconds: acc.staticDurationSeconds + step.staticDurationSeconds,
    maneuvers:
      maneuver && maneuver !== "DEPART" && maneuver !== "STRAIGHT"
        ? [...acc.maneuvers, maneuver]
        : acc.maneuvers,
    cumulativeTimeSeconds: acc.cumulativeTimeSeconds,
    cumulativeSecondsFromStart: acc.cumulativeTimeSeconds,
    isHighway: acc.isHighway && highway,
    impliedSpeedMph: 0,
    polyline: acc.polyline ?? step.polyline,
  };
}

function finalizeSegment(
  partial: Omit<RouteSegment, "index">,
  index: number
): RouteSegment {
  const hours = partial.durationSeconds / 3600;
  const miles = partial.distanceMeters / 1609.34;
  const impliedSpeedMph =
    hours > 0 ? miles / hours : partial.isHighway ? 65 : 25;

  return {
    index,
    ...partial,
    impliedSpeedMph,
    cumulativeSecondsFromStart: partial.cumulativeTimeSeconds,
  };
}

function shouldFlush(
  acc: Omit<RouteSegment, "index">,
  nextStep: RouteStep
): boolean {
  const nextDuration = stepDuration(nextStep);
  const wouldDuration = acc.durationSeconds + nextDuration;
  const wouldDistance = acc.distanceMeters + nextStep.distanceMeters;

  if (acc.distanceMeters === 0) return false;
  if (wouldDuration >= TARGET_DURATION_SEC * 1.5) return true;
  if (wouldDistance >= MAX_DISTANCE_M) return true;
  if (
    acc.durationSeconds >= TARGET_DURATION_SEC &&
    acc.distanceMeters >= MIN_DISTANCE_M
  ) {
    return true;
  }
  return false;
}

export function segmentRoute(
  routeOrSteps: ParsedRoute | RouteStep[],
  stepSpeedsMph?: Map<number, number>
): RouteSegment[] {
  const steps = Array.isArray(routeOrSteps) ? routeOrSteps : routeOrSteps.steps;
  const segments: RouteSegment[] = [];
  let acc: Omit<RouteSegment, "index"> | null = null;
  let cumulativeTime = 0;
  let segmentIndex = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.distanceMeters <= 0) continue;

    const speed = stepSpeedsMph?.get(i);

    if (!acc) {
      acc = mergeSegment(
        {
          stepIndices: [],
          distanceMeters: 0,
          durationSeconds: 0,
          staticDurationSeconds: 0,
          maneuvers: [],
          cumulativeTimeSeconds: cumulativeTime,
          cumulativeSecondsFromStart: cumulativeTime,
          isHighway: true,
          impliedSpeedMph: 0,
        },
        step,
        i,
        speed
      );
      continue;
    }

    if (shouldFlush(acc, step)) {
      segments.push(finalizeSegment(acc, segmentIndex++));
      cumulativeTime += acc.durationSeconds;
      acc = mergeSegment(
        {
          stepIndices: [],
          distanceMeters: 0,
          durationSeconds: 0,
          staticDurationSeconds: 0,
          maneuvers: [],
          cumulativeTimeSeconds: cumulativeTime,
          cumulativeSecondsFromStart: cumulativeTime,
          isHighway: true,
          impliedSpeedMph: 0,
        },
        step,
        i,
        speed
      );
    } else {
      acc = mergeSegment(acc, step, i, speed);
    }
  }

  if (acc && acc.distanceMeters > 0) {
    segments.push(finalizeSegment(acc, segmentIndex));
  }

  return segments;
}

export function scoreSegmentLocal(segment: RouteSegment): number {
  const miles = segment.distanceMeters / 1609.34;
  const maneuverDensity =
    miles > 0 ? segment.maneuvers.length / miles : segment.maneuvers.length;

  let score = 0.1;
  score += Math.min(0.35, maneuverDensity * 0.14);

  const mergeCount = segment.maneuvers.filter(
    (m) => m === "MERGE" || m.startsWith("RAMP_")
  ).length;
  score += Math.min(0.35, mergeCount * 0.12);

  if (segment.impliedSpeedMph >= 60 && mergeCount === 0) score += 0.04;
  if (!segment.isHighway) score += 0.18;

  const sharpTurns = segment.maneuvers.filter(
    (m) => m.includes("SHARP") || m.startsWith("UTURN")
  ).length;
  score += Math.min(0.2, sharpTurns * 0.1);

  return Math.max(0, Math.min(1, score));
}
