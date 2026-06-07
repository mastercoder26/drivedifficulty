import { smoothstep } from "./smoothstep.js";

export interface TrafficResult {
  delayRatio: number;
  subscore: number;
}

export function computeTrafficStress(
  durationSeconds: number,
  staticDurationSeconds: number
): TrafficResult {
  const delay = Math.max(0, durationSeconds - staticDurationSeconds);
  const delayRatio = delay / Math.max(staticDurationSeconds, 1);
  const subscore = smoothstep(delayRatio / 0.35);
  return { delayRatio, subscore };
}
