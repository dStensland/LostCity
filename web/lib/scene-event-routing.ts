import { SPORTS_SIGNAL_GENRES, SPORTS_TITLE_PATTERN } from "./city-pulse/sports-signals";

export type SceneActivityType = {
  id: string;
  label: string;
  iconName: string;
  color: string;
  matchGenres?: string[];
  matchCategories?: string[];
  matchTitle?: RegExp;
};

type SceneSeries = {
  series_type?: string | null;
  festival?: { id?: string | number | null } | null;
} | null;

export type SceneRoutableEvent = {
  title?: string | null;
  category?: string | null;
  category_id?: string | null;
  genres?: string[] | null;
  tags?: string[] | null;
  series_id?: string | number | null;
  is_recurring?: boolean | null;
  is_tentpole?: boolean | null;
  festival_id?: string | number | null;
  series?: SceneSeries;
};

export const SCENE_ACTIVITY_TYPES: SceneActivityType[] = [
  { id: "trivia", label: "Trivia", iconName: "Question", color: "#93C5FD", matchGenres: ["trivia"], matchTitle: /trivia|pub quiz|quizbastard/i },
  { id: "karaoke", label: "Karaoke", iconName: "MicrophoneStage", color: "#F9A8D4", matchGenres: ["karaoke"], matchTitle: /karaoke/i },
  { id: "comedy", label: "Comedy", iconName: "Smiley", color: "#FCD34D", matchGenres: ["comedy", "stand-up", "standup", "improv"], matchCategories: ["comedy"], matchTitle: /comedy|stand.up|\bimprov\b/i },
  { id: "bingo", label: "Bingo", iconName: "NumberCircleNine", color: "#FDBA74", matchGenres: ["bingo"], matchTitle: /bingo/i },
  { id: "brunch", label: "Brunch", iconName: "Coffee", color: "#FDBA74", matchGenres: ["brunch", "bottomless-brunch"], matchTitle: /\bbrunch\b/i },
  { id: "dj", label: "DJ Night", iconName: "Headphones", color: "#C4B5FD", matchGenres: ["dj", "electronic", "edm"], matchTitle: /\bdj\b/i },
  { id: "drag", label: "Drag", iconName: "Crown", color: "#E879F9", matchGenres: ["drag"], matchTitle: /drag (show|brunch|bingo|night)/i },
  { id: "nerd_stuff", label: "Nerd Stuff", iconName: "Sword", color: "#7DD3FC", matchGenres: ["dnd", "tabletop", "mtg", "magic-the-gathering", "warhammer", "board-games", "card-games", "video-games", "miniatures", "game-night", "nerd-stuff", "gaming"], matchTitle: /\bgame night\b|board game|d&d|dungeons|warhammer|magic.the.gathering/i },
  { id: "bar_games", label: "Bar Games", iconName: "BowlingBall", color: "#86EFAC", matchGenres: ["bar-games", "bowling", "bocce", "skee-ball", "curling", "darts", "shuffleboard", "pool", "billiards", "cornhole", "axe-throwing", "ping-pong"], matchTitle: /bowl|skee.?ball|darts|shuffleboard|bocce|cornhole|billiards|curling/i },
  { id: "happy_hour", label: "Happy Hour", iconName: "Wine", color: "#C4B5FD", matchGenres: ["happy-hour", "drink-specials", "margaritas", "bottomless", "sangria", "mimosas"], matchTitle: /happy hour/i },
  { id: "tasting", label: "Tasting", iconName: "BeerStein", color: "#F9A8D4", matchGenres: ["wine-tasting", "whiskey-tasting", "bourbon-tasting", "craft-beer"], matchTitle: /wine (night|tasting|down|wednesday)|bourbon (brawl|tasting)|whiskey tasting|beer tasting|cocktail class/i },
  { id: "farmers_market", label: "Farmers Market", iconName: "Leaf", color: "#86EFAC", matchGenres: ["farmers-market"], matchCategories: ["markets"], matchTitle: /farmers.?market|green.?market/i },
  { id: "food_specials", label: "Food Specials", iconName: "ForkKnife", color: "#FCD34D", matchGenres: ["food-specials", "specials", "oysters", "dollar-oysters", "tacos", "taco-tuesday", "wings", "half-price", "pizza", "crab", "seafood", "tapas", "beer"], matchCategories: ["food_drink"], matchTitle: /taco (tuesday|night)|wing (night|wednesday)|oyster (night|monday)|half.price|pint night|\$\d+\s+\w+day|bottle(s)?\s*(deal|night|monday|tuesday|wednesday|thursday|friday|special)|half.off/i },
  { id: "jazz_blues", label: "Jazz & Blues", iconName: "MusicNotes", color: "#93C5FD", matchGenres: ["jazz", "blues", "jam-session", "bluegrass"] },
  { id: "dance", label: "Dance", iconName: "MusicNotes", color: "#F9A8D4", matchGenres: ["dance", "salsa", "swing", "line-dancing", "latin-night", "dance-party", "two-step", "bachata", "reggaeton", "cumbia", "country-dance", "salsa-night"], matchTitle: /dance (night|party)|salsa night|swing night|line danc|two.step|country (night|dance)|latin[oa]?\s*(night|tuesday|saturday|friday)|bachata|reggaeton|noche latina/i },
  { id: "poker", label: "Poker", iconName: "Club", color: "#86EFAC", matchGenres: ["poker", "texas-holdem", "freeroll"], matchTitle: /poker/i },
  { id: "run_club", label: "Run Club", iconName: "PersonSimpleRun", color: "#5EEAD4", matchGenres: ["run-club", "group-run", "group-walk", "social-run", "running", "run", "cycling", "bike-ride"], matchTitle: /run club|running club|group run|social run|trail run|walk club|walking club|group walk|power walk|walk group|ruck club|ruck(?:ing| march)?|5k|10k|bike ride|cycling/i },
  { id: "fitness", label: "Fitness", iconName: "Barbell", color: "#86EFAC", matchGenres: ["yoga", "hiking"], matchCategories: ["fitness", "exercise"], matchTitle: /walk(ing)?\s*(club|group)/i },
  { id: "sports", label: "Sports", iconName: "Trophy", color: "#A78BFA", matchGenres: [...SPORTS_SIGNAL_GENRES], matchCategories: ["recreation"], matchTitle: SPORTS_TITLE_PATTERN },
  { id: "craft_club", label: "Craft Club", iconName: "Palette", color: "#F9A8D4", matchGenres: ["craft-club", "open-table", "knitting", "crochet"], matchTitle: /craft club|open table|knit together|knit night|stitch(?:ing)? circle|crochet circle/i },
  { id: "skate_night", label: "Skate Night", iconName: "Disc", color: "#7DD3FC", matchGenres: ["skating", "roller-skating"], matchTitle: /skate night|skating/i },
  { id: "vinyl_night", label: "Vinyl Night", iconName: "VinylRecord", color: "#E879F9", matchGenres: ["vinyl", "listening-party", "hi-fi"], matchTitle: /vinyl|listening (session|party|night|bar)|hi.?fi|record (night|spin)/i },
  { id: "spoken_word", label: "Spoken Word", iconName: "BookOpen", color: "#C4B5FD", matchGenres: ["spoken-word", "poetry", "poetry-slam", "storytelling"], matchTitle: /poetry|spoken word|poetry slam|literary/i },
  { id: "open_mic", label: "Open Mic", iconName: "Microphone", color: "#FDBA74", matchGenres: ["open-mic"], matchTitle: /open mic|open.mic/i },
  { id: "wild_card", label: "Something Different", iconName: "Sparkle", color: "#E879F9", matchGenres: ["tarot", "burlesque", "variety-show", "murder-mystery", "cabaret", "speed-dating", "silent-disco", "figure-drawing", "yappy-hour", "pro-wrestling", "rocky-horror", "sip-and-paint"], matchTitle: /tarot|burlesque|murder mystery|cabaret|variety show|speed dating|psychic|fortune tell|ghost tour|séance|seance|silent disco|figure drawing|life drawing|yappy hour|sip.{0,3}paint|paint.{0,3}sip|pro wrestling|rocky horror/i },
  { id: "movie_night", label: "Movie Night", iconName: "FilmStrip", color: "#C4B5FD", matchGenres: ["outdoor-movies"], matchTitle: /outdoor movie|movies? (on|in|at) the|screen on the green|movie night/i },
  { id: "book_club", label: "Book Club", iconName: "BookOpen", color: "#93C5FD", matchGenres: ["book-club"], matchTitle: /book club/i },
  { id: "live_music", label: "Live Music", iconName: "Waveform", color: "#F9A8D4", matchCategories: ["music"] },
];

