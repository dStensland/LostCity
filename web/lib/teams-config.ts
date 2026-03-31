// web/lib/teams-config.ts

/**
 * Static Atlanta team configurations for the Game Day feed section.
 * Mirrors the cinema-filter.ts pattern — static config, no DB table.
 *
 * sourceSlugs are resolved to integer source IDs at runtime (cached).
 * tags are used as fallback matching when source ID doesn't match.
 */

export type TeamConfig = {
  slug: string;
  name: string;
  shortName: string;
  sport: string;
  league: string;
  city: string;
  accentColor: string;
  logoUrl: string;
  sourceSlugs: string[];
  tags: string[];
  venueSlug?: string;
  defaultEnabled: boolean;
  priority: number;
  group: "major" | "minor" | "college" | "nearby" | "alternative";
};

export type GameEvent = {
  id: number;
  title: string;
  startDate: string;
  startTime: string | null;
  venueName: string;
  venueSlug: string;
  isFree: boolean;
  ticketUrl: string | null;
  imageUrl: string | null;
};

export type TeamSchedule = {
  slug: string;
  name: string;
  shortName: string;
  sport: string;
  league: string;
  accentColor: string;
  logoUrl: string;
  nextGame: GameEvent | null;
  upcoming: GameEvent[];
  totalUpcoming: number;
};

export type GameDayResponse = {
  teams: TeamSchedule[];
};

/** Sports-context tags — tag fallback requires one of these alongside a team tag */
export const SPORTS_CONTEXT_TAGS = new Set([
  "sports",
  "watch-party",
  "game-day",
  "home-game",
  "home-match",
]);

