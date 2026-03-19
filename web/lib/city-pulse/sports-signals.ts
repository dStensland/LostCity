export const SPECTATOR_SPORTS_GENRES = [
  "sports",
  "watch-party",
  "viewing-party",
  "football",
  "nfl",
  "soccer",
  "basketball",
  "baseball",
  "hockey",
  "mma",
  "ufc",
  "boxing",
  "wrestling",
  "esports",
  "team-sport",
  "athletics",
] as const;

export const RECREATION_SIGNAL_GENRES = [
  "pickup",
  "open-play",
  "open-gym",
  "public-play",
  "league",
  "pickleball",
  "tennis",
  "volleyball",
  "softball",
  "ultimate-frisbee",
  "adaptive-sports",
  "wheelchair-sports",
  "recreation",
  "batting-cage",
  "cornhole",
  "axe-throwing",
] as const;

/** Union of spectator and recreation genres — kept for backward compatibility. */
export const SPORTS_SIGNAL_GENRES = [
  ...SPECTATOR_SPORTS_GENRES,
  ...RECREATION_SIGNAL_GENRES,
] as const;

export const SPORTS_TITLE_PATTERN =
  /viewing party|watch party|\b(nfl|nba|mlb|nhl|mls|ufc|mma)\b|game\s*day|fight night|pickup|open play|open gym|public play|scrimmage|\brec( league| center)?\b|league play|batting cage|pickleball|tennis|ultimate frisbee|softball|volleyball|futsal/i;
