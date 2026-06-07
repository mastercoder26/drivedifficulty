import type {
  AlternateRoute,
  ParsedRoute,
  ScoredRoute,
  ScoringContext,
} from "../types.js";
import { computeHighwayShare } from "./highway.js";
import { computeManeuverComplexity } from "./maneuvers.js";
import { generateReasons } from "./reasons.js";
import { scoreToLabel } from "./labels.js";
import { computeSpeedIntensity } from "./speed.js";
import { computeTrafficStress } from "./traffic.js";

const WEIGHTS = {
  highway: 0.35,
  speed: 0.3,
  maneuvers: 0.2,
  traffic: 0.15,
} as const;

export interface ScoreRouteOptions {
  stepSpeedsMph?: Map<number, number>;
}

export function scoreRoute(
  route: ParsedRoute,
  options: ScoreRouteOptions = {}
): ScoredRoute {
  const { stepSpeedsMph } = options;

  const highway = computeHighwayShare(route.steps, stepSpeedsMph);
  const speed = computeSpeedIntensity(route.steps, stepSpeedsMph);
  const maneuvers = computeManeuverComplexity(route.steps, route.distanceMeters);
  const traffic = computeTrafficStress(
    route.durationSeconds,
    route.staticDurationSeconds
  );

  const breakdown = {
    highway: highway.subscore,
    speed: speed.subscore,
    maneuvers: maneuvers.subscore,
    traffic: traffic.subscore,
  };

  const rawScore =
    WEIGHTS.highway * breakdown.highway +
    WEIGHTS.speed * breakdown.speed +
    WEIGHTS.maneuvers * breakdown.maneuvers +
    WEIGHTS.traffic * breakdown.traffic;

  const score = Math.round(rawScore * 10 * 10) / 10;

  const ctx: ScoringContext = {
    highwayShare: highway.highwayShare,
    avgMph: speed.avgMph,
    maxMph: speed.maxMph,
    maneuversPer10Mi: maneuvers.maneuversPer10Mi,
    delayRatio: traffic.delayRatio,
    breakdown,
  };

  const reasons = generateReasons(ctx);
  const trafficDelaySeconds = Math.max(
    0,
    route.durationSeconds - route.staticDurationSeconds
  );

  return {
    score,
    label: scoreToLabel(score),
    reasons,
    breakdown,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    staticDurationSeconds: route.staticDurationSeconds,
    trafficDelaySeconds,
    polyline: route.polyline,
    bounds: route.bounds,
  };
}

export function scoreRoutes(
  routes: ParsedRoute[],
  optionsList?: ScoreRouteOptions[]
): { primary: ScoredRoute; alternates: AlternateRoute[] } {
  if (routes.length === 0) {
    throw new Error("No routes to score");
  }

  const scored = routes.map((route, i) =>
    scoreRoute(route, optionsList?.[i] ?? {})
  );

  const primary = scored[0];
  const alternates: AlternateRoute[] = scored.slice(1).map((route) => ({
    ...route,
    scoreDelta: Math.round((route.score - primary.score) * 10) / 10,
  }));

  alternates.sort((a, b) => a.score - b.score);

  return { primary, alternates };
}

export {
  computeHighwayShare,
  computeSpeedIntensity,
  computeManeuverComplexity,
  computeTrafficStress,
  generateReasons,
  scoreToLabel,
};
