# Game Day Feed Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Game Day" carousel to the CityPulse feed showing upcoming games per Atlanta team, with a customizer for users to add/remove teams.

**Architecture:** Static TypeScript team config → API endpoint fetches sports events and matches to teams by source ID (cached) or tag fallback → Client carousel component mirrors NowShowingSection pattern with team cards + localStorage customizer. Integrates into CityPulseShell via the `"sports"` block ID in the feed layout system.

**Tech Stack:** Next.js 16 API route, Supabase PostgREST, React client component, localStorage, Phosphor Icons, existing portal-scope/feed-gate utilities.

**Spec:** `docs/superpowers/specs/2026-03-30-game-day-feed-section.md`

---

### Task 1: Teams Config and Types

**Files:**
- Create: `web/lib/teams-config.ts`

- [ ] **Step 1: Create the teams config file with types and full roster**

```ts
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
    logoUrl: "/teams/hawks.svg",
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
    logoUrl: "/teams/atlanta-united.svg",
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
    logoUrl: "/teams/braves.svg",
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
    logoUrl: "/teams/falcons.svg",
    sourceSlugs: [],
    tags: ["falcons", "atlanta-falcons"],
    venueSlug: "mercedes-benz-stadium",
    defaultEnabled: false, // no crawler yet, NFL season starts Sep
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
    logoUrl: "/teams/dream.svg",
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
    logoUrl: "/teams/vibe.svg",
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
    logoUrl: "/teams/gladiators.svg",
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
    logoUrl: "/teams/stripers.svg",
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
    logoUrl: "/teams/skyhawks.svg",
    sourceSlugs: ["college-park-skyhawks"],
    tags: ["skyhawks", "college-park-skyhawks"],
    defaultEnabled: false, // schedule expired
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
    logoUrl: "/teams/hustle.svg",
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
    logoUrl: "/teams/swarm.svg",
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
    logoUrl: "/teams/georgia-tech.svg",
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
    logoUrl: "/teams/georgia-state.svg",
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
    logoUrl: "/teams/uga.svg",
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
    logoUrl: "/teams/faze.svg",
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
    logoUrl: "/teams/roller-derby.svg",
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
    logoUrl: "/teams/nascar.svg",
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
    logoUrl: "/teams/supercross.svg",
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
    logoUrl: "/teams/monster-jam.svg",
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
    logoUrl: "/teams/wrestling.svg",
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
    logoUrl: "/teams/pbr.svg",
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `teams-config.ts`

- [ ] **Step 3: Commit**

```bash
git add web/lib/teams-config.ts
git commit -m "feat(game-day): add teams config with 21 Atlanta teams"
```

---

### Task 2: localStorage Helpers

**Files:**
- Create: `web/lib/my-teams.ts`

- [ ] **Step 1: Create the my-teams localStorage module**

```ts
// web/lib/my-teams.ts

/**
 * localStorage CRUD for user team preferences.
 * Mirrors my-theaters.ts: default teams show unless hidden,
 * non-default teams show when explicitly added.
 */

const STORAGE_KEY = "lostcity-my-teams";
const HIDDEN_KEY = "lostcity-hidden-teams";

export function getMyTeams(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load my teams:", e);
  }
  return [];
}

export function addMyTeam(slug: string): void {
  const current = getMyTeams();
  if (current.includes(slug)) return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, slug]));
  } catch (e) {
    console.error("Failed to save my team:", e);
  }
}

export function removeMyTeam(slug: string): void {
  const current = getMyTeams();
  const updated = current.filter((s) => s !== slug);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to remove my team:", e);
  }
}

export function getHiddenTeams(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(HIDDEN_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to load hidden teams:", e);
  }
  return [];
}

export function hideTeam(slug: string): void {
  const current = getHiddenTeams();
  if (current.includes(slug)) return;

  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...current, slug]));
  } catch (e) {
    console.error("Failed to hide team:", e);
  }
}

