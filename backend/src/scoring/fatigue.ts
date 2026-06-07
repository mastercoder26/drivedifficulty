import type { DriverContext } from "../types.js";
import type { RouteFeatures } from "./features.js";
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
  a1: 0.35,
  a2: 0.25,
  a3: 0.25,
  a4: 0.15,
} as const;

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
    FATIGUE_COEFFICIENTS.a1 * Math.log1p(durationMinutes / 30) +
    FATIGUE_COEFFICIENTS.a2 * circadian +
    FATIGUE_COEFFICIENTS.a3 * sleep +
    FATIGUE_COEFFICIENTS.a4 * continuous;

  const tiredFactor = smoothstep((sleep + continuous + circadian * 0.5) / 2);

  let D_interaction = 0;
  D_interaction += tiredFactor * features.monotonyScore * 0.35;
  D_interaction += tiredFactor * features.nighttimeShare * 0.3;
  D_interaction +=
    tiredFactor * features.mergeBurdenSubscore * features.weaveSectionScore * 0.4;

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
  const fatigueNorm = smoothstep(fatigue.D_fatigue / 2.2);
  const interactionNorm = smoothstep(fatigue.D_interaction * 2);

  let workload =
    0.48 * D_route +
    0.28 * D_base +
    0.14 * fatigueNorm +
    0.1 * interactionNorm;

  if (features.highwayShare >= 0.65 && D_route < 0.32) {
    workload -= 0.1;
  }

  if (features.highwayShare < 0.25 && features.maneuversPer10Mi >= 8) {
    workload += 0.12 + smoothstep((features.maneuversPer10Mi - 8) / 14) * 0.12;
  }

  if (features.stepsPerMile >= 3.5) {
    workload += 0.04;
  }

  if (features.mergeClusterCount >= 1) {
    workload += 0.06 + features.segmentP90Difficulty * 0.12;
  }

  workload += features.exponentialSpacing * 0.015;

  const trafficPoints = smoothstep(features.delayRatio / 0.35) * 2.4;
  return Math.min(10, Math.max(0, workload * 10 + trafficPoints));
}

export function fatigueSubscore(fatigue: FatigueResult): number {
  return smoothstep(fatigue.D_fatigue / 1.5);
}
