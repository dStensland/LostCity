/**
 * Client-safe types and utilities for artist display.
 * These can be used in both client and server components.
 * Data-fetching functions live in lib/artists.ts (server-only).
 */

export interface Artist {
  id: string;
  name: string;
  slug: string;
  discipline: string;
  bio: string | null;
  image_url: string | null;
  genres: string[] | null;
  hometown: string | null;
  website: string | null;
  spotify_id: string | null;
  musicbrainz_id: string | null;
  wikidata_id: string | null;
  created_at: string;
}

export interface EventArtist {
  id: number;
  event_id: number;
  name: string;
  role: string | null;
  billing_order: number | null;
  is_headliner: boolean;
  artist: Artist | null;
}

export interface ArtistEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  category: string | null;
  image_url: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
  role: string | null;
  is_headliner: boolean;
}

export interface ArtistFestival {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  announced_start: string | null;
  announced_end: string | null;
  categories: string[] | null;
}

export type LineupLabelContext = {
  eventCategory?: string | null;
};

export type EventParticipantContext = LineupLabelContext & {
  eventTitle?: string | null;
};

/** Map artist discipline to category color CSS variable */
export function getDisciplineColor(discipline: string): string {
  const colors: Record<string, string> = {
    musician: "var(--neon-magenta)",
    band: "var(--neon-magenta)",
    dj: "var(--neon-cyan)",
    comedian: "var(--neon-amber)",
    visual_artist: "var(--neon-purple)",
    actor: "var(--coral)",
    speaker: "var(--gold)",
    filmmaker: "var(--neon-cyan)",
    author: "var(--gold)",
  };
  return colors[discipline] || "var(--coral)";
}

/** Map artist discipline to a display label */
export function getDisciplineLabel(discipline: string): string {
  const labels: Record<string, string> = {
    musician: "Musician",
    band: "Band",
    dj: "DJ",
    comedian: "Comedian",
    visual_artist: "Visual Artist",
    actor: "Actor",
    speaker: "Speaker",
    filmmaker: "Filmmaker",
    author: "Author",
  };
  return labels[discipline] || discipline.replace(/_/g, " ");
}

const KNOWN_ENTITY_WEBSITES: Record<string, string> = {
  "atlanta braves": "https://www.mlb.com/braves",
  "atlanta dream": "https://dream.wnba.com",
  "atlanta falcons": "https://www.atlantafalcons.com",
  "atlanta gladiators": "https://atlantagladiators.com",
  "atlanta hawks": "https://www.nba.com/hawks",
  "atlanta united": "https://www.atlutd.com",
  "georgia bulldogs": "https://georgiadogs.com",
  "georgia swarm": "https://www.georgiaswarm.com",
  "georgia tech yellow jackets": "https://ramblinwreck.com",
  "gwinnett stripers": "https://www.milb.com/gwinnett",
  "kennesaw state owls": "https://ksuowls.com",
  "kennesaw state": "https://ksuowls.com",
};