export function unhideTeam(slug: string): void {
  const current = getHiddenTeams();
  const updated = current.filter((s) => s !== slug);

  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to unhide team:", e);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/lib/my-teams.ts
git commit -m "feat(game-day): add localStorage helpers for team preferences"
```

---

### Task 3: API Endpoint

**Files:**
- Create: `web/app/api/portals/[slug]/game-day/route.ts`

This endpoint fetches sports events for the next 14 days, matches them to configured teams by source ID (cached) or tag fallback, and returns team schedules.

- [ ] **Step 1: Create the game-day API route**

```ts
// web/app/api/portals/[slug]/game-day/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createPortalScopedClient } from "@/lib/supabase/server";
import { getPortalBySlug } from "@/lib/portal";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { logger } from "@/lib/logger";
import { isValidUUID } from "@/lib/api-utils";
import {
  applyManifestFederatedScopeToQuery,
  excludeSensitiveEvents,
} from "@/lib/portal-scope";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFeedGate } from "@/lib/feed-gate";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import {
  TEAMS,
  ALL_SOURCE_SLUGS,
  SPORTS_CONTEXT_TAGS,
  type GameEvent,
  type TeamSchedule,
  type GameDayResponse,
  type TeamConfig,
} from "@/lib/teams-config";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const MAX_UPCOMING_PER_TEAM = 3;
const LOOKAHEAD_DAYS = 14;

// ── Source ID resolution (cached 1 hour) ──────────────────────────

async function getTeamSourceIdMap(
  supabase: ReturnType<typeof import("@supabase/supabase-js").createClient>,
): Promise<Record<string, number>> {
  // Use Record (plain object) instead of Map — Maps don't survive JSON serialization
  return getOrSetSharedCacheJson<Record<string, number>>(
    "feed-config",
    "team-source-ids",
    60 * 60 * 1000,
    async () => {
      if (ALL_SOURCE_SLUGS.length === 0) return {};
      const { data } = await supabase
        .from("sources")
        .select("id, slug")
        .in("slug", ALL_SOURCE_SLUGS);
      const result: Record<string, number> = {};
      for (const s of data ?? []) {
        result[(s as { slug: string }).slug] = (s as { id: number }).id;
      }
      return result;
    },
  );
}

function resolveSourceIdsForTeam(
  team: TeamConfig,
  slugToId: Record<string, number>,
): number[] {
  return team.sourceSlugs
    .map((slug) => slugToId[slug])
    .filter((id): id is number => id != null);
}

// ── Event-to-team matching ────────────────────────────────────────

type RawEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  source_id: number | null;
  tags: string[] | null;
  is_free: boolean;
  ticket_url: string | null;
  image_url: string | null;
  venue: {
    name: string;
    slug: string;
  } | null;
};

function matchEventToTeam(
  event: RawEvent,
  teams: TeamConfig[],
  teamSourceIds: Map<string, number[]>,
): string | null {
  // Pass 1: source ID match (authoritative)
  if (event.source_id != null) {
    for (const team of teams) {
      const ids = teamSourceIds.get(team.slug) ?? [];
      if (ids.includes(event.source_id)) return team.slug;
    }
  }

  // Pass 2: tag fallback (requires team tag + sports-context tag)
  const eventTags = event.tags ?? [];
  if (eventTags.length === 0) return null;

  const hasSportsContext = eventTags.some((t) => SPORTS_CONTEXT_TAGS.has(t));
  if (!hasSportsContext) return null;

  for (const team of teams) {
    if (team.tags.some((tag) => eventTags.includes(tag))) {
      return team.slug;
    }
  }

  return null;
}

function toGameEvent(raw: RawEvent): GameEvent {
  return {
    id: raw.id,
    title: raw.title,
    startDate: raw.start_date,
    startTime: raw.start_time,
    venueName: raw.venue?.name ?? "TBA",
    venueSlug: raw.venue?.slug ?? "",
    isFree: raw.is_free ?? false,
    ticketUrl: raw.ticket_url,
    imageUrl: raw.image_url,
  };
}

// ── Route handler ─────────────────────────────────────────────────

