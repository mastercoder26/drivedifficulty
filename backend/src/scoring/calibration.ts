export interface CalibrationKnot {
  x: number;
  y: number;
}

export interface CalibrationArtifact {
  modelVersion: string;
  knots: CalibrationKnot[];
}

const DEFAULT_KNOTS: CalibrationKnot[] = [
  { x: 0, y: 0 },
  { x: 2, y: 2 },
  { x: 4, y: 4 },
  { x: 6, y: 6 },
  { x: 8, y: 8 },
  { x: 10, y: 10 },
];

let activeKnots: CalibrationKnot[] = [...DEFAULT_KNOTS];
let modelVersion = "hybrid-v1";

export function setCalibrationKnots(knots: CalibrationKnot[]): void {
  activeKnots = [...knots].sort((a, b) => a.x - b.x);
}

export function getCalibrationKnots(): CalibrationKnot[] {
  return [...activeKnots];
}

export function isotonicTransform(score: number): number {
  const x = Math.max(0, Math.min(10, score));
  const knots = activeKnots;

  if (x <= knots[0]!.x) return knots[0]!.y;
  if (x >= knots[knots.length - 1]!.x) return knots[knots.length - 1]!.y;

  for (let i = 0; i < knots.length - 1; i++) {
    const a = knots[i]!;
    const b = knots[i + 1]!;
    if (x >= a.x && x <= b.x) {
      const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return x;
}

export function getCalibrator(): {
  transform: (score: number) => number;
  modelVersion: string;
} {
  return { transform: isotonicTransform, modelVersion };
}

export function loadCalibrationArtifact(artifact: CalibrationArtifact): void {
  setCalibrationKnots(artifact.knots);
  modelVersion = artifact.modelVersion;
}

export function fitIsotonicKnots(
  pairs: Array<{ score: number; label: number }>,
  bins = 10
): CalibrationKnot[] {
  if (pairs.length === 0) return DEFAULT_KNOTS;

  const sorted = [...pairs].sort((a, b) => a.score - b.score);
  const binSize = Math.max(1, Math.floor(sorted.length / bins));
  const knots: CalibrationKnot[] = [{ x: 0, y: 0 }];

  for (let i = 0; i < sorted.length; i += binSize) {
    const slice = sorted.slice(i, i + binSize);
    knots.push({
      x: Math.max(0, Math.min(10, slice.reduce((a, p) => a + p.score, 0) / slice.length)),
      y: Math.max(0, Math.min(10, slice.reduce((a, p) => a + p.label, 0) / slice.length)),
    });
  }

  knots.push({ x: 10, y: 10 });
  for (let i = 1; i < knots.length; i++) {
    knots[i]!.y = Math.max(knots[i]!.y, knots[i - 1]!.y);
  }
  return knots;
}

export function expectedCalibrationError(
  pairs: Array<{ predicted: number; actual: number }>,
  bins = 10
): number {
  if (pairs.length === 0) return 0;
  const binSize = 10 / bins;
  let ece = 0;

  for (let b = 0; b < bins; b++) {
    const lo = b * binSize;
    const hi = lo + binSize;
    const inBin = pairs.filter((p) => p.predicted >= lo && p.predicted < hi);
    if (inBin.length === 0) continue;
    const avgPred = inBin.reduce((s, p) => s + p.predicted, 0) / inBin.length;
    const avgActual = inBin.reduce((s, p) => s + p.actual, 0) / inBin.length;
    ece += (inBin.length / pairs.length) * Math.abs(avgPred - avgActual);
  }
  return ece;
}
