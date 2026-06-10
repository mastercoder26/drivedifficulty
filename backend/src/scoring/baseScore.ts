import type { RouteFeatures } from "./features.js";
import { smoothstep } from "./smoothstep.js";

export interface BaseScoreComponents {
  S: number;
  M: number;
  T: number;
  C: number;
  L: number;
  /** Road context: road size/class, surface, construction (0–1). */
  R: number;
  /** Weather severity at drive time (0–1). */
  W: number;
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

/**
 * Turn difficulty is dominated by *which* turns a route has, not how many.
 * Unprotected left turns (crossing oncoming traffic with no signal) are the
 * hardest single maneuver; sharp turns, U-turns and tight clusters follow.
 * Raw maneuver counts only contribute a small residual weight, so a route
 * with many easy protected turns stays cheap.
 */
export function computeTurnComponent(features: RouteFeatures): number {
  const unprotectedLefts = smoothstep(features.unprotectedLeftTurns / 4);
  const sharpTurns = smoothstep(features.sharpTurnCount / 3);
  const turnCluster = features.turnClusterSubscore;
  const decisionDensity = smoothstep(features.decisionPointDensity / 4);
  const maneuverIntensity = smoothstep(features.maneuversPer10Mi / 8);
  const navDensity = smoothstep(features.stepsPerMile / 1.2);
  return Math.min(
    1,
    unprotectedLefts * 0.32 +
      sharpTurns * 0.16 +
      turnCluster * 0.22 +
      decisionDensity * 0.14 +
      maneuverIntensity * 0.1 +
      navDensity * 0.06
  );
}

export function computeTrafficComponent(features: RouteFeatures): number {
  return smoothstep(features.delayRatio / 0.35);
}

/**
 * Length burden keeps growing for very long drives instead of saturating
 * around 3 hours: the first term covers typical trips, the second keeps
 * separating 4h vs 8h hauls.
 */
export function computeLengthComponent(features: RouteFeatures): number {
  const duration =
    smoothstep(features.durationHours / 3) * 0.7 +
    smoothstep((features.durationHours - 2.5) / 5.5) * 0.3;
  const highwayRun = smoothstep(features.longestHighwaySegmentMiles / 50);
  const monotony = features.monotonyScore;
  return Math.min(1, duration * 0.6 + highwayRun * 0.2 + monotony * 0.2);
}

/** Road context burden: small/narrow roads, unpaved surface, construction. */
export function computeRoadComponent(features: RouteFeatures): number {
  return Math.min(
    1,
    features.roadSizeScore * 0.5 +
      smoothstep(features.unpavedShare / 0.3) * 0.2 +
      features.constructionSeverity * 0.3
  );
}

/** Weather burden, amplified when bad weather coincides with high speeds. */
export function computeWeatherComponent(features: RouteFeatures): number {
  const highSpeedExposure =
    features.fractionAbove45Mph * 0.5 + features.fractionAbove60Mph * 0.5;
  return Math.min(
    1,
    features.weatherSeverity * (0.8 + 0.35 * highSpeedExposure)
  );
}

export function computeBaseScore(features: RouteFeatures): BaseScoreComponents {
  const S = computeSpeedComponent(features);
  const M = features.mergeBurdenSubscore;
  const T = computeTurnComponent(features);
  const C = computeTrafficComponent(features);
  const L = computeLengthComponent(features);
  const R = computeRoadComponent(features);
  const W = computeWeatherComponent(features);

  // Weather and road context are additive on top of the structural base so
  // that routes scored without live conditions keep a stable baseline.
  const D_base = Math.min(
    1,
    BASE_SCORE_WEIGHTS.S * S +
      BASE_SCORE_WEIGHTS.M * M +
      BASE_SCORE_WEIGHTS.T * T +
      BASE_SCORE_WEIGHTS.C * C +
      BASE_SCORE_WEIGHTS.L * L +
      0.1 * R +
      0.12 * W
  );

  return { S, M, T, C, L, R, W, D_base };
}
