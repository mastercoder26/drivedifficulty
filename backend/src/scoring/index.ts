import type {
  AlternateRoute,
  ParsedRoute,
  ScoredRoute,
  ScoringContext,
} from "../types.js";
import { computeHighwayShare } from "./highway.js";
import { computeManeuverComplexity } from "./maneuvers.js";
import { computeNavigationDensity } from "./navigationDensity.js";
import { computeSustainedEffort } from "./sustainedEffort.js";
import { generateReasons } from "./reasons.js";
import { scoreToLabel } from "./labels.js";
import { computeTrafficStress } from "./traffic.js";

// Five-factor weighted model.
// Speed intensity removed — high speed on a straight highway is captured by the
// highway U-shape baseline; raw avgMph was inflating easy interstate routes to ~3.
const WEIGHTS = {
  highway:    0.30, // road type complexity (U-shape: local=hard, highway=baseline)
  maneuvers:  0.25, // turn/decision complexity per mile
  traffic:    0.20, // delay vs. free-flow time
  navDensity: 0.15, // navigation steps per mile (map-check frequency)
  effort:     0.10, // sustained attention required for long drives
} as const;

export interface ScoreRouteOptions {
  stepSpeedsMph?: Map<number, number>;
}

export function scoreRoute(
  route: ParsedRoute,
  options: ScoreRouteOptions = {}
): ScoredRoute {
  const { stepSpeedsMph } = options;

  const highway    = computeHighwayShare(route.steps, stepSpeedsMph);
  const maneuvers  = computeManeuverComplexity(route.steps, route.distanceMeters);
  const traffic    = computeTrafficStress(route.durationSeconds, route.staticDurationSeconds);
  const navDensity = computeNavigationDensity(route.steps, route.distanceMeters);
  const effort     = computeSustainedEffort(route.staticDurationSeconds);

  const breakdown = {
    highway:    highway.subscore,
    maneuvers:  maneuvers.subscore,
    traffic:    traffic.subscore,
    navDensity: navDensity.subscore,
    effort:     effort.subscore,
  };

  const rawScore =
    WEIGHTS.highway    * breakdown.highway    +
    WEIGHTS.maneuvers  * breakdown.maneuvers  +
    WEIGHTS.traffic    * breakdown.traffic    +
    WEIGHTS.navDensity * breakdown.navDensity +
    WEIGHTS.effort     * breakdown.effort;

  const score = Math.round(rawScore * 10 * 10) / 10;

  const ctx: ScoringContext = {
    highwayShare:    highway.highwayShare,
    maneuversPer10Mi: maneuvers.maneuversPer10Mi,
    delayRatio:      traffic.delayRatio,
    stepsPerMile:    navDensity.stepsPerMile,
    durationHours:   effort.durationHours,
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
    distanceMeters:       route.distanceMeters,
    durationSeconds:      route.durationSeconds,
    staticDurationSeconds: route.staticDurationSeconds,
    trafficDelaySeconds,
    polyline: route.polyline,
    bounds:   route.bounds,
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
  computeManeuverComplexity,
  computeTrafficStress,
  computeNavigationDensity,
  computeSustainedEffort,
  generateReasons,
  scoreToLabel,
};
