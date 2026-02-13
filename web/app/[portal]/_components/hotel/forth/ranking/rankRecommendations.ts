export interface RankedRecommendation<T = unknown> {
  item: T;
  score: number;
}

export function rankRecommendations<T>(entries: RankedRecommendation<T>[]): RankedRecommendation<T>[] {
  return [...entries].sort((a, b) => b.score - a.score);
}
