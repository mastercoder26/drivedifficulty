/** Parse protobuf duration strings like "5309s" into seconds. */
export function parseDurationSeconds(value: string | undefined | null): number {
  if (!value) return 0;
  const match = value.match(/^(\d+(?:\.\d+)?)s$/);
  if (!match) return 0;
  return Math.round(parseFloat(match[1]));
}