const LINEUP_OVERRIDE_TAGS = new Set(["touring", "album-release", "one-night-only"]);
const LINEUP_SERIES_TYPES = new Set(["film", "tour", "festival_program"]);

function toNormalizedList(values: string[] | null | undefined): string[] {
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string")
    : [];
}

export function matchActivityType(event: SceneRoutableEvent): string | null {
  const genres = toNormalizedList(event.genres);
  const tags = toNormalizedList(event.tags);
  const category = event.category ?? event.category_id ?? "";
  const title = (event.title ?? "").toLowerCase();
  const combined = [...genres, ...tags];

  const genreMatches: SceneActivityType[] = [];
  for (const activityType of SCENE_ACTIVITY_TYPES) {
    if (activityType.matchGenres?.some((genre) => combined.includes(genre))) {
      genreMatches.push(activityType);
    }
  }

  if (genreMatches.length === 1) return genreMatches[0].id;

  if (genreMatches.length > 1) {
    for (const activityType of genreMatches) {
      if (activityType.matchTitle?.test(title)) return activityType.id;
    }
    return genreMatches[0].id;
  }

  for (const activityType of SCENE_ACTIVITY_TYPES) {
    if (activityType.matchCategories?.includes(category)) {
      for (const specificType of SCENE_ACTIVITY_TYPES) {
        if (specificType.matchTitle?.test(title)) return specificType.id;
      }
      return activityType.id;
    }
  }

  for (const activityType of SCENE_ACTIVITY_TYPES) {
    if (activityType.matchTitle?.test(title)) return activityType.id;
  }

  return null;
}

export function isSceneEvent(event: SceneRoutableEvent): boolean {
  const seriesId = event.series_id;
  const isRecurring = event.is_recurring;
  const isTentpole = event.is_tentpole;
  const festivalId = event.festival_id ?? event.series?.festival?.id ?? null;
  const tags = toNormalizedList(event.tags);
  const seriesType = event.series?.series_type;

  if (!seriesId && !isRecurring) return false;
  if (isTentpole) return false;
  if (festivalId) return false;
  if (tags.some((tag) => LINEUP_OVERRIDE_TAGS.has(tag))) return false;
  if (seriesType && LINEUP_SERIES_TYPES.has(seriesType)) return false;

  return matchActivityType(event) !== null;
}
