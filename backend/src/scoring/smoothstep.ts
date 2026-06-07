/** Hermite smoothstep: x² × (3 - 2x), clamped to [0, 1]. */
export function smoothstep(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}
