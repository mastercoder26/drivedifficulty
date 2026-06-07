import type { FactorContribution, ScoringBreakdown, SegmentHotspot } from "../types.js";
import type { BaseScoreComponents } from "./baseScore.js";
import type { FatigueResult } from "./fatigue.js";
import { fatigueSubscore } from "./fatigue.js";
import type { RouteFeatures } from "./features.js";
import type { RouteSegment } from "./segments.js";

const FACTOR_LABELS: Record<string, string> = {
  speed: "High-speed road burden",
  merges: "Merge/interchange burden",
  turns: "Maneuver burden",
  traffic: "Traffic burden",
  length: "Length/monotony burden",
  fatigue: "Fatigue burden",
};

const FACTOR_WEIGHTS: Record<keyof Pick<ScoringBreakdown, "speed" | "merges" | "turns" | "traffic" | "length" | "fatigue">, number> = {
  speed: 0.3,
  merges: 0.25,
  turns: 0.15,
  traffic: 0.15,
  length: 0.15,
  fatigue: 0.1,
};

export function buildBreakdown(
  base: BaseScoreComponents,
  fatigue: FatigueResult
): ScoringBreakdown {
  const fatigueScore = fatigueSubscore(fatigue);
  return {
    speed: base.S,
    merges: base.M,
    turns: base.T,
    traffic: base.C,
    length: base.L,
    fatigue: fatigueScore,
    highway: base.S,
    maneuvers: base.T,
    navDensity: base.T,
    effort: Math.max(base.L, fatigueScore),
  };
}

export function explainPrediction(
  breakdown: ScoringBreakdown,
  features: RouteFeatures
): FactorContribution[] {
  const keys = Object.keys(FACTOR_WEIGHTS) as Array<
    keyof typeof FACTOR_WEIGHTS
  >;

  const entries: FactorContribution[] = keys.map((key) => {
    const value = breakdown[key] ?? 0;
    const weight = FACTOR_WEIGHTS[key];
    const contribution = weight * value;
    return {
      factor: key,
      label: FACTOR_LABELS[key] ?? key,
      value,
      weight,
      contribution,
      share: 0,
    };
  });

  const total = entries.reduce((sum, e) => sum + e.contribution, 0) || 1;
  for (const entry of entries) {
    entry.share = Math.round((entry.contribution / total) * 1000) / 1000;
  }

  entries.sort((a, b) => b.contribution - a.contribution);

  if (features.segmentMaxDifficulty > 0.5) {
    entries.push({
      factor: "hotspot",
      label: `Hardest segment (${(features.segmentMaxDifficulty * 100).toFixed(0)}%)`,
      value: features.segmentMaxDifficulty,
      weight: 0,
      contribution: features.segmentMaxDifficulty * 0.15,
      share: 0,
    });
  }

  return entries;
}

export function buildHotspots(
  segments: RouteSegment[],
  segmentScores: number[],
  limit = 5
): SegmentHotspot[] {
  const indexed = segmentScores.map((score, i) => ({
    segment: segments[i],
    score,
  }));

  indexed.sort((a, b) => b.score - a.score);

  return indexed.slice(0, limit).map(({ segment, score }) => ({
    segmentIndex: segment.index,
    difficulty: Math.round(score * 1000) / 1000,
    cumulativeSecondsFromStart: segment.cumulativeSecondsFromStart,
    label: summarizeSegment(segment),
  }));
}

function summarizeSegment(segment: RouteSegment): string {
  const miles = (segment.distanceMeters / 1609.34).toFixed(1);
  const mergeLike = segment.maneuvers.filter(
    (m) => m === "MERGE" || m.startsWith("RAMP_")
  ).length;

  if (mergeLike >= 2) return `Dense merge cluster (~${miles} mi)`;
  if (segment.maneuvers.length >= 3) return `Multiple turns (~${miles} mi)`;
  if (segment.isHighway && segment.impliedSpeedMph >= 60) {
    return `High-speed segment (~${miles} mi)`;
  }
  return `Local segment (~${miles} mi)`;
}

export function hardestSegmentSummary(hotspots: SegmentHotspot[]): string | undefined {
  return hotspots[0]?.label;
}
