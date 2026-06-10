import type { FactorContribution, ScoringBreakdown, SegmentHotspot } from "../types.js";
import type { BaseScoreComponents } from "./baseScore.js";
import type { FatigueResult } from "./fatigue.js";
import { durationBurden, fatigueSubscore } from "./fatigue.js";
import type { RouteFeatures } from "./features.js";
import { computeSustainedEffortFromHours } from "./sustainedEffort.js";
import { smoothstep } from "./smoothstep.js";
import type { RouteSegment } from "./segments.js";

const FACTOR_LABELS: Record<string, string> = {
  speed: "High-speed road burden",
  merges: "Merge/interchange burden",
  turns: "Maneuver burden",
  traffic: "Traffic burden",
  length: "Length/monotony burden",
  fatigue: "Fatigue burden",
  weather: "Weather conditions",
  road: "Road size/conditions",
  turnCluster: "Turn clustering pressure",
  decisionDensity: "Dense decision windows",
  sustained: "Sustained attention",
  laneChange: "Lane change urgency",
  unprotectedLefts: "Unprotected left turns",
};

const FACTOR_WEIGHTS: Record<
  keyof Pick<
    ScoringBreakdown,
    | "speed"
    | "merges"
    | "turns"
    | "traffic"
    | "length"
    | "fatigue"
    | "weather"
    | "road"
  >,
  number
> = {
  speed: 0.3,
  merges: 0.25,
  turns: 0.15,
  traffic: 0.15,
  length: 0.2,
  fatigue: 0.1,
  weather: 0.18,
  road: 0.1,
};

export function buildBreakdown(
  base: BaseScoreComponents,
  fatigue: FatigueResult,
  durationHours: number
): ScoringBreakdown {
  const fatigueScore = fatigueSubscore(fatigue);
  const sustained = computeSustainedEffortFromHours(durationHours).subscore;
  const durationScore = durationBurden(durationHours);
  return {
    speed: base.S,
    merges: base.M,
    turns: base.T,
    traffic: base.C,
    length: Math.max(base.L, durationScore),
    fatigue: fatigueScore,
    weather: base.W,
    road: base.R,
    highway: base.S,
    maneuvers: base.T,
    navDensity: base.T,
    effort: Math.max(sustained, base.L, fatigueScore, durationScore),
  };
}

export function explainPrediction(
  breakdown: ScoringBreakdown,
  features: RouteFeatures
): FactorContribution[] {
  const keys = Object.keys(FACTOR_WEIGHTS) as Array<keyof typeof FACTOR_WEIGHTS>;

  const entries: FactorContribution[] = keys
    .filter((key) => {
      // Hide condition factors entirely when no live data contributed.
      if (key === "weather" || key === "road") return (breakdown[key] ?? 0) > 0.02;
      return true;
    })
    .map((key) => {
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

  if (features.unprotectedLeftTurns >= 1) {
    const norm = smoothstep(features.unprotectedLeftTurns / 5);
    entries.push({
      factor: "unprotectedLefts",
      label: FACTOR_LABELS.unprotectedLefts,
      value: norm,
      weight: 0.1,
      contribution: 0.1 * norm,
      share: 0,
    });
  }

  const sustained = computeSustainedEffortFromHours(features.durationHours).subscore;
  if (sustained > 0.2) {
    entries.push({
      factor: "sustained",
      label: FACTOR_LABELS.sustained,
      value: sustained,
      weight: 0.24,
      contribution: 0.24 * sustained,
      share: 0,
    });
  }

  if (features.turnClusterSubscore > 0.15) {
    entries.push({
      factor: "turnCluster",
      label: FACTOR_LABELS.turnCluster,
      value: features.turnClusterSubscore,
      weight: 0.12,
      contribution: 0.12 * features.turnClusterSubscore,
      share: 0,
    });
  }

  if (features.decisionPointDensity > 1) {
    const densityNorm = smoothstep(features.decisionPointDensity / 5);
    entries.push({
      factor: "decisionDensity",
      label: FACTOR_LABELS.decisionDensity,
      value: densityNorm,
      weight: 0.08,
      contribution: 0.08 * densityNorm,
      share: 0,
    });
  }

  if (features.laneChangeUrgency > 0.2) {
    entries.push({
      factor: "laneChange",
      label: FACTOR_LABELS.laneChange,
      value: features.laneChangeUrgency,
      weight: 0.06,
      contribution: 0.06 * features.laneChangeUrgency,
      share: 0,
    });
  }

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

  const turnManeuvers = segment.maneuvers.filter(
    (m) =>
      m.startsWith("TURN_") ||
      m.startsWith("FORK_") ||
      m.startsWith("ROUNDABOUT_") ||
      m.startsWith("UTURN_")
  );
  const sharpTurns = turnManeuvers.filter(
    (m) => m.includes("SHARP") || m.startsWith("UTURN_") || m.startsWith("ROUNDABOUT_")
  ).length;

  if (mergeLike >= 2) return `Dense merge cluster (~${miles} mi)`;
  if (mergeLike === 1 && segment.impliedSpeedMph >= 55) {
    return `Lane-change section (~${miles} mi)`;
  }
  if (sharpTurns >= 2) return `Sharp turn cluster (~${miles} mi)`;
  if (turnManeuvers.length >= 2 && segment.distanceMeters / 1609.34 < 0.3) {
    return `Back-to-back turns (~${miles} mi)`;
  }
  if (segment.maneuvers.length >= 3) return `Multiple turns (~${miles} mi)`;
  if (segment.isHighway && segment.impliedSpeedMph >= 60) {
    return `High-speed segment (~${miles} mi)`;
  }
  return `Local segment (~${miles} mi)`;
}

export function hardestSegmentSummary(hotspots: SegmentHotspot[]): string | undefined {
  return hotspots[0]?.label;
}
