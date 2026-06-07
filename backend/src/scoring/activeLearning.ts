import type { ScoreUncertainty, ScoredRoute } from "../types.js";

export interface ActiveLearningInput {
  score: number;
  label?: string;
  uncertainty: ScoreUncertainty;
  alternateScores?: number[];
  userSelectedAlternateWithLowerScore?: boolean;
}

export interface ActiveLearningResult {
  shouldRequestFeedback: boolean;
  reasons: string[];
}

const THRESHOLD_BANDS = [2, 4, 6, 8];

export function shouldRequestFeedback(input: ActiveLearningInput): ActiveLearningResult {
  const reasons: string[] = [];

  if (input.uncertainty.confidence < 0.65 || input.uncertainty.spread > 0.9) {
    reasons.push("high_uncertainty");
  }

  for (const threshold of THRESHOLD_BANDS) {
    if (Math.abs(input.score - threshold) <= 0.25) {
      reasons.push("near_label_threshold");
      break;
    }
  }

  if (input.alternateScores && input.alternateScores.length > 0) {
    const close = input.alternateScores.some((s) => Math.abs(s - input.score) <= 0.5);
    if (close) reasons.push("close_alternate_scores");
  }

  if (input.userSelectedAlternateWithLowerScore) {
    reasons.push("behavioral_disagreement");
  }

  return {
    shouldRequestFeedback: reasons.length > 0,
    reasons,
  };
}

export function feedbackPromptForRoute(route: ScoredRoute): ActiveLearningResult {
  return shouldRequestFeedback({
    score: route.score,
    uncertainty: route.uncertainty,
  });
}
