type SpotsRequestPlanInput = {
  hasCenter: boolean;
  hasSearch: boolean;
  sortBy: string | null;
  hasPriceLevel: boolean;
  venueTypesCount: number;
  neighborhoodsCount: number;
  vibesCount: number;
  genresCount: number;
  cuisinesCount: number;
};

export function shouldUseEventLedSpotsDiscovery(
  input: SpotsRequestPlanInput,
): boolean {
  if (input.hasCenter) return false;
  if (input.hasSearch) return false;
  if (input.hasPriceLevel) return false;
  if (input.venueTypesCount > 0) return false;
  if (input.neighborhoodsCount > 0) return false;
  if (input.vibesCount > 0) return false;
  if (input.genresCount > 0) return false;
  if (input.cuisinesCount > 0) return false;
  if (
    input.sortBy === "distance" ||
    input.sortBy === "hybrid" ||
    input.sortBy === "special_relevance"
  ) {
    return false;
  }
  return true;
}

export function getEventLedVenueCandidateLimit(
  responseLimit: number,
  openNow: boolean,
): number {
  const multiplier = openNow ? 12 : 8;
  return Math.max(120, Math.min(responseLimit * multiplier, 480));
}
