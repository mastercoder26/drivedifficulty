import type { ScoringBreakdown, ScoringContext } from "../types.js";

const WEIGHTS = {
  highway:    0.30,
  maneuvers:  0.25,
  traffic:    0.20,
  navDensity: 0.15,
  effort:     0.10,
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

function maneuverReasons(maneuversPer10Mi: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (maneuversPer10Mi >= 8) {
    reasons.push({ reason: "Many turns", factor: "maneuvers" });
  } else if (maneuversPer10Mi <= 2) {
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

function navDensityReasons(stepsPerMile: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (stepsPerMile >= 1.0) {
    reasons.push({ reason: "Complex navigation", factor: "navDensity" });
  } else if (stepsPerMile <= 0.2) {
    reasons.push({ reason: "Simple route", factor: "navDensity" });
  }
  return reasons;
}

function effortReasons(durationHours: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (durationHours >= 2.5) {
    reasons.push({ reason: "Long drive", factor: "effort" });
  } else if (durationHours >= 1.5) {
    reasons.push({ reason: "Extended drive", factor: "effort" });
  }
  return reasons;
}

export function generateReasons(ctx: ScoringContext): string[] {
  const candidates: ReasonCandidate[] = [
    ...highwayReasons(ctx.highwayShare),
    ...maneuverReasons(ctx.maneuversPer10Mi),
    ...trafficReasons(ctx.delayRatio),
    ...navDensityReasons(ctx.stepsPerMile),
    ...effortReasons(ctx.durationHours),
  ];

  // Sort by weighted contribution so dominant factors surface first
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

  // Always return at least 2 reasons even if contributions are small
  if (result.length < 2) {
    for (const candidate of ranked) {
      if (!seen.has(candidate.reason)) {
        seen.add(candidate.reason);
        result.push(candidate.reason);
      }
      if (result.length >= 2) break;
    }
  }

  return result.slice(0, 4);
}
