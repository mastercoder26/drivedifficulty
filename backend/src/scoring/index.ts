import type {
  AlternateRoute,
  ParsedRoute,
  ScoredRoute,
  ScoringContext,
  ScoringOptions,
} from "../types.js";
import { MODEL_VERSION } from "../types.js";
import { scoreSegmentLocal } from "./segments.js";
import { buildFeaturesFromRoute } from "./features.js";
import { aggregateSegmentScores } from "./segmentAggregate.js";
import { computeBaseScore } from "./baseScore.js";
import { computeFatigue, computeRawScore } from "./fatigue.js";
import {
  buildBreakdown,
  buildHotspots,
  explainPrediction,
} from "./explain.js";
import { getCalibrator } from "./calibration.js";
import { applyUncertaintyBand, estimateUncertainty } from "./uncertainty.js";
import { predictMlResidualSync } from "./mlResidual.js";
import { shouldRequestFeedback } from "./activeLearning.js";
import { generateReasons } from "./reasons.js";
import { scoreToLabel } from "./labels.js";

export type ScoreRouteOptions = ScoringOptions & {
  predictionId?: string;
};

export function scoreRoute(
  route: ParsedRoute,
  options: ScoreRouteOptions = {}
): ScoredRoute {
  const hoursSlept = options.hoursSlept ?? 7;
  const continuousDriveMinutes =
    options.continuousDriveMinutes ?? route.staticDurationSeconds / 60;

  const { segments, features } = buildFeaturesFromRoute(route, {
    stepSpeedsMph: options.stepSpeedsMph,
    departureTime: options.departureTime,
  });

  const segmentScores = segments.map(scoreSegmentLocal);
  const segmentAgg = aggregateSegmentScores(segmentScores);
  const D_route = segmentAgg.aggregated;

  const base = computeBaseScore(features);
  const fatigue = computeFatigue(features, {
    departureTime: options.departureTime
      ? new Date(options.departureTime)
      : undefined,
    hoursSlept,
    continuousDriveMinutes,
  });
  const rawScore = computeRawScore(D_route, base.D_base, fatigue, features);

  const ml = predictMlResidualSync(features);
  const uncalibrated = Math.max(0, Math.min(10, rawScore + ml.residual));

  const calibrator = getCalibrator();
  const score = Math.round(calibrator.transform(uncalibrated) * 10) / 10;

  const breakdown = buildBreakdown(base, fatigue);
  const contributions = explainPrediction(breakdown, features);
  const hotspots = buildHotspots(segments, segmentScores);

  const ctx: ScoringContext = {
    highwayShare: features.highwayShare,
    maneuversPer10Mi: features.maneuversPer10Mi,
    delayRatio: features.delayRatio,
    stepsPerMile: features.stepsPerMile,
    durationHours: features.durationHours,
    breakdown,
  };

  const baseUncertainty = estimateUncertainty(features, Math.abs(ml.residual));
  const uncertainty = applyUncertaintyBand(score, baseUncertainty);

  const feedbackCheck = shouldRequestFeedback({
    score,
    uncertainty,
  });

  const reasons = generateReasons(ctx, features, base, fatigue);

  const trafficDelaySeconds = Math.max(
    0,
    route.durationSeconds - route.staticDurationSeconds
  );

  return {
    score,
    uncalibratedScore: Math.round(uncalibrated * 10) / 10,
    label: scoreToLabel(score),
    reasons: reasons.slice(0, 4),
    breakdown,
    contributions,
    uncertainty,
    hotspots,
    predictionId: options.predictionId,
    modelVersion: MODEL_VERSION,
    requestFeedback: feedbackCheck.shouldRequestFeedback,
    feedbackReasons: feedbackCheck.reasons,
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

  const feedback = shouldRequestFeedback({
    score: primary.score,
    uncertainty: primary.uncertainty,
    alternateScores: alternates.map((a) => a.score),
  });
  primary.requestFeedback = feedback.shouldRequestFeedback;
  primary.feedbackReasons = feedback.reasons;

  return { primary, alternates };
}

export {
  buildFeaturesFromRoute,
  computeBaseScore,
  computeFatigue,
  aggregateSegmentScores,
  generateReasons,
  scoreToLabel,
};
