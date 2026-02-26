type VenueLike =
  | {
      name?: string | null;
      slug?: string | null;
    }
  | null
  | undefined;

const INDIE_CINEMA_PATTERNS = [
  /\bplaza theatre\b/i,
  /\btara\b/i,
  /\bstarlight\b/i,
  /\blandmark\b/i,
  /\bbelcourt\b/i,
  /\barthouse\b/i,
  /\bart house\b/i,
];

const CHAIN_CINEMA_PATTERNS = [
  /\bamc\b/i,
  /\bregal\b/i,
  /\bcinemark\b/i,
  /\bcmx\b/i,
  /\bncg\b/i,
  /\bsprings[-\s]cinema\b/i,
  /\bmovie tavern\b/i,
  /\bcinepolis\b/i,
  /\blook cinemas?\b/i,
];

export function isRegularShowtimeEvent(
  tags: string[] | null | undefined,
): boolean {
  return Boolean(tags?.includes("showtime"));
}

export function isChainCinemaVenue(venue: VenueLike): boolean {
  if (!venue) return false;

  const haystack = [venue.name ?? "", venue.slug ?? ""].join(" ").trim();
  if (!haystack) return false;

  // Indie/arthouse venues should never be suppressed as chain cinema.
  if (INDIE_CINEMA_PATTERNS.some((pattern) => pattern.test(haystack))) {
    return false;
  }

  return CHAIN_CINEMA_PATTERNS.some((pattern) => pattern.test(haystack));
}

export function isIndieCinemaVenue(venue: VenueLike): boolean {
  if (!venue) return false;
  const haystack = [venue.name ?? "", venue.slug ?? ""].join(" ").trim();
  return INDIE_CINEMA_PATTERNS.some((p) => p.test(haystack));
}

export function getIndieCinemaPriority(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("plaza")) return 0;
  if (n.includes("tara")) return 1;
  if (n.includes("starlight")) return 2;
  if (n.includes("landmark")) return 3;
  return 10;
}

export function shouldSuppressChainShowtime(
  tags: string[] | null | undefined,
  venue: VenueLike,
): boolean {
  return isRegularShowtimeEvent(tags) && isChainCinemaVenue(venue);
}
