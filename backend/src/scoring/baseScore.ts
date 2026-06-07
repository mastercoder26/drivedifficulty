import type { RouteFeatures } from "./features.js";
import { smoothstep } from "./smoothstep.js";

export interface BaseScoreComponents {
  S: number;
  M: number;
  T: number;
  C: number;
  L: number;
  D_base: number;
}

export const BASE_SCORE_WEIGHTS = {
  S: 0.3,
  M: 0.25,
  T: 0.15,
  C: 0.15,
  L: 0.15,
} as const;

export function computeSpeedComponent(features: RouteFeatures): number {
  const localRoadBurden = smoothstep((1 - features.highwayShare) * 1.2);
  const highSpeedShare =
    features.fractionAbove45Mph * 0.4 + features.fractionAbove60Mph * 0.6;
  const speedIntensity = smoothstep(features.meanSpeedMph / 70);
  const monotonyBump = features.monotonyScore * 0.35;
  return Math.min(
    1,
    localRoadBurden * 0.45 +
      highSpeedShare * 0.25 +
      speedIntensity * 0.15 +
      monotonyBump
  );
}

export function computeTurnComponent(features: RouteFeatures): number {
  const maneuverIntensity = smoothstep(features.maneuversPer10Mi / 6);
  const turnDensity = smoothstep(features.turnDensity / 5);
  const leftTurns = smoothstep(features.leftTurnCount / 5);
  const navDensity = smoothstep(features.stepsPerMile / 1.2);
  return Math.min(
    1,
    maneuverIntensity * 0.45 +
      turnDensity * 0.25 +
      leftTurns * 0.15 +
      navDensity * 0.15
  );
}

export function computeTrafficComponent(features: RouteFeatures): number {
  return smoothstep(features.delayRatio / 0.35);
}

export function computeLengthComponent(features: RouteFeatures): number {
  const duration = smoothstep(features.durationHours / 2.5);
  const highwayRun = smoothstep(features.longestHighwaySegmentMiles / 50);
  const monotony = features.monotonyScore;
  return Math.min(1, duration * 0.5 + highwayRun * 0.25 + monotony * 0.25);
}

export function computeBaseScore(features: RouteFeatures): BaseScoreComponents {
  const S = computeSpeedComponent(features);
  const M = features.mergeBurdenSubscore;
  const T = computeTurnComponent(features);
  const C = computeTrafficComponent(features);
  const L = computeLengthComponent(features);

  const D_base =
    BASE_SCORE_WEIGHTS.S * S +
    BASE_SCORE_WEIGHTS.M * M +
    BASE_SCORE_WEIGHTS.T * T +
    BASE_SCORE_WEIGHTS.C * C +
    BASE_SCORE_WEIGHTS.L * L;

  return { S, M, T, C, L, D_base };
}
