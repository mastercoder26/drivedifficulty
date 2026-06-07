import type { ScoringBreakdown, ScoringContext } from "../types.js";

const WEIGHTS = {
  highway: 0.35,
  speed: 0.3,
  maneuvers: 0.2,
  traffic: 0.15,
} as const;

type Factor = keyof typeof WEIGHTS;

interface ReasonCandidate {
  reason: string;
  factor: Factor;
}

function factorContribution(
  factor: Factor,
  breakdown: ScoringBreakdown
): number {
  return WEIGHTS[factor] * breakdown[factor];
}

function highwayReasons(highwayShare: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (highwayShare >= 0.65) {
    reasons.push({ reason: "Mostly highway", factor: "highway" });
  }
  if (highwayShare <= 0.25) {
    reasons.push({ reason: "Mostly local roads", factor: "highway" });
  }
  return reasons;
}

function speedReasons(avgMph: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (avgMph >= 55) {
    reasons.push({ reason: "High-speed roads", factor: "speed" });
  }
  if (avgMph <= 35) {
    reasons.push({ reason: "Slow-speed roads", factor: "speed" });
  }
  return reasons;
}

function maneuverReasons(maneuversPer10Mi: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (maneuversPer10Mi >= 8) {
    reasons.push({ reason: "Many turns", factor: "maneuvers" });
  }
  if (maneuversPer10Mi <= 3) {
    reasons.push({ reason: "Few turns", factor: "maneuvers" });
  }
  return reasons;
}

function trafficReasons(delayRatio: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (delayRatio >= 0.25) {
    reasons.push({ reason: "Heavy traffic", factor: "traffic" });
  } else if (delayRatio >= 0.1) {
    reasons.push({ reason: "Moderate traffic", factor: "traffic" });
  } else if (delayRatio < 0.05) {
    reasons.push({ reason: "Light traffic", factor: "traffic" });
  }
  return reasons;
}

export function generateReasons(ctx: ScoringContext): string[] {
  const candidates: ReasonCandidate[] = [
    ...highwayReasons(ctx.highwayShare),
    ...speedReasons(ctx.avgMph),
    ...maneuverReasons(ctx.maneuversPer10Mi),
    ...trafficReasons(ctx.delayRatio),
  ];

  const ranked = candidates
    .map((c) => ({
      reason: c.reason,
      contribution: factorContribution(c.factor, ctx.breakdown),
    }))
    .sort((a, b) => b.contribution - a.contribution);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of ranked) {
    if (seen.has(candidate.reason)) continue;
    seen.add(candidate.reason);
    result.push(candidate.reason);
    if (result.length >= 4) break;
  }

  if (result.length < 2) {
    for (const candidate of ranked) {
      if (!seen.has(candidate.reason)) {
        seen.add(candidate.reason);
        result.push(candidate.reason);
      }
      if (result.length >= 2) break;
    }
  }

  return result.slice(0, Math.min(4, result.length));
}
