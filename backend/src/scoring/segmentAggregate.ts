import type { RouteSegment } from "./segments.js";
import { scoreSegmentLocal } from "./segments.js";

export const SEGMENT_AGGREGATE_WEIGHTS = {
  mean: 0.55,
  p90: 0.25,
  max: 0.2,
} as const;

export interface SegmentAggregateResult {
  mean: number;
  p90: number;
  max: number;
  aggregated: number;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(p * sorted.length) - 1)
  );
  return sorted[idx];
}

export function aggregateSegmentScores(
  segmentScores: number[]
): SegmentAggregateResult;
export function aggregateSegmentScores(
  segments: RouteSegment[]
): SegmentAggregateResult;
export function aggregateSegmentScores(
  input: number[] | RouteSegment[]
): SegmentAggregateResult {
  const scores =
    input.length > 0 && typeof input[0] === "number"
      ? (input as number[])
      : (input as RouteSegment[]).map(scoreSegmentLocal);

  if (scores.length === 0) {
    return { mean: 0, p90: 0, max: 0, aggregated: 0 };
  }

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const p90 = percentile(scores, 0.9);
  const max = Math.max(...scores);
  const aggregated =
    SEGMENT_AGGREGATE_WEIGHTS.mean * mean +
    SEGMENT_AGGREGATE_WEIGHTS.p90 * p90 +
    SEGMENT_AGGREGATE_WEIGHTS.max * max;

  return { mean, p90, max, aggregated };
}

export function aggregateMeanOnly(segmentScores: number[]): number {
  if (segmentScores.length === 0) return 0;
  return segmentScores.reduce((a, b) => a + b, 0) / segmentScores.length;
}
