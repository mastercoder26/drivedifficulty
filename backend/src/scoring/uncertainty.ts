import type { RouteFeatures } from "./features.js";
import type { ScoreUncertainty } from "../types.js";

export function estimateUncertainty(
  features: RouteFeatures,
  residualMagnitude = 0
): ScoreUncertainty {
  let spread = 0.35;

  if (features.mergeClusterCount >= 2) spread += 0.15;
  if (features.durationHours >= 3) spread += 0.1;
  if (features.stepCount < 5) spread += 0.2;
  if (features.exponentialSpacing > 2) spread += 0.1;
  spread += Math.min(0.5, residualMagnitude * 0.2);

  const confidence = Math.max(0.35, Math.min(0.95, 1 - spread / 2));
  return {
    low: 0,
    high: 0,
    confidence,
    spread,
  };
}

export function applyUncertaintyBand(
  score: number,
  uncertainty: ScoreUncertainty
): ScoreUncertainty {
  const half = uncertainty.spread / 2;
  return {
    ...uncertainty,
    low: Math.max(0, Math.round((score - half) * 10) / 10),
    high: Math.min(10, Math.round((score + half) * 10) / 10),
  };
}