function normalizeText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEntityName(value: string | null | undefined): string {
  return normalizeText(value)
    .replace(/\b(updated|date|rescheduled|postponed|cancelled|canceled)\b/g, " ")
    .replace(/\b(fc|sc|club|team|women|womens|men|mens|athletics)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTeamName(value: string): string {
  return value
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s*(?:\||-|–|—)\s*(?:suite|suites|parking|vip|package|packages|tickets?).*$/i, "")
    .replace(/\s*(?:\||-|–|—)\s*(?:updated date|rescheduled|postponed|cancelled|canceled).*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSportsTeamsFromTitle(title: string | null | undefined): string[] {
  const raw = (title || "").trim();
  if (!raw) return [];

  const patterns = [
    /^(.+?)\s+(?:vs\.?|v\.?|versus)\s+(.+)$/i,
    /^(.+?)\s+@\s+(.+)$/i,
    /^(.+?)\s+at\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    const a = cleanTeamName(match?.[1] || "");
    const b = cleanTeamName(match?.[2] || "");
    if (!a || !b) continue;
    if (normalizeText(a) === normalizeText(b)) continue;
    return [a, b];
  }

  return [];
}

function extractLikelyHeadlinerFromTitle(title: string | null | undefined): string | null {
  let cleaned = (title || "").trim();
  if (!cleaned) return null;

  cleaned = cleaned
    .replace(/\bSOLD OUT\b\s*[-:]*\s*/gi, "")
    .replace(/\b(POSTPONED|CANCELLED|CANCELED|RESCHEDULED)\b\s*[-:]*\s*/gi, "")
    .replace(/^An Evening [Ww]ith\s+/, "")
    .trim();

  const splitters = [
    /\s+w\/\s+/i,
    /\s+with\s+/i,
    /\s+feat\.?\s+/i,
    /\s+featuring\s+/i,
    /\s+ft\.?\s+/i,
    /\s*[-–—]\s+/,
    /:\s+/,
    /\s+\+\s+/,
    /\s+\|\s+/,
  ];

  for (const splitter of splitters) {
    const parts = cleaned.split(splitter);
    if (parts.length > 1) {
      cleaned = parts[0].trim();
      break;
    }
  }

  if (!cleaned) return null;
  cleaned = cleaned.replace(/\bpresents?\b\s*$/i, "").trim();
  if (looksLikeEventBoilerplate(cleaned)) return null;
  if (cleaned.length < 3) return null;
  if (/^\d+$/.test(cleaned)) return null;
  return cleaned;
}

function dedupeParticipants(artists: EventArtist[]): EventArtist[] {
  const seen = new Set<string>();
  const unique: EventArtist[] = [];

  const sorted = [...artists].sort((a, b) => {
    const aHead = a.is_headliner || a.billing_order === 1 ? 0 : 1;
    const bHead = b.is_headliner || b.billing_order === 1 ? 0 : 1;
    if (aHead !== bHead) return aHead - bHead;

    const aOrder = a.billing_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.billing_order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return (a.artist?.name || a.name).localeCompare(b.artist?.name || b.name);
  });

  for (const artist of sorted) {
    const key = artist.artist?.id
      ? `id:${artist.artist.id}`
      : artist.artist?.slug
        ? `slug:${artist.artist.slug}`
        : `name:${normalizeText(artist.artist?.name || artist.name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(artist);
  }

  return unique;
}

function looksLikeEventBoilerplate(name: string): boolean {
  return /(open mic|comedy night|home game|suites?|parking|ticket package|package deal|class|workshop|session|presented by)/i.test(name);
}

function hasEventishKeywords(name: string): boolean {
  return /(registration|session|class|workshop|course|seminar|training|lecture|masterclass|camp|mixer|screening|meet and greet|festival|trivia|karaoke|open play|hospitality|voucher|package|add on|add-on|tour)/i.test(name);
}

function isLowSignalParticipantName(name: string, category: string): boolean {
  const normalized = normalizeText(name);
  if (!normalized) return true;

  if (looksLikeEventBoilerplate(name)) return true;

  if (category === "music") {
    return /^(behind the curtain|suite add ons?|delta sky360 club|new faces night|open mic|karaoke)/i.test(normalized);
  }

  if (category === "sports") {
    return /(session|courtside|hospitality|package|voucher|parking|suite)/i.test(name);
  }

  if (category === "comedy") {
    return /(open mic|comedy night|socially awkward comedy)/i.test(name);
  }

  if (category === "nightlife") {
    return /(trivia|karaoke|\$?\d+\s*beer|dance party|open play)/i.test(name);
  }

  if (category === "film") {
    return /(screening|film festival|movie night)/i.test(name);
  }

  if (category === "learning") {
    return /(class|course|workshop|session|seminar|training|lecture|masterclass)/i.test(name);
  }

  if (category === "community") {
    return /(registration|meeting|mixer|open house|networking|group|advocacy day)/i.test(name);
  }

  if (category === "words") {
    return /(workshop|club|reading hour|tax preparation)/i.test(name);
  }

  if (category === "art") {
    return /(camp|club|workshop|mixer|studio|art time|fun camp)/i.test(name);
  }

  if (category === "theater") {
    return /(open play|mah jongg|game|gather|competition)/i.test(name);
  }

  return hasEventishKeywords(name);
}

function titleHasParticipantDelimiters(title: string): boolean {
  return /(\bwith\b|\bw\/\b|\bfeat\b|\bfeaturing\b|\bvs\.?\b|\bversus\b|\bat\b|:|\bnight\b|\btour\b)/i.test(title);
}

/**
 * Remove low-quality participant rows (especially title-mirror artifacts),
 * and synthesize sports teams from matchup titles when needed.
 */
export function getDisplayParticipants(
  artists: EventArtist[],
  context: EventParticipantContext = {}
): EventArtist[] {
  const deduped = dedupeParticipants(artists);
  if (deduped.length === 0) {
    if (context.eventCategory === "sports") {
      const teams = parseSportsTeamsFromTitle(context.eventTitle);
      return teams.map((team, idx) => ({
        id: -(idx + 1),
        event_id: 0,
        name: team,
        role: idx === 0 ? "home" : "away",
        billing_order: idx + 1,
        is_headliner: idx === 0,
        artist: null,
      }));
    }
    return [];
  }

  const titleNorm = normalizeText(context.eventTitle);
  const category = normalizeText(context.eventCategory);
  const hasTitleDelimiters = titleHasParticipantDelimiters(context.eventTitle || "");

  const filtered = deduped.filter((entry) => {
    const displayName = entry.artist?.name || entry.name;
    const nameNorm = normalizeText(displayName);
    if (!nameNorm) return false;

    const linked = Boolean(entry.artist?.id);
    const isTitleMirror = Boolean(titleNorm && nameNorm === titleNorm);
    const hasAltParticipantInTitle = deduped.some((other) => {
      if (other.id === entry.id) return false;
      const otherNorm = normalizeText(other.artist?.name || other.name);
      if (!otherNorm || otherNorm === nameNorm || otherNorm === titleNorm) return false;
      return Boolean(titleNorm && titleNorm.includes(otherNorm));
    });

    if (!linked && looksLikeEventBoilerplate(displayName) && (isTitleMirror || hasTitleDelimiters)) {
      return false;
    }

    if (isTitleMirror) {
      // Drop title-mirror rows when they look like wrappers around real participant names.
      if (hasTitleDelimiters || looksLikeEventBoilerplate(displayName) || hasAltParticipantInTitle) {
        return false;
      }
    }

    if (category === "sports" && !linked) {
      if (/(home game|suites?|parking|ticket package|vip|presented by)/i.test(displayName)) {
        return false;
      }
    }

    return true;
  });

  if (category !== "sports") {
    if (filtered.length > 0) {
      const gated = filtered.filter((entry) => {
        const name = entry.artist?.name || entry.name;
        const nameNorm = normalizeText(name);
        const linked = Boolean(entry.artist?.id);
        const isTitleMirror = Boolean(titleNorm && nameNorm === titleNorm);

        if (isLowSignalParticipantName(name, category)) return false;
        if (linked) return true;

        if (isTitleMirror) {
          if (category === "music") return true;
          if (category === "comedy") {
            return !/(comedy|night|open mic)/i.test(name);
          }
          return false;
        }

        return true;
      });

      // Strict gate for non-performance categories: hide lineup unless quality is high.
      if (["learning", "community", "words", "art", "film"].includes(category)) {
        const hasLinked = gated.some((entry) => Boolean(entry.artist?.id));
        const hasMultiple = gated.length >= 2;
        if (!hasLinked && !hasMultiple) return [];
      }

      if (gated.length > 0) {
        return gated;
      }
    }

    const allowFallbackFromTitle = category === "music" || category === "comedy" || category === "nightlife";
    if (!allowFallbackFromTitle) return [];

    const fallbackHeadliner = extractLikelyHeadlinerFromTitle(context.eventTitle);
    if (!fallbackHeadliner) return [];
    if (isLowSignalParticipantName(fallbackHeadliner, category)) return [];

    if (category === "comedy" && /(comedy|night|open mic)/i.test(fallbackHeadliner)) {
      return [];
    }

    return [{
      id: -1,
      event_id: 0,
      name: fallbackHeadliner,
      role: "headliner",
      billing_order: 1,
      is_headliner: true,
      artist: null,
    }];
  }

  const parsedTeams = parseSportsTeamsFromTitle(context.eventTitle);
  if (parsedTeams.length !== 2) {
    return filtered.filter((entry) => {
      const name = entry.artist?.name || entry.name;
      const normalized = normalizeText(name);
      if (!normalized || normalized === titleNorm) return false;
      if (looksLikeEventBoilerplate(name)) return false;
      if (isLowSignalParticipantName(name, category)) return false;
      return Boolean(entry.artist?.id);
    });
  }

  const titleMirrorOnly =
    filtered.length === 1 &&
    normalizeText(filtered[0].artist?.name || filtered[0].name) === titleNorm;

  const base = titleMirrorOnly ? [] : [...filtered];
  const existing = new Set(base.map((entry) => normalizeEntityName(entry.artist?.name || entry.name)));

  parsedTeams.forEach((team, idx) => {
    const norm = normalizeEntityName(team);
    if (!norm || existing.has(norm)) return;
    existing.add(norm);
    base.push({
      id: -(idx + 1),
      event_id: 0,
      name: team,
      role: idx === 0 ? "home" : "away",
      billing_order: idx + 1,
      is_headliner: idx === 0,
      artist: null,
    });
  });

  if (parsedTeams.length === 2) {
    return parsedTeams.map((team, idx) => {
      const teamNorm = normalizeEntityName(team);
      const match = base.find((entry) => normalizeEntityName(entry.artist?.name || entry.name) === teamNorm);
      return {
        id: match?.id ?? -(idx + 1),
        event_id: match?.event_id ?? 0,
        name: team,
        role: idx === 0 ? "home" : "away",
        billing_order: idx + 1,
        is_headliner: idx === 0,
        artist: match?.artist ?? null,
      };
    });
  }

  const sorted = base.sort((a, b) => {
    const aOrder = a.billing_order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.billing_order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.artist?.name || a.name).localeCompare(b.artist?.name || b.name);
  });

  return sorted.filter((entry) => !isLowSignalParticipantName(entry.artist?.name || entry.name, category));
}

/** Best-effort external profile URL when we do not have a canonical linked artist page. */
export function getParticipantWebsiteFallback(name: string, category?: string | null): string | null {
  if (normalizeText(category) !== "sports") return null;
  const normalized = normalizeEntityName(name);
  return KNOWN_ENTITY_WEBSITES[normalized] || null;
}

/** Derive context-aware section labels from event category and dominant participant discipline. */
export function getLineupLabels(
  artists: EventArtist[],
  context: LineupLabelContext = {}
): {
  sectionTitle: string;
  headlinerLabel: string;
  supportLabel: string;
  artistNoun: string;
  descriptionLead: string;
  grouping: "tiered" | "flat";
} {
  const category = normalizeText(context.eventCategory);

  const categoryMap: Record<string, {
    sectionTitle: string;
    headlinerLabel: string;
    supportLabel: string;
    artistNoun: string;
    descriptionLead: string;
    grouping: "tiered" | "flat";
  }> = {
    music: {
      sectionTitle: "Lineup",
      headlinerLabel: "Headliners",
      supportLabel: "Supporting",
      artistNoun: "artists",
      descriptionLead: "Lineup",
      grouping: "tiered",
    },
    sports: {
      sectionTitle: "Teams",
      headlinerLabel: "Matchup",
      supportLabel: "Teams",
      artistNoun: "teams",
      descriptionLead: "Matchup",
      grouping: "flat",
    },
    comedy: {
      sectionTitle: "Comics",
      headlinerLabel: "Headliner",
      supportLabel: "Featuring",
      artistNoun: "comics",
      descriptionLead: "Comics",
      grouping: "tiered",
    },
    theater: {
      sectionTitle: "Cast",
      headlinerLabel: "Starring",
      supportLabel: "Cast",
      artistNoun: "performers",
      descriptionLead: "Cast",
      grouping: "tiered",
    },
    dance: {
      sectionTitle: "Performers",
      headlinerLabel: "Featured",
      supportLabel: "Company",
      artistNoun: "performers",
      descriptionLead: "Performers",
      grouping: "tiered",
    },
    film: {
      sectionTitle: "Featured Guests",
      headlinerLabel: "Featured",
      supportLabel: "Guests",
      artistNoun: "guests",
      descriptionLead: "Featured guests",
      grouping: "flat",
    },
    learning: {
      sectionTitle: "Speakers",
      headlinerLabel: "Featured",
      supportLabel: "Also speaking",
      artistNoun: "speakers",
      descriptionLead: "Speakers",
      grouping: "tiered",
    },
    words: {
      sectionTitle: "Speakers",
      headlinerLabel: "Featured",
      supportLabel: "Also speaking",
      artistNoun: "speakers",
      descriptionLead: "Speakers",
      grouping: "tiered",
    },
    community: {
      sectionTitle: "Featured Guests",
      headlinerLabel: "Featured",
      supportLabel: "Guests",
      artistNoun: "guests",
      descriptionLead: "Featured guests",
      grouping: "tiered",
    },
    food_drink: {
      sectionTitle: "Featured",
      headlinerLabel: "Featured",
      supportLabel: "Also appearing",
      artistNoun: "guests",
      descriptionLead: "Featured",
      grouping: "tiered",
    },
    nightlife: {
      sectionTitle: "Lineup",
      headlinerLabel: "Featured",
      supportLabel: "Also appearing",
      artistNoun: "performers",
      descriptionLead: "Lineup",
      grouping: "tiered",
    },
  };

  if (category && categoryMap[category]) {
    return categoryMap[category];
  }

  // Count disciplines across all artists
  const counts: Record<string, number> = {};
  for (const a of artists) {
    const d = a.artist?.discipline || "unknown";
    counts[d] = (counts[d] || 0) + 1;
  }

  // Find dominant discipline
  let dominant = "unknown";
  let max = 0;
  for (const [d, c] of Object.entries(counts)) {
    if (c > max) {
      dominant = d;
      max = c;
    }
  }

  const disciplineMap: Record<string, { sectionTitle: string; headlinerLabel: string; supportLabel: string; artistNoun: string; descriptionLead: string; grouping: "tiered" | "flat" }> = {
    author:        { sectionTitle: "Featured Authors", headlinerLabel: "Keynote",    supportLabel: "Authors",    artistNoun: "authors",     descriptionLead: "Featured authors", grouping: "tiered" },
    musician:      { sectionTitle: "Lineup",           headlinerLabel: "Headliners", supportLabel: "Supporting", artistNoun: "artists",     descriptionLead: "Lineup", grouping: "tiered" },
    band:          { sectionTitle: "Lineup",           headlinerLabel: "Headliners", supportLabel: "Supporting", artistNoun: "artists",     descriptionLead: "Lineup", grouping: "tiered" },
    dj:            { sectionTitle: "Lineup",           headlinerLabel: "Headliners", supportLabel: "DJs",        artistNoun: "artists",     descriptionLead: "Lineup", grouping: "tiered" },
    comedian:      { sectionTitle: "Comics",           headlinerLabel: "Headliner",  supportLabel: "Featuring",  artistNoun: "comics",      descriptionLead: "Comics", grouping: "tiered" },
    speaker:       { sectionTitle: "Speakers",         headlinerLabel: "Keynote",    supportLabel: "Speakers",   artistNoun: "speakers",    descriptionLead: "Speakers", grouping: "tiered" },
    visual_artist: { sectionTitle: "Featured Artists", headlinerLabel: "Featured",   supportLabel: "Artists",    artistNoun: "artists",     descriptionLead: "Featured artists", grouping: "tiered" },
    actor:         { sectionTitle: "Cast",             headlinerLabel: "Starring",   supportLabel: "Cast",       artistNoun: "performers",  descriptionLead: "Cast", grouping: "tiered" },
    filmmaker:     { sectionTitle: "Filmmakers",       headlinerLabel: "Featured",   supportLabel: "Filmmakers", artistNoun: "filmmakers",  descriptionLead: "Filmmakers", grouping: "flat" },
  };

  return disciplineMap[dominant] || {
    sectionTitle: "Featured Guests",
    headlinerLabel: "Featured",
    supportLabel: "Guests",
    artistNoun: "guests",
    descriptionLead: "Featured guests",
    grouping: "tiered",
  };
}
