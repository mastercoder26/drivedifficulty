import type { ParsedRoute, ScoringBreakdown, ScoringContext } from "../types.js";
import type { BaseScoreComponents } from "./baseScore.js";
import type { FatigueResult } from "./fatigue.js";
import type { RouteFeatures } from "./features.js";

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

  if (ctx.highwayShare >= 0.65) {
    reasons.push({ text: "Mostly highway", weight: 0.12 });
  } else if (ctx.highwayShare <= 0.2) {
    reasons.push({ text: "Mostly local roads", weight: 0.18 });
  }

  if (ctx.maneuversPer10Mi >= 8) {
    reasons.push({ text: "Many turns", weight: 0.2 });
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

  if (features && features.mergeClusterCount >= 1) {
    reasons.push({ text: "Clustered interchanges", weight: 0.22 });
  }

  if (fatigue && fatigue.circadianPenalty > 0.5) {
    reasons.push({ text: "Late-night driving window", weight: 0.16 });
  }

  if (fatigue && fatigue.sleepPenalty > 0.35) {
    reasons.push({ text: "Low sleep increases difficulty", weight: 0.17 });
  }

  if (features && features.segmentMaxDifficulty >= 0.6) {
    reasons.push({ text: "Demanding segment hotspot", weight: 0.19 });
  }

  reasons.sort((a, b) => b.weight - a.weight);
  const unique: string[] = [];
  for (const r of reasons) {
    if (!unique.includes(r.text)) unique.push(r.text);
    if (unique.length >= 4) break;
  }
  return unique;
}
