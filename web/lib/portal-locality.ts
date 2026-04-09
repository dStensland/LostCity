type EventLikeWithCity = {
  venue?: {
    city?: string | null;
  } | null;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isPortalCityMatch(
  city: string | null | undefined,
  portalCities: string[],
): boolean {
  const normalizedCity = city?.trim().toLowerCase();
  if (!normalizedCity || portalCities.length === 0) return false;

  return portalCities.some((portalCity) => {
    if (normalizedCity === portalCity) return true;
    return new RegExp(`\\b${escapeRegExp(portalCity)}\\b`).test(normalizedCity);
  });
}

export function sortEventsByPortalCityPreference<T extends EventLikeWithCity>(
  events: T[],
  portalCities: string[],
): T[] {
  if (portalCities.length === 0) return [...events];

  return [...events].sort((left, right) => {
    const leftRank = isPortalCityMatch(left.venue?.city, portalCities) ? 0 : 1;
    const rightRank = isPortalCityMatch(right.venue?.city, portalCities) ? 0 : 1;
    return leftRank - rightRank;
  });
}
