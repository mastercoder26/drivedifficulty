import type { ParsedRoute } from "../types.js";
import { computeHighwayShare, isHighwayStep } from "./highway.js";
import { computeManeuverComplexity } from "./maneuvers.js";
import { computeMergeBurden } from "./mergeBurden.js";
import { aggregateSegmentScores, type SegmentAggregateResult } from "./segmentAggregate.js";
import type { RouteSegment } from "./segments.js";
import { segmentRoute } from "./segments.js";

export interface RouteFeatures {
  meanSpeedMph: number;
  maxSpeedMph: number;
  fractionAbove45Mph: number;
  fractionAbove60Mph: number;
  durationMinutes: number;
  durationHours: number;
  distanceMiles: number;
  stepCount: number;
  turnDensity: number;
  leftTurnCount: number;
  rampCount: number;
  mergeCount: number;
  interchangeDensity: number;
  exponentialSpacing: number;
  mergeClusterCount: number;
  weaveSectionScore: number;
  mergeBurdenSubscore: number;
  trafficRatio: number;
  trafficVariance: number;
  nighttimeShare: number;
  urbanShare: number;
  highwayShare: number;
  longestHighwaySegmentMiles: number;
  monotonyScore: number;
  decisionPointDensity: number;
  segmentP90Difficulty: number;
  segmentMaxDifficulty: number;
  segmentMeanDifficulty: number;
  segmentAggregated: number;
  laneChangeUrgency: number;
  maneuversPer10Mi: number;
  stepsPerMile: number;
  delayRatio: number;
}

export interface BuildFeaturesInput {
  route: ParsedRoute;
  segments: RouteSegment[];
  stepSpeedsMph?: Map<number, number>;
  departureTime?: string;
}

function isNightHour(date: Date): boolean {
  const h = date.getUTCHours();
  return h >= 20 || h < 6;
}

function computeSpeedStats(
  route: ParsedRoute,
  stepSpeedsMph?: Map<number, number>
): Pick<
  RouteFeatures,
  "meanSpeedMph" | "maxSpeedMph" | "fractionAbove45Mph" | "fractionAbove60Mph"
> {
  let totalMeters = 0;
  let weightedSpeed = 0;
  let maxSpeed = 0;
  let above45 = 0;
  let above60 = 0;

  route.steps.forEach((step, i) => {
    const dist = step.distanceMeters;
    if (dist <= 0) return;
    totalMeters += dist;

    let speed =
      stepSpeedsMph?.get(i) ??
      (step.staticDurationSeconds > 0
        ? (dist / 1609.34) / (step.staticDurationSeconds / 3600)
        : 0);

    weightedSpeed += speed * dist;
    maxSpeed = Math.max(maxSpeed, speed);
    if (speed >= 45) above45 += dist;
    if (speed >= 60) above60 += dist;
  });

  const meanSpeedMph = totalMeters > 0 ? weightedSpeed / totalMeters : 0;
  return {
    meanSpeedMph,
    maxSpeedMph: maxSpeed,
    fractionAbove45Mph: totalMeters > 0 ? above45 / totalMeters : 0,
    fractionAbove60Mph: totalMeters > 0 ? above60 / totalMeters : 0,
  };
}

