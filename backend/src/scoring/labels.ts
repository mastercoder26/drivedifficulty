export function scoreToLabel(score: number): string {
  if (score < 2) return "Very Easy";
  if (score < 4) return "Easy";
  if (score < 6) return "Moderate";
  if (score < 8) return "Hard";
  return "Very Hard";
}
