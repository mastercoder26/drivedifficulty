import type { DriverContext } from "../types.js";
import type { RouteFeatures } from "./features.js";
import { computeSustainedEffortFromHours } from "./sustainedEffort.js";
import { smoothstep } from "./smoothstep.js";

export interface FatigueResult {
  durationMinutes: number;
  circadianPenalty: number;
  sleepPenalty: number;
  continuousPenalty: number;
  D_fatigue: number;
  D_interaction: number;
}

export const FATIGUE_COEFFICIENTS = {
  a1: 0.45,
  a2: 0.25,
  a3: 0.25,
  a4: 0.15,
} as const;

/**
 * Trip-length burden independent of road complexity (0–1).
 * Grows quickly through the first ~3 hours and keeps climbing (instead of
 * saturating) so very long hauls remain clearly harder than medium trips.
 */
export function durationBurden(hours: number): number {
  if (hours <= 0.2) return 0;
  return Math.min(
    1,
    smoothstep((hours - 0.2) / 3.3) * 0.8 + smoothstep((hours - 3.5) / 6) * 0.2
  );
}

/**
 * Direct score points (0–10 scale) contributed by trip duration alone.
 * A short hop adds ~0, a 2h trip ~1.3, a 4h trip ~3, an 8h haul ~4.3.
 */
export function durationPoints(hours: number): number {
  return 3.2 * smoothstep(hours / 4.5) + 1.2 * smoothstep((hours - 4) / 6);
}

function circadianPenalty(departureTime?: Date): number {
  if (!departureTime) return 0;
  const hour = departureTime.getHours();
  if (hour >= 0 && hour < 6) return 1.0;
  if (hour >= 22) return 0.85;
  if (hour >= 15 && hour < 18) return 0.35;
  if (hour >= 6 && hour < 8) return 0.4;
  return 0.1;
}

function sleepPenalty(hoursSlept: number): number {
  const deficit = Math.max(0, 7 - hoursSlept);
  return smoothstep(deficit / 4);
}

function continuousDrivePenalty(
  continuousDriveMinutes: number,
  routeMinutes: number
): number {
  const prior = Math.max(0, continuousDriveMinutes - routeMinutes);
  return smoothstep(Math.log1p(prior / 30) / Math.log1p(4));
}

export function computeFatigue(
  features: RouteFeatures,
  ctx: DriverContext
): FatigueResult {
  const durationMinutes = features.durationHours * 60;
  const circadian = circadianPenalty(ctx.departureTime);
  const sleep = sleepPenalty(ctx.hoursSlept);
  const continuous = continuousDrivePenalty(
    ctx.continuousDriveMinutes,
    durationMinutes
  );

  const D_fatigue =
    FATIGUE_COEFFICIENTS.a1 * Math.log1p(durationMinutes / 20) +
    FATIGUE_COEFFICIENTS.a2 * circadian +
    FATIGUE_COEFFICIENTS.a3 * sleep +
    FATIGUE_COEFFICIENTS.a4 * continuous;

  const tiredFactor = smoothstep((sleep + continuous + circadian * 0.5) / 2);

  let D_interaction = 0;
  D_interaction += tiredFactor * features.monotonyScore * 0.35;
  D_interaction += tiredFactor * features.nighttimeShare * 0.3;
  D_interaction +=
    tiredFactor * features.mergeBurdenSubscore * features.weaveSectionScore * 0.4;
  // Bad weather is disproportionately harder when tired or at night.
  D_interaction += tiredFactor * features.weatherSeverity * 0.35;
  D_interaction += features.nighttimeShare * features.weatherSeverity * 0.25;

  return {
    durationMinutes,
    circadianPenalty: circadian,
    sleepPenalty: sleep,
    continuousPenalty: continuous,
    D_fatigue,
    D_interaction,
  };
}

export function computeRawScore(
  D_route: number,
  D_base: number,
  fatigue: FatigueResult,
  features: RouteFeatures
): number {
  const fatigueNorm = smoothstep(fatigue.D_fatigue / 1.8);
  const interactionNorm = smoothstep(fatigue.D_interaction * 2);
  const sustained = computeSustainedEffortFromHours(features.durationHours).subscore;

  let workload =
    0.38 * D_route +
    0.22 * D_base +
    0.12 * fatigueNorm +
    0.08 * interactionNorm +
    0.12 * sustained;

  // Short highway hops are easier; long hauls still carry sustained-attention cost
  if (
    features.highwayShare >= 0.65 &&
    D_route < 0.32 &&
    features.durationHours < 0.75
  ) {
    workload -= 0.06;
  }

  if (features.highwayShare < 0.25 && features.maneuversPer10Mi >= 8) {
    workload += 0.12 + smoothstep((features.maneuversPer10Mi - 8) / 14) * 0.12;
  }

  if (features.stepsPerMile >= 3.5) {
    workload += 0.04;
  }

  if (features.mergeClusterCount >= 2 || features.weaveCount >= 1) {
    workload += 0.06 + features.segmentP90Difficulty * 0.12;
  }

  workload += features.exponentialSpacing * 0.015;

  if (features.turnClusterCount >= 1) {
    workload += 0.06 + features.segmentP90Difficulty * 0.12;
  }

  if (features.closeTurnPairs >= 3) {
    workload += 0.03 + smoothstep(features.turnSpacingPressure) * 0.04;
  }

  workload += smoothstep(features.decisionPointDensity / 5) * 0.06;
  workload += features.laneChangeUrgency * 0.05;

  if (features.monotonyScore > 0.25 && features.durationHours >= 1) {
    workload +=
      features.monotonyScore *
      smoothstep((features.durationHours - 0.5) / 2.5) *
      0.06;
  }

  let points = workload * 10;

  // Trip length is a first-class driver of difficulty: long hauls cost real
  // points even on easy roads.
  points += durationPoints(features.durationHours);

  // Unprotected left turns are the single hardest routine maneuver.
  points += smoothstep(features.unprotectedLeftTurns / 5) * 0.7;
  points += features.unprotectedTurnShare * 0.2;

  // Live conditions: weather at drive time, amplified by high-speed exposure
  // and nighttime driving.
  if (features.weatherSeverity > 0.05) {
    const highSpeedExposure =
      features.fractionAbove45Mph * 0.5 + features.fractionAbove60Mph * 0.5;
    const weatherPoints =
      features.weatherSeverity *
      (1.5 + 0.7 * highSpeedExposure + 0.5 * features.nighttimeShare);
    points += Math.min(2.6, weatherPoints);
    // Ice and snow add risk beyond plain rain.
    points += features.icyRisk * 0.5 + features.snowRisk * 0.4;
  }

  // Road context: narrow/unpaved roads and active construction zones.
  points += features.roadSizeScore * smoothstep(features.urbanShare) * 0.5;
  points += smoothstep(features.unpavedShare / 0.3) * 0.4;
  points += features.constructionSeverity * 0.8;

  const trafficPoints = smoothstep(features.delayRatio / 0.35) * 2.4;
  return Math.min(10, Math.max(0, points + trafficPoints));
}

export function fatigueSubscore(fatigue: FatigueResult): number {
  return smoothstep(fatigue.D_fatigue / 1.5);
}