function longestHighwayRunMiles(
  route: ParsedRoute,
  stepSpeedsMph?: Map<number, number>
): number {
  let longest = 0;
  let current = 0;
  route.steps.forEach((step, i) => {
    if (isHighwayStep(step, stepSpeedsMph?.get(i))) {
      current += step.distanceMeters / 1609.34;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  });
  return longest;
}

function computeNighttimeShare(
  segments: RouteSegment[],
  departureTime?: string
): number {
  if (!departureTime || segments.length === 0) return 0;
  const start = new Date(departureTime);
  if (Number.isNaN(start.getTime())) return 0;

  let nightSeconds = 0;
  let totalSeconds = 0;
  for (const seg of segments) {
    totalSeconds += seg.durationSeconds;
    const mid = new Date(start.getTime() + (seg.cumulativeSecondsFromStart + seg.durationSeconds / 2) * 1000);
    if (isNightHour(mid)) nightSeconds += seg.durationSeconds;
  }
  return totalSeconds > 0 ? nightSeconds / totalSeconds : 0;
}

function computeDecisionPointDensity(segments: RouteSegment[]): number {
  const windowSeconds = 300;
  let maxDensity = 0;

  for (const seg of segments) {
    const windowStart = seg.cumulativeSecondsFromStart;
    const windowEnd = windowStart + windowSeconds;
    let decisions = 0;
    let miles = 0;

    for (const other of segments) {
      const segMid = other.cumulativeSecondsFromStart + other.durationSeconds / 2;
      if (segMid >= windowStart && segMid <= windowEnd) {
        decisions += other.maneuvers.length;
        miles += other.distanceMeters / 1609.34;
      }
    }
    if (miles > 0) {
      maxDensity = Math.max(maxDensity, decisions / miles);
    }
  }
  return maxDensity;
}

function computeMonotony(
  highwayShare: number,
  longestHighwaySegmentMiles: number,
  durationHours: number
): number {
  if (highwayShare < 0.5) return 0;
  return Math.min(
    1,
    (longestHighwaySegmentMiles / 40) * 0.5 + (durationHours / 4) * 0.5
  );
}

function computeLaneChangeUrgency(segments: RouteSegment[]): number {
  let urgency = 0;
  for (const seg of segments) {
    const mergeLike = seg.maneuvers.filter(
      (m) => m === "MERGE" || m.startsWith("RAMP_") || m.startsWith("FORK_")
    ).length;
    if (mergeLike >= 2) urgency += 0.25;
    else if (mergeLike === 1 && seg.impliedSpeedMph >= 55) urgency += 0.15;
  }
  return Math.min(1, urgency / Math.max(1, segments.length * 0.08));
}

export function buildFeatures(input: BuildFeaturesInput): RouteFeatures {
  const { route, segments, stepSpeedsMph, departureTime } = input;
  const speedStats = computeSpeedStats(route, stepSpeedsMph);
  const { highwayShare } = computeHighwayShare(route.steps, stepSpeedsMph);
  const maneuvers = computeManeuverComplexity(route.steps, route.distanceMeters);
  const trafficRatio =
    route.staticDurationSeconds > 0
      ? route.durationSeconds / route.staticDurationSeconds
      : 1;
  const delayRatio = Math.max(0, trafficRatio - 1);
  const merge = computeMergeBurden(route.steps, route.distanceMeters, trafficRatio);
  const segmentAgg: SegmentAggregateResult = aggregateSegmentScores(segments);

  let leftTurnCount = 0;
  for (const step of route.steps) {
    const m = step.maneuver ?? "";
    if (m.includes("LEFT") && m.startsWith("TURN")) leftTurnCount++;
  }

  const distanceMiles = route.distanceMeters / 1609.34;
  const durationHours = route.staticDurationSeconds / 3600;
  const longestHighwaySegmentMiles = longestHighwayRunMiles(route, stepSpeedsMph);
  const urbanShare = 1 - highwayShare;
  const stepsPerMile = distanceMiles > 0 ? route.steps.length / distanceMiles : 0;
  const turnDensity = distanceMiles > 0 ? maneuvers.weightedCount / distanceMiles : 0;

  const segmentSpeedRatios = segments.map((s) =>
    s.durationSeconds > 0 ? s.impliedSpeedMph / 55 : 1
  );
  const meanSpeedRatio =
    segmentSpeedRatios.reduce((a, b) => a + b, 0) / Math.max(1, segmentSpeedRatios.length);
  const trafficVariance = Math.min(
    1,
    segmentSpeedRatios.reduce((acc, r) => acc + Math.abs(r - meanSpeedRatio), 0) /
      Math.max(1, segmentSpeedRatios.length)
  );

  return {
    ...speedStats,
    durationMinutes: route.staticDurationSeconds / 60,
    durationHours,
    distanceMiles,
    stepCount: route.steps.length,
    turnDensity,
    leftTurnCount,
    rampCount: merge.rampCount,
    mergeCount: merge.mergeCount,
    interchangeDensity: merge.interchangeDensity,
    exponentialSpacing: merge.exponentialSpacing,
    mergeClusterCount: merge.mergeClusterCount,
    weaveSectionScore: merge.weaveSectionScore,
    mergeBurdenSubscore: merge.subscore,
    trafficRatio,
    trafficVariance: trafficVariance * (1 + delayRatio),
    nighttimeShare: computeNighttimeShare(segments, departureTime),
    urbanShare,
    highwayShare,
    longestHighwaySegmentMiles,
    monotonyScore: computeMonotony(highwayShare, longestHighwaySegmentMiles, durationHours),
    decisionPointDensity: computeDecisionPointDensity(segments),
    segmentP90Difficulty: segmentAgg.p90,
    segmentMaxDifficulty: segmentAgg.max,
    segmentMeanDifficulty: segmentAgg.mean,
    segmentAggregated: segmentAgg.aggregated,
    laneChangeUrgency: computeLaneChangeUrgency(segments),
    maneuversPer10Mi: maneuvers.maneuversPer10Mi,
    stepsPerMile,
    delayRatio,
  };
}

export function featuresToVector(features: RouteFeatures): number[] {
  return [
    features.meanSpeedMph,
    features.maxSpeedMph,
    features.fractionAbove45Mph,
    features.fractionAbove60Mph,
    features.durationMinutes,
    features.distanceMiles,
    features.stepCount,
    features.turnDensity,
    features.leftTurnCount,
    features.rampCount,
    features.mergeCount,
    features.interchangeDensity,
    features.exponentialSpacing,
    features.mergeClusterCount,
    features.weaveSectionScore,
    features.trafficRatio,
    features.trafficVariance,
    features.nighttimeShare,
    features.urbanShare,
    features.highwayShare,
    features.longestHighwaySegmentMiles,
    features.monotonyScore,
    features.decisionPointDensity,
    features.segmentP90Difficulty,
    features.segmentMaxDifficulty,
    features.laneChangeUrgency,
    features.maneuversPer10Mi,
    features.stepsPerMile,
    features.delayRatio,
  ];
}

export function buildFeaturesFromRoute(
  route: ParsedRoute,
  options: {
    stepSpeedsMph?: Map<number, number>;
    departureTime?: string;
  } = {}
): { segments: RouteSegment[]; features: RouteFeatures } {
  const segments = segmentRoute(route, options.stepSpeedsMph);
  const features = buildFeatures({
    route,
    segments,
    stepSpeedsMph: options.stepSpeedsMph,
    departureTime: options.departureTime,
  });
  return { segments, features };
}