export const TEAMS: TeamConfig[] = [
  // ── Major Pro (default on) ──────────────────────────────────────
  {
    slug: "atlanta-hawks",
    name: "Atlanta Hawks",
    shortName: "Hawks",
    sport: "basketball",
    league: "NBA",
    city: "atlanta",
    accentColor: "#E03A3E",
    logoUrl: "/teams/hawks.png",
    sourceSlugs: ["atlanta-hawks"],
    tags: ["hawks", "atlanta-hawks"],
    venueSlug: "state-farm-arena",
    defaultEnabled: true,
    priority: 1,
    group: "major",
  },
  {
    slug: "atlanta-united",
    name: "Atlanta United",
    shortName: "United",
    sport: "soccer",
    league: "MLS",
    city: "atlanta",
    accentColor: "#80000B",
    logoUrl: "/teams/atlanta-united.png",
    sourceSlugs: ["atlanta-united-fc"],
    tags: ["atlanta-united", "atlutd"],
    venueSlug: "mercedes-benz-stadium",
    defaultEnabled: true,
    priority: 2,
    group: "major",
  },
  {
    slug: "atlanta-braves",
    name: "Atlanta Braves",
    shortName: "Braves",
    sport: "baseball",
    league: "MLB",
    city: "atlanta",
    accentColor: "#CE1141",
    logoUrl: "/teams/braves.png",
    sourceSlugs: ["truist-park"],
    tags: ["braves", "atlanta-braves"],
    venueSlug: "truist-park",
    defaultEnabled: true,
    priority: 3,
    group: "major",
  },
  {
    slug: "atlanta-falcons",
    name: "Atlanta Falcons",
    shortName: "Falcons",
    sport: "football",
    league: "NFL",
    city: "atlanta",
    accentColor: "#A71930",
    logoUrl: "/teams/falcons.png",
    sourceSlugs: [],
    tags: ["falcons", "atlanta-falcons"],
    venueSlug: "mercedes-benz-stadium",
    defaultEnabled: false,
    priority: 4,
    group: "major",
  },
  {
    slug: "atlanta-dream",
    name: "Atlanta Dream",
    shortName: "Dream",
    sport: "basketball",
    league: "WNBA",
    city: "atlanta",
    accentColor: "#E31937",
    logoUrl: "/teams/dream.png",
    sourceSlugs: ["atlanta-dream"],
    tags: ["dream", "atlanta-dream"],
    venueSlug: "gateway-center-arena",
    defaultEnabled: true,
    priority: 5,
    group: "major",
  },
  {
    slug: "atlanta-vibe",
    name: "Atlanta Vibe",
    shortName: "Vibe",
    sport: "volleyball",
    league: "PVF",
    city: "atlanta",
    accentColor: "#FF6B35",
    logoUrl: "/teams/vibe.png",
    sourceSlugs: ["atlanta-vibe"],
    tags: ["atlanta-vibe", "volleyball"],
    defaultEnabled: true,
    priority: 6,
    group: "major",
  },
  // ── Minor Pro (default on where data exists) ────────────────────
  {
    slug: "atlanta-gladiators",
    name: "Atlanta Gladiators",
    shortName: "Gladiators",
    sport: "hockey",
    league: "ECHL",
    city: "atlanta",
    accentColor: "#003DA5",
    logoUrl: "/teams/gladiators.png",
    sourceSlugs: ["atlanta-gladiators"],
    tags: ["gladiators", "atlanta-gladiators"],
    venueSlug: "gas-south-arena",
    defaultEnabled: true,
    priority: 7,
    group: "minor",
  },
  {
    slug: "gwinnett-stripers",
    name: "Gwinnett Stripers",
    shortName: "Stripers",
    sport: "baseball",
    league: "AAA",
    city: "atlanta",
    accentColor: "#F37021",
    logoUrl: "/teams/stripers.png",
    sourceSlugs: ["gwinnett-stripers"],
    tags: ["stripers", "gwinnett-stripers"],
    venueSlug: "coolray-field",
    defaultEnabled: true,
    priority: 8,
    group: "minor",
  },
  {
    slug: "college-park-skyhawks",
    name: "College Park Skyhawks",
    shortName: "Skyhawks",
    sport: "basketball",
    league: "G-League",
    city: "atlanta",
    accentColor: "#78BE20",
    logoUrl: "/teams/skyhawks.png",
    sourceSlugs: ["college-park-skyhawks"],
    tags: ["skyhawks", "college-park-skyhawks"],
    defaultEnabled: false,
    priority: 9,
    group: "minor",
  },
  {
    slug: "atlanta-hustle",
    name: "Atlanta Hustle",
    shortName: "Hustle",
    sport: "ultimate",
    league: "AUDL",
    city: "atlanta",
    accentColor: "#FFD100",
    logoUrl: "/teams/hustle.png",
    sourceSlugs: ["atlanta-hustle"],
    tags: ["hustle", "atlanta-hustle", "ultimate-frisbee"],
    defaultEnabled: true,
    priority: 10,
    group: "minor",
  },
  {
    slug: "georgia-swarm",
    name: "Georgia Swarm",
    shortName: "Swarm",
    sport: "lacrosse",
    league: "NLL",
    city: "atlanta",
    accentColor: "#F9A825",
    logoUrl: "/teams/swarm.png",
    sourceSlugs: ["georgia-swarm"],
    tags: ["swarm", "georgia-swarm"],
    defaultEnabled: true,
    priority: 11,
    group: "minor",
  },
  // ── College (default on) ────────────────────────────────────────
  {
    slug: "georgia-tech",
    name: "Georgia Tech Yellow Jackets",
    shortName: "Georgia Tech",
    sport: "multi",
    league: "NCAA",
    city: "atlanta",
    accentColor: "#B3A369",
    logoUrl: "/teams/georgia-tech.png",
    sourceSlugs: ["georgia-tech-athletics"],
    tags: ["georgia-tech", "yellow-jackets"],
    defaultEnabled: true,
    priority: 12,
    group: "college",
  },
  {
    slug: "georgia-state",
    name: "Georgia State Panthers",
    shortName: "Georgia State",
    sport: "multi",
    league: "NCAA",
    city: "atlanta",
    accentColor: "#0039A6",
    logoUrl: "/teams/georgia-state.png",
    sourceSlugs: ["gsu-athletics"],
    tags: ["georgia-state", "panthers"],
    defaultEnabled: true,
    priority: 13,
    group: "college",
  },
  // ── Nearby / Occasional (default off) ───────────────────────────
  {
    slug: "georgia-bulldogs",
    name: "Georgia Bulldogs",
    shortName: "UGA",
    sport: "multi",
    league: "NCAA",
    city: "atlanta",
    accentColor: "#BA0C2F",
    logoUrl: "/teams/uga.png",
    sourceSlugs: ["georgia-bulldogs-baseball-atlanta"],
    tags: ["bulldogs", "uga"],
    defaultEnabled: false,
    priority: 14,
    group: "nearby",
  },
  {
    slug: "atlanta-faze",
    name: "Atlanta FaZe",
    shortName: "FaZe",
    sport: "esports",
    league: "CDL",
    city: "atlanta",
    accentColor: "#EE1133",
    logoUrl: "/teams/faze.png",
    sourceSlugs: [],
    tags: ["faze", "call-of-duty"],
    defaultEnabled: false,
    priority: 15,
    group: "nearby",
  },
  // ── Alternative / Action (default off) ──────────────────────────
  {
    slug: "atlanta-roller-derby",
    name: "Atlanta Roller Derby",
    shortName: "Roller Derby",
    sport: "roller-derby",
    league: "WFTDA",
    city: "atlanta",
    accentColor: "#E91E63",
    logoUrl: "/teams/roller-derby.png",
    sourceSlugs: ["atlanta-roller-derby"],
    tags: ["roller-derby"],
    defaultEnabled: false,
    priority: 16,
    group: "alternative",
  },
  {
    slug: "nascar-ams",
    name: "NASCAR at AMS",
    shortName: "NASCAR",
    sport: "racing",
    league: "NASCAR",
    city: "atlanta",
    accentColor: "#FFD659",
    logoUrl: "/teams/nascar.png",
    sourceSlugs: ["atlanta-motor-speedway"],
    tags: ["nascar", "racing"],
    defaultEnabled: false,
    priority: 17,
    group: "alternative",
  },
  {
    slug: "supercross",
    name: "Supercross",
    shortName: "Supercross",
    sport: "motocross",
    league: "AMA",
    city: "atlanta",
    accentColor: "#FF5722",
    logoUrl: "/teams/supercross.png",
    sourceSlugs: [],
    tags: ["supercross", "motocross"],
    defaultEnabled: false,
    priority: 18,
    group: "alternative",
  },
  {
    slug: "monster-jam",
    name: "Monster Jam",
    shortName: "Monster Jam",
    sport: "monster-trucks",
    league: "",
    city: "atlanta",
    accentColor: "#4CAF50",
    logoUrl: "/teams/monster-jam.png",
    sourceSlugs: ["all-star-monster-trucks"],
    tags: ["monster-trucks", "monster-jam"],
    defaultEnabled: false,
    priority: 19,
    group: "alternative",
  },
  {
    slug: "wwe-aew",
    name: "WWE / AEW",
    shortName: "Wrestling",
    sport: "wrestling",
    league: "",
    city: "atlanta",
    accentColor: "#FFD700",
    logoUrl: "/teams/wrestling.png",
    sourceSlugs: [],
    tags: ["wwe", "aew", "wrestling"],
    defaultEnabled: false,
    priority: 20,
    group: "alternative",
  },
  {
    slug: "pbr-bull-riding",
    name: "PBR Bull Riding",
    shortName: "PBR",
    sport: "bull-riding",
    league: "PBR",
    city: "atlanta",
    accentColor: "#8B4513",
    logoUrl: "/teams/pbr.png",
    sourceSlugs: [],
    tags: ["pbr", "bull-riding"],
    defaultEnabled: false,
    priority: 21,
    group: "alternative",
  },
];

