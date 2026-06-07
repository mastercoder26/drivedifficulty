import type { ScoringBreakdown, ScoringContext } from "../types.js";

const WEIGHTS = {
  highway: 0.35,
  speed: 0.3,
  maneuvers: 0.2,
  traffic: 0.15,
} as const;

interface ReasonCandidate {
  reason: string;
  contribution: number;
}

function highwayReasons(highwayShare: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (highwayShare >= 0.65) {
    reasons.push({ reason: "Mostly highway", contribution: highwayShare });
  }
  if (highwayShare <= 0.25) {
    reasons.push({ reason: "Mostly local roads", contribution: 1 - highwayShare });
  }
  return reasons;
}

function speedReasons(avgMph: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (avgMph >= 55) {
    reasons.push({ reason: "High-speed roads", contribution: avgMph / 65 });
  }
  if (avgMph <= 35) {
    reasons.push({ reason: "Slow-speed roads", contribution: (35 - avgMph) / 35 });
  }
  return reasons;
}

function maneuverReasons(maneuversPer10Mi: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (maneuversPer10Mi >= 8) {
    reasons.push({ reason: "Many turns", contribution: maneuversPer10Mi / 12 });
  }
  if (maneuversPer10Mi <= 3) {
    reasons.push({ reason: "Few turns", contribution: (3 - maneuversPer10Mi) / 3 });
  }
  return reasons;
}

function trafficReasons(delayRatio: number): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (delayRatio >= 0.25) {
    reasons.push({ reason: "Heavy traffic", contribution: delayRatio });
  } else if (delayRatio >= 0.1) {
    reasons.push({ reason: "Moderate traffic", contribution: delayRatio });
  } else if (delayRatio < 0.05) {
    reasons.push({ reason: "Light traffic", contribution: 1 - delayRatio });
  }
  return reasons;
}

export function generateReasons(ctx: ScoringContext): string[] {
  const factorReasons: ReasonCandidate[] = [
    ...highwayReasons(ctx.highwayShare),
    ...speedReasons(ctx.avgMph),
    ...maneuverReasons(ctx.maneuversPer10Mi),
    ...trafficReasons(ctx.delayRatio),
  ];

  const contributions: ReasonCandidate[] = [
    {
      reason: "Non-highway roads",
      contribution: WEIGHTS.highway * ctx.breakdown.highway,
    },
    {
      reason: "Speed intensity",
      contribution: WEIGHTS.speed * ctx.breakdown.speed,
    },
    {
      reason: "Turn complexity",
      contribution: WEIGHTS.maneuvers * ctx.breakdown.maneuvers,
    },
    {
      reason: "Traffic delay",
      contribution: WEIGHTS.traffic * ctx.breakdown.traffic,
    },
  ];

  const all = [...factorReasons, ...contributions]
    .filter((c) => c.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution);

  const seen = new Set<string>();
  const result: string[] = [];

  for (const candidate of all) {
    if (seen.has(candidate.reason)) continue;
    seen.add(candidate.reason);
    result.push(candidate.reason);
    if (result.length >= 4) break;
  }

  return result.slice(0, Math.max(2, Math.min(4, result.length)));
}
