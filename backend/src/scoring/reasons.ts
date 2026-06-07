import type { ScoringBreakdown, ScoringContext } from "../types.js";
import type { BaseScoreComponents } from "./baseScore.js";
import type { FatigueResult } from "./fatigue.js";
import { durationBurden, fatigueSubscore } from "./fatigue.js";
import type { RouteFeatures } from "./features.js";
import { computeSustainedEffortFromHours } from "./sustainedEffort.js";
import { smoothstep } from "./smoothstep.js";

const FACTOR_REASONS: Array<{
  key: keyof ScoringBreakdown;
  threshold: number;
  message: string;
}> = [
  { key: "speed", threshold: 0.55, message: "High-speed environment" },
  { key: "merges", threshold: 0.5, message: "Complex merges/exchanges" },
  { key: "turns", threshold: 0.55, message: "Many turns" },
  { key: "traffic", threshold: 0.5, message: "Heavy traffic" },
  { key: "length", threshold: 0.55, message: "Long drive" },
  { key: "fatigue", threshold: 0.45, message: "Fatigue-sensitive timing" },
];

const WEIGHTS: Record<string, number> = {
  speed: 0.3,
  merges: 0.25,
  turns: 0.15,
  traffic: 0.15,
  length: 0.15,
  fatigue: 0.1,
};

export function generateReasons(
  ctx: ScoringContext,
  features?: RouteFeatures,
  base?: BaseScoreComponents,
  fatigue?: FatigueResult
): string[] {
  const reasons: Array<{ text: string; weight: number }> = [];

  for (const rule of FACTOR_REASONS) {
    const value = ctx.breakdown[rule.key] ?? 0;
    if (value >= rule.threshold) {
      reasons.push({ text: rule.message, weight: (WEIGHTS[rule.key] ?? 0.1) * value });
    }
  }

  if (!features) {
    return dedupeAndLimit(reasons);
  }

  if (features.weaveCount >= 2) {
    reasons.push({ text: "Weaving between exits", weight: 0.24 });
  }

  if (features.mergeClusterCount >= 2) {
    reasons.push({ text: "Clustered interchanges", weight: 0.22 });
  } else if (features.exponentialSpacing > 2.5 && features.mergeCount >= 2) {
    reasons.push({ text: "Merges close together", weight: 0.2 });
  }

  if (features.turnClusterCount >= 1) {
    reasons.push({ text: "Turns close together", weight: 0.21 });
  }

  if (features.closeTurnPairs >= 2) {
    reasons.push({ text: "Back-to-back turns", weight: 0.23 });
  }

  if (features.decisionPointDensity >= 3) {
    reasons.push({ text: "Dense decision windows", weight: 0.19 });
  }

  if (features.laneChangeUrgency >= 0.4) {
    reasons.push({ text: "Frequent lane changes", weight: 0.18 });
  }

  if (features.leftTurnCount >= 4) {
    reasons.push({ text: "Multiple left turns", weight: 0.17 });
  }

  if (features.sharpTurnCount >= 2) {
    reasons.push({ text: "Sharp turns or U-turns", weight: 0.2 });
  }

  const sustained = computeSustainedEffortFromHours(features.durationHours).subscore;
  if (sustained >= 0.5 && features.durationHours >= 2) {
    reasons.push({ text: "Sustained attention required", weight: 0.16 });
  }

  if (features.monotonyScore >= 0.4 && features.durationHours >= 1.5) {
    reasons.push({ text: "Long monotonous stretch", weight: 0.15 });
  }

  if (ctx.highwayShare >= 0.65) {
    reasons.push({ text: "Mostly highway", weight: 0.12 });
  } else if (ctx.highwayShare <= 0.2) {
    reasons.push({ text: "Mostly local roads", weight: 0.18 });
  }

  if (
    ctx.highwayShare < 0.25 &&
    ctx.maneuversPer10Mi >= 8 &&
    !reasons.some((r) => r.text === "Many turns")
  ) {
    reasons.push({ text: "Urban grid navigation", weight: 0.2 });
  }

  if (ctx.delayRatio >= 0.2) {
    reasons.push({
      text: ctx.delayRatio >= 0.35 ? "Heavy traffic" : "Moderate traffic",
      weight: 0.15 + ctx.delayRatio,
    });
  }

  if (ctx.durationHours >= 2.5) {
    reasons.push({ text: "Long sustained drive", weight: 0.14 });
  }

  if (fatigue && fatigue.circadianPenalty > 0.5) {
    reasons.push({ text: "Late-night driving window", weight: 0.16 });
  }

  if (fatigue && fatigue.sleepPenalty > 0.35) {
    reasons.push({ text: "Low sleep increases difficulty", weight: 0.17 });
  }

  if (features.segmentMaxDifficulty >= 0.6) {
    reasons.push({ text: "Demanding segment hotspot", weight: 0.19 });
  }

  return dedupeAndLimit(reasons);
}

function dedupeAndLimit(reasons: Array<{ text: string; weight: number }>): string[] {
  reasons.sort((a, b) => b.weight - a.weight);
  const unique: string[] = [];
  for (const r of reasons) {
    if (!unique.includes(r.text)) unique.push(r.text);
    if (unique.length >= 6) break;
  }
  return unique;
}