/** Teams that show by default before user customization */
export const DEFAULT_TEAM_SLUGS = TEAMS
  .filter((t) => t.defaultEnabled)
  .map((t) => t.slug);

/** All source slugs across all teams (for batch resolution) */
export const ALL_SOURCE_SLUGS = [
  ...new Set(TEAMS.flatMap((t) => t.sourceSlugs)),
].filter(Boolean);

/** Group labels for the customizer UI */
export const GROUP_LABELS: Record<TeamConfig["group"], string> = {
  major: "Major Pro",
  minor: "Minor Pro",
  college: "College",
  nearby: "Nearby / Occasional",
  alternative: "Alternative / Action",
};

/** Maps sport type to atmospheric photo path */
export const SPORT_PHOTOS: Record<string, string> = {
  basketball: "/sports/basketball.jpg",
  baseball: "/sports/baseball.jpg",
  soccer: "/sports/soccer.jpg",
  football: "/sports/football.jpg",
  hockey: "/sports/hockey.jpg",
  volleyball: "/sports/volleyball.jpg",
  lacrosse: "/sports/lacrosse.jpg",
  multi: "/sports/stadium.jpg",
  ultimate: "/sports/stadium.jpg",
};

/** Readable sport labels for display */
export const SPORT_LABELS: Record<string, string> = {
  basketball: "Basketball",
  baseball: "Baseball",
  soccer: "Soccer",
  football: "Football",
  hockey: "Hockey",
  volleyball: "Volleyball",
  lacrosse: "Lacrosse",
  multi: "College",
  ultimate: "Ultimate",
  "roller-derby": "Roller Derby",
  racing: "Racing",
  motocross: "Motocross",
  "monster-trucks": "Monster Trucks",
  wrestling: "Wrestling",
  "bull-riding": "Bull Riding",
  esports: "Esports",
};