export async function GET(request: NextRequest, context: RouteContext) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await context.params;

  try {
    const portal = await getPortalBySlug(slug);
    if (!portal || !isValidUUID(portal.id)) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // Skip for portals where sports is irrelevant
    const vertical = portal.settings?.vertical;
    if (vertical === "community" || vertical === "hotel") {
      return NextResponse.json({ teams: [] } satisfies GameDayResponse);
    }

    const sourceAccess = await getPortalSourceAccess(portal.id);
    const portalClient = await createPortalScopedClient(portal.id);
    const manifest = buildPortalManifest({
      portalId: portal.id,
      slug: portal.slug,
      portalType: portal.portal_type,
      parentPortalId: portal.parent_portal_id,
      settings: portal.settings,
      filters: portal.filters as { city?: string; cities?: string[] } | null,
      sourceIds: sourceAccess.sourceIds,
    });

    // Resolve source slugs → IDs
    const slugToId = await getTeamSourceIdMap(portalClient);
    const teamSourceIds = new Map<string, number[]>();
    for (const team of TEAMS) {
      teamSourceIds.set(team.slug, resolveSourceIdsForTeam(team, slugToId));
    }

    // Date range
    const today = getLocalDateString(new Date());
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + LOOKAHEAD_DAYS);
    const endDateStr = endDate.toISOString().split("T")[0];

    // Fetch sports events
    let query = portalClient
      .from("events")
      .select(`
        id,
        title,
        start_date,
        start_time,
        source_id,
        tags,
        is_free,
        ticket_url,
        image_url,
        venue:places!inner(name, slug)
      `)
      .eq("category_id", "sports")
      .gte("start_date", today)
      .lte("start_date", endDateStr)
      .eq("is_active", true)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true });

    query = applyFeedGate(query);
    query = applyManifestFederatedScopeToQuery(query, manifest, {
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds,
      sourceColumn: "source_id",
    });
    query = excludeSensitiveEvents(query);

    const { data: rawEvents, error: queryError } = await query;

    if (queryError) {
      logger.error("Error fetching game-day events:", queryError);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    const events = (rawEvents ?? []) as unknown as RawEvent[];

    // Match events to teams (sorted by priority)
    const sortedTeams = [...TEAMS].sort((a, b) => a.priority - b.priority);
    const teamEvents = new Map<string, RawEvent[]>();
    for (const team of sortedTeams) {
      teamEvents.set(team.slug, []);
    }

    for (const event of events) {
      const teamSlug = matchEventToTeam(event, sortedTeams, teamSourceIds);
      if (teamSlug) {
        teamEvents.get(teamSlug)?.push(event);
      }
    }

    // Build response — only teams with events
    const teamSchedules: TeamSchedule[] = [];
    for (const team of sortedTeams) {
      const matched = teamEvents.get(team.slug) ?? [];
      if (matched.length === 0) continue;

      teamSchedules.push({
        slug: team.slug,
        name: team.name,
        shortName: team.shortName,
        sport: team.sport,
        league: team.league,
        accentColor: team.accentColor,
        logoUrl: team.logoUrl,
        nextGame: toGameEvent(matched[0]),
        upcoming: matched.slice(1, 1 + MAX_UPCOMING_PER_TEAM).map(toGameEvent),
        totalUpcoming: Math.max(0, matched.length - 1),
      });
    }

    const response: GameDayResponse = { teams: teamSchedules };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    logger.error("Game day API error:", error instanceof Error ? { error: error.message } : {});
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors. If there are type issues with the `getOrSetSharedCacheJson` return type (it serializes to JSON, Maps don't survive), fix by using a plain object `Record<string, number>` instead of `Map` for the cache — convert to Map after retrieval.

- [ ] **Step 3: Test the endpoint locally**

Run: `curl -s http://localhost:3000/api/portals/atlanta/game-day | jq '.teams | length'`
Expected: A number (0+ depending on current sports data). Verify the response shape matches `GameDayResponse`.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/portals/[slug]/game-day/route.ts
git commit -m "feat(game-day): add API endpoint for team schedules"
```

---

### Task 4: Team Logo Placeholders

**Files:**
- Create: `web/public/teams/` directory with 21 SVG placeholder files

Team logos require licensing. For now, create simple colored circle placeholders with the team's first letter. These will be replaced with real logos later.

- [ ] **Step 1: Create the teams directory and generate placeholder SVGs**

Create a simple script or manually create SVG files. Each is a 48x48 colored circle with a white letter:

```bash
mkdir -p web/public/teams
```

For each team, create a file like `web/public/teams/hawks.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="24" fill="#E03A3E"/>
  <text x="24" y="24" text-anchor="middle" dominant-baseline="central" font-family="system-ui" font-size="20" font-weight="700" fill="white">H</text>
</svg>
```

Generate all 21 files with the correct color and letter for each team. Use the `accentColor` from teams-config.ts and the first letter of `shortName`.

Full list:
- `hawks.svg` — H, #E03A3E
- `atlanta-united.svg` — U, #80000B
- `braves.svg` — B, #CE1141
- `falcons.svg` — F, #A71930
- `dream.svg` — D, #E31937
- `vibe.svg` — V, #FF6B35
- `gladiators.svg` — G, #003DA5
- `stripers.svg` — S, #F37021
- `skyhawks.svg` — S, #78BE20
- `hustle.svg` — H, #FFD100
- `swarm.svg` — S, #F9A825
- `georgia-tech.svg` — GT, #B3A369
- `georgia-state.svg` — GS, #0039A6
- `uga.svg` — UG, #BA0C2F
- `faze.svg` — F, #EE1133
- `roller-derby.svg` — RD, #E91E63
- `nascar.svg` — N, #FFD659
- `supercross.svg` — SX, #FF5722
- `monster-jam.svg` — MJ, #4CAF50
- `wrestling.svg` — W, #FFD700
- `pbr.svg` — P, #8B4513

- [ ] **Step 2: Verify files exist**

Run: `ls web/public/teams/*.svg | wc -l`
Expected: `21`

- [ ] **Step 3: Commit**

```bash
git add web/public/teams/
git commit -m "feat(game-day): add placeholder team logo SVGs"
```

---

### Task 5: GameDaySection Component

**Files:**
- Create: `web/components/feed/sections/GameDaySection.tsx`

This is the main component. It fetches from the game-day API, renders team cards in a horizontal carousel, and includes the team customizer. Follows NowShowingSection exactly.

- [ ] **Step 1: Create the GameDaySection component**

```tsx
// web/components/feed/sections/GameDaySection.tsx
"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";
import {
  Trophy,
  GearSix,
  Plus,
  X,
  MagnifyingGlass,
  Minus,
} from "@phosphor-icons/react";
import { useAuth } from "@/lib/auth-context";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import SmartImage from "@/components/SmartImage";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { formatTime, getLocalDateString } from "@/lib/formats";
import {
  getMyTeams,
  addMyTeam,
  removeMyTeam,
  getHiddenTeams,
  hideTeam,
  unhideTeam,
} from "@/lib/my-teams";
import {
  TEAMS,
  GROUP_LABELS,
  type TeamConfig,
  type TeamSchedule,
  type GameDayResponse,
} from "@/lib/teams-config";

// ── Constants ─────────────────────────────────────────────────────

const CARD_WIDTH = 256; // w-64
const GAP = 12; // gap-3

// ── Component ─────────────────────────────────────────────────────

interface GameDaySectionProps {
  portalSlug: string;
}

export default function GameDaySection({ portalSlug }: GameDaySectionProps) {
  const { user } = useAuth();
  const [allTeams, setAllTeams] = useState<TeamSchedule[]>([]);
  const [myTeamSlugs, setMyTeamSlugs] = useState<string[]>([]);
  const [hiddenTeamSlugs, setHiddenTeamSlugs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerSearch, setCustomizerSearch] = useState("");

  // Carousel state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Load data
  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/portals/${portalSlug}/game-day`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<GameDayResponse>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setAllTeams(data.teams);
        setMyTeamSlugs(getMyTeams());
        setHiddenTeamSlugs(getHiddenTeams());
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setFailed(true);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [portalSlug]);

  // Build display list: default teams (minus hidden) + user-added teams
  const displayedTeams = useMemo(() => {
    const hiddenSet = new Set(hiddenTeamSlugs);
    const teamConfigMap = new Map(TEAMS.map((t) => [t.slug, t]));

    // Default teams with data, not hidden
    const defaults = allTeams
      .filter((t) => {
        const config = teamConfigMap.get(t.slug);
        return config?.defaultEnabled && !hiddenSet.has(t.slug);
      })
      .sort((a, b) => {
        const pa = teamConfigMap.get(a.slug)?.priority ?? 99;
        const pb = teamConfigMap.get(b.slug)?.priority ?? 99;
        return pa - pb;
      });

    // User-added non-default teams with data
    const userAdded = myTeamSlugs
      .map((slug) => allTeams.find((t) => t.slug === slug))
      .filter((t): t is TeamSchedule => Boolean(t))
      .filter((t) => {
        const config = teamConfigMap.get(t.slug);
        return !config?.defaultEnabled;
      });

    return [...defaults, ...userAdded];
  }, [allTeams, myTeamSlugs, hiddenTeamSlugs]);

  const totalCards = displayedTeams.length;

  // Track active card index for mobile dot indicators
  const updateScrollState = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft } = scrollRef.current;
    const index = Math.round(scrollLeft / (CARD_WIDTH + GAP));
    setActiveIndex(Math.min(index, Math.max(totalCards - 1, 0)));
  }, [totalCards]);

  useEffect(() => {
    if (!scrollRef.current) return;
    updateScrollState();

    const el = scrollRef.current;
    el.addEventListener("scroll", updateScrollState, { passive: true });

    let resizeTimer: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateScrollState, 150);
    });
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      clearTimeout(resizeTimer);
      resizeObserver.disconnect();
    };
  }, [updateScrollState]);

  // Add/remove/hide/unhide team handlers
  const handleAddTeam = (slug: string, isDefault: boolean) => {
    if (isDefault) {
      unhideTeam(slug);
      setHiddenTeamSlugs(getHiddenTeams());
    } else {
      addMyTeam(slug);
      setMyTeamSlugs(getMyTeams());
    }
  };

  const handleRemoveTeam = (slug: string, isDefault: boolean) => {
    if (isDefault) {
      hideTeam(slug);
      setHiddenTeamSlugs(getHiddenTeams());
    } else {
      removeMyTeam(slug);
      setMyTeamSlugs(getMyTeams());
    }
  };

  // Teams available to add in customizer
  const availableTeams = useMemo(() => {
    const displayedSlugs = new Set(displayedTeams.map((t) => t.slug));
    const hiddenSet = new Set(hiddenTeamSlugs);
    const q = customizerSearch.toLowerCase();

    const matchesSearch = (t: TeamConfig) => {
      if (!customizerSearch) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.shortName.toLowerCase().includes(q) ||
        t.sport.toLowerCase().includes(q) ||
        t.league.toLowerCase().includes(q)
      );
    };

    // All teams not currently displayed (either hidden defaults or non-default non-added)
    return TEAMS
      .filter((t) => !displayedSlugs.has(t.slug) || hiddenSet.has(t.slug))
      .filter((t) => !displayedSlugs.has(t.slug))
      .filter(matchesSearch)
      .sort((a, b) => a.priority - b.priority);
  }, [displayedTeams, hiddenTeamSlugs, customizerSearch]);

  // ── Render gates ────────────────────────────────────────────────

  if (loading) {
    return (
      <section className="pb-2">
        <FeedSectionHeader
          title="Game Day"
          priority="secondary"
          accentColor="var(--neon-cyan)"
          icon={<Trophy weight="duotone" className="w-5 h-5" />}
          seeAllHref={`/${portalSlug}?view=happening&category=sports`}
        />
        <div className="flex gap-3 overflow-hidden">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-64 rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
            >
              <div className="h-8 bg-[var(--twilight)]/20" />
              <div className="p-3 space-y-2.5">
                <div className="h-4 bg-[var(--twilight)]/30 rounded w-3/4" />
                <div className="space-y-1.5">
                  <div className="h-3 bg-[var(--twilight)]/15 rounded w-full" />
                  <div className="h-3 bg-[var(--twilight)]/15 rounded w-5/6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (failed || displayedTeams.length === 0) return null;

  return (
    <section className="pb-2 feed-section-enter">
      <FeedSectionHeader
        title="Game Day"
        priority="secondary"
        accentColor="var(--neon-cyan)"
        icon={<Trophy weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=happening&category=sports`}
        actionIcon={user ? <GearSix weight="bold" className="w-3.5 h-3.5" /> : undefined}
        onAction={user ? () => setCustomizerOpen((v) => !v) : undefined}
        actionActive={customizerOpen}
        actionLabel="Customize teams"
      />

      {/* Carousel */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth"
        >
          {displayedTeams.map((team) => (
            <TeamCard key={team.slug} team={team} portalSlug={portalSlug} />
          ))}
        </div>

        {/* Mobile scroll indicator */}
        {totalCards > 1 && (
          <div className="flex sm:hidden justify-center items-center gap-1.5 mt-3">
            {totalCards <= 7 ? (
              Array.from({ length: totalCards }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (scrollRef.current) {
                      scrollRef.current.scrollTo({
                        left: idx * (CARD_WIDTH + GAP),
                        behavior: "smooth",
                      });
                    }
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === activeIndex
                      ? "bg-[var(--neon-cyan)] w-4"
                      : "bg-[var(--twilight)] hover:bg-[var(--muted)] w-1.5"
                  }`}
                  aria-label={`Go to card ${idx + 1}`}
                />
              ))
            ) : (
              <span className="text-2xs font-mono tabular-nums text-[var(--muted)]">
                {activeIndex + 1} / {totalCards}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Team customizer */}
      {customizerOpen && (
        <TeamCustomizer
          displayedTeams={displayedTeams}
          availableTeams={availableTeams}
          search={customizerSearch}
          onSearchChange={setCustomizerSearch}
          onAdd={handleAddTeam}
          onRemove={handleRemoveTeam}
          onClose={() => {
            setCustomizerOpen(false);
            setCustomizerSearch("");
          }}
        />
      )}
    </section>
  );
}

// ── TeamCard ──────────────────────────────────────────────────────

function TeamCard({
  team,
  portalSlug,
}: {
  team: TeamSchedule;
  portalSlug: string;
}) {
  const colorClass = createCssVarClass("--team-accent", team.accentColor, "team-accent");
  const today = getLocalDateString(new Date());
  const isTonight = team.nextGame?.startDate === today;

  return (
    <>
      {colorClass?.css && <ScopedStyles css={colorClass.css} />}
      <div className="flex-shrink-0 w-64 snap-start rounded-card overflow-hidden bg-[var(--night)] shadow-card-sm hover-lift border border-[var(--twilight)]/40">
        {/* Team color gradient band */}
        <div
          className="h-8"
          style={{
            background: `linear-gradient(180deg, ${team.accentColor}20 0%, transparent 100%)`,
            borderTop: `2px solid ${team.accentColor}`,
          }}
        />

        {/* Team header */}
        <div className="px-3 pb-2 -mt-1">
          <div className="flex items-center gap-2">
            <SmartImage
              src={team.logoUrl}
              alt={team.shortName}
              width={24}
              height={24}
              className="rounded-full"
              fallback={
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-2xs font-bold text-white"
                  style={{ backgroundColor: team.accentColor }}
                >
                  {team.shortName.charAt(0)}
                </div>
              }
            />
            <span className="text-base font-semibold text-[var(--cream)] truncate flex-1 min-w-0">
              {team.shortName}
            </span>
            {team.league && (
              <span className="shrink-0 text-2xs font-mono font-bold uppercase tracking-wider text-[var(--muted)]">
                {team.league}
              </span>
            )}
          </div>
        </div>

        {/* Next game */}
        {team.nextGame && (
          <Link
            href={`/${portalSlug}/events/${team.nextGame.id}`}
            prefetch={false}
            className="group block px-3 pb-2"
          >
            <p className="text-sm font-medium text-[var(--soft)] group-hover:text-[var(--cream)] transition-colors truncate">
              {team.nextGame.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {isTonight && (
                <span className="px-1.5 py-0.5 rounded text-2xs font-mono font-bold uppercase tracking-wider bg-[var(--neon-red)]/15 text-[var(--neon-red)]">
                  Tonight
                </span>
              )}
              {team.nextGame.startTime && (
                <span className="px-1.5 py-0.5 rounded bg-[var(--gold)]/10 text-2xs font-mono tabular-nums text-[var(--gold)]/80">
                  {formatTime(team.nextGame.startTime)}
                </span>
              )}
              {!isTonight && (
                <span className="px-1.5 py-0.5 rounded bg-[var(--twilight)]/60 text-2xs font-mono tabular-nums text-[var(--muted)]">
                  {formatShortDate(team.nextGame.startDate)}
                </span>
              )}
              {team.nextGame.isFree && (
                <span className="px-1.5 py-0.5 rounded text-2xs font-mono font-bold uppercase tracking-wider bg-[var(--neon-green)]/15 text-[var(--neon-green)]">
                  Free
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)] mt-1 truncate">
              {team.nextGame.venueName}
            </p>
          </Link>
        )}

        {/* Upcoming games */}
        {team.upcoming.length > 0 && (
          <div className="border-t border-[var(--twilight)]/30 mx-3" />
        )}
        <div className="pb-2.5">
          {team.upcoming.map((game) => (
            <Link
              key={game.id}
              href={`/${portalSlug}/events/${game.id}`}
              prefetch={false}
              className="group block px-3 py-1 transition-colors hover:bg-[var(--cream)]/[0.03]"
            >
              <span className="text-xs text-[var(--muted)] group-hover:text-[var(--soft)] transition-colors">
                {game.title}
                <span className="text-[var(--twilight)] mx-1">·</span>
                {formatShortDate(game.startDate)}
                {game.startTime && (
                  <>
                    <span className="text-[var(--twilight)] mx-1">·</span>
                    {formatTime(game.startTime)}
                  </>
                )}
              </span>
            </Link>
          ))}
          {team.totalUpcoming > 3 && (
            <Link
              href={`/${portalSlug}?view=happening&category=sports&q=${encodeURIComponent(team.shortName)}`}
              className="block px-3 py-1 text-xs text-[var(--neon-cyan)]/70 hover:text-[var(--neon-cyan)] transition-colors"
            >
              +{team.totalUpcoming - 3} more →
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

/** Format date as "Apr 2" */
function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── TeamCustomizer ────────────────────────────────────────────────

function TeamCustomizer({
  displayedTeams,
  availableTeams,
  search,
  onSearchChange,
  onAdd,
  onRemove,
  onClose,
}: {
  displayedTeams: TeamSchedule[];
  availableTeams: TeamConfig[];
  search: string;
  onSearchChange: (v: string) => void;
  onAdd: (slug: string, isDefault: boolean) => void;
  onRemove: (slug: string, isDefault: boolean) => void;
  onClose: () => void;
}) {
  const teamConfigMap = new Map(TEAMS.map((t) => [t.slug, t]));

  const matchesSearch = (t: TeamSchedule) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.shortName.toLowerCase().includes(q) ||
      t.sport.toLowerCase().includes(q) ||
      t.league.toLowerCase().includes(q)
    );
  };

  const filteredCurrent = displayedTeams.filter(matchesSearch);
  const hasResults = filteredCurrent.length > 0 || availableTeams.length > 0;

  // Group available teams by group
  const groupedAvailable = new Map<string, TeamConfig[]>();
  for (const team of availableTeams) {
    const group = team.group;
    if (!groupedAvailable.has(group)) {
      groupedAvailable.set(group, []);
    }
    groupedAvailable.get(group)!.push(team);
  }

  return (
    <div className="mt-2 rounded-card border border-[var(--twilight)]/40 bg-[var(--night)] p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--cream)]">
          Customize teams
        </span>
        <button
          onClick={onClose}
          className="p-2.5 -m-2 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          aria-label="Close customizer"
        >
          <X weight="bold" className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Search input */}
      <div className="relative mb-2">
        <MagnifyingGlass
          weight="bold"
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search teams..."
          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-xs text-[var(--cream)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--neon-cyan)] transition-colors"
        />
      </div>

      <div className="max-h-56 overflow-y-auto">
        {!hasResults && (
          <p className="text-xs text-[var(--muted)] py-3 text-center">
            No teams match your search
          </p>
        )}

        {/* Your teams */}
        {filteredCurrent.length > 0 && (
          <div>
            <div className="px-2 py-1.5">
              <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--muted)]">
                Your teams
              </span>
            </div>
            <div className="space-y-0.5">
              {filteredCurrent.map((team) => {
                const config = teamConfigMap.get(team.slug);
                const isDefault = config?.defaultEnabled ?? false;
                return (
                  <div
                    key={team.slug}
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--cream)]/[0.03] transition-colors"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: team.accentColor }}
                      />
                      <div className="text-xs text-[var(--cream)] truncate">
                        {team.name}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(team.slug, isDefault)}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[var(--muted)] text-2xs font-semibold hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
                    >
                      <Minus weight="bold" className="w-2.5 h-2.5" />
                      Hide
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Add teams — grouped by category */}
        {[...groupedAvailable.entries()].map(([group, teams]) => (
          <div key={group} className={filteredCurrent.length > 0 || groupedAvailable.size > 1 ? "mt-2" : ""}>
            <div className="px-2 py-1.5">
              <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--muted)]">
                {GROUP_LABELS[group as keyof typeof GROUP_LABELS] ?? group}
              </span>
            </div>
            <div className="space-y-0.5">
              {teams.map((team) => (
                <div
                  key={team.slug}
                  className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--cream)]/[0.03] transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: team.accentColor }}
                    />
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--cream)] truncate">
                        {team.name}
                      </div>
                      <div className="text-2xs text-[var(--muted)]">
                        {team.sport} · {team.league || "—"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onAdd(team.slug, team.defaultEnabled)}
                    className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)] text-2xs font-semibold hover:bg-[var(--neon-cyan)]/25 transition-colors"
                  >
                    <Plus weight="bold" className="w-2.5 h-2.5" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors. Common issue: `formatTime` may not accept `null` — ensure we only call it when `startTime` is non-null (the code above guards this with `&&`).

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/GameDaySection.tsx
git commit -m "feat(game-day): add GameDaySection carousel + team customizer"
```

---

### Task 6: Feed Integration

**Files:**
- Modify: `web/lib/city-pulse/types.ts` — add `"sports"` to `FeedBlockId`
- Modify: `web/components/feed/CityPulseShell.tsx` — add sports block + dynamic import

- [ ] **Step 1: Add "sports" to FeedBlockId and DEFAULT_FEED_ORDER**

In `web/lib/city-pulse/types.ts`, add `"sports"` to the `FeedBlockId` union type and `DEFAULT_FEED_ORDER`:

```ts
// In FeedBlockId union, add "sports" after "cinema":
export type FeedBlockId =
  | "briefing"
  | "events"
  | "hangs"
  | "recurring"
  | "festivals"
  // ... existing entries
  | "cinema"
  | "sports"   // ← ADD
  | "horizon"
  | "browse";

// In DEFAULT_FEED_ORDER, add "sports" after "cinema":
export const DEFAULT_FEED_ORDER: FeedBlockId[] = [
  "briefing",
  "events",
  "cinema",
  "sports",   // ← ADD
  "horizon",
  "browse",
];
```

- [ ] **Step 2: Add GameDaySection to CityPulseShell**

In `web/components/feed/CityPulseShell.tsx`:

Add the dynamic import near the other dynamic imports (around line 76):

```ts
const GameDaySection = dynamic(() => import("./sections/GameDaySection"), { ssr: false });
```

Add a case in the `renderMiddleSection` switch (after the `"cinema"` case, before `default`):

```tsx
case "sports":
  return (
    <div
      key="city-pulse-sports"
      id="city-pulse-sports"
      data-feed-anchor="true"
      data-index-label="Game Day"
      data-block-id="sports"
      className="mt-8 scroll-mt-28"
    >
      <div className="h-px bg-[var(--twilight)]" />
      <div className="pt-6">
        <LazySection minHeight={200}>
          <GameDaySection portalSlug={portalSlug} />
        </LazySection>
      </div>
    </div>
  );
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Verify the section renders in the feed**

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:3000/atlanta`
3. Scroll past See Shows — Game Day section should appear (or not appear if no sports events exist, which is correct behavior)
4. Check the API response: `curl -s http://localhost:3000/api/portals/atlanta/game-day | jq .`

- [ ] **Step 5: Commit**

```bash
git add web/lib/city-pulse/types.ts web/components/feed/CityPulseShell.tsx
git commit -m "feat(game-day): integrate GameDaySection into CityPulse feed"
```

---

### Task 7: Upstream Fix — Tag Inference False Positive

**Files:**
- Modify: `crawlers/tag_inference.py` — tighten "united" soccer pattern

This is the upstream fix from the data quality review. The bare `"united"` keyword in the soccer sports pattern matches non-sports events (United Way, United Methodist, etc.).

- [ ] **Step 1: Find and fix the soccer pattern in tag_inference.py**

Search for the soccer genre pattern (around line 1532). Change bare `"united"` to `"atlanta united"`:

The pattern will look something like:
```python
"soccer": [..., "united", ...]
```

Change to:
```python
"soccer": [..., "atlanta united", "atlutd", ...]
```

Remove the bare `"united"` entry. Keep `"atlanta united"` and `"atlutd"` which are specific enough to avoid false positives.

- [ ] **Step 2: Run crawler tests**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python -m pytest tests/ -x -q 2>&1 | tail -10`
Expected: All tests pass. If any test relied on bare "united" matching, update the test to use "atlanta united" instead.

- [ ] **Step 3: Commit**

```bash
git add crawlers/tag_inference.py
git commit -m "fix(crawlers): tighten soccer tag pattern to avoid 'united' false positives"
```

---

### Task 8: Browser QA

**Files:** None (verification only)

- [ ] **Step 1: Verify the feed loads without errors**

Open `http://localhost:3000/atlanta` in the browser. Check:
- No console errors
- Game Day section appears (or correctly doesn't appear if no sports data)
- Section is positioned after See Shows

- [ ] **Step 2: Verify team cards render correctly**

If team cards are visible:
- Team color gradient band at top
- Team logo + name + league badge
- Next game with time chips
- Upcoming games listed below divider
- "+N more →" link works
- Card links navigate to event detail pages

- [ ] **Step 3: Test the customizer**

If logged in:
- Gear icon appears in section header
- Click gear → customizer panel opens below carousel
- "Your teams" shows current teams with Hide button
- "Add teams" shows grouped available teams
- Search filters by team name, sport, league
- Add/Remove persists (refresh page → same teams shown)

- [ ] **Step 4: Test on mobile viewport (375px)**

- Carousel scrolls horizontally with snap
- Dot indicators or counter shown
- Cards don't overflow
- Customizer is usable on mobile

- [ ] **Step 5: Test on non-Atlanta portals**

Check that `http://localhost:3000/helpatl` (civic portal) does NOT show Game Day section. The API returns empty `{ teams: [] }` for community/hotel verticals.

- [ ] **Step 6: Commit any fixes discovered during QA**

```bash
git add -A
git commit -m "fix(game-day): QA fixes from browser testing"
```
