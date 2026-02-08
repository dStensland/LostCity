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

/** Derive context-aware section labels from the dominant artist discipline */
export function getLineupLabels(artists: EventArtist[]): {
  sectionTitle: string;
  headlinerLabel: string;
  supportLabel: string;
  artistNoun: string;
} {
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
    if (c > max) { dominant = d; max = c; }
  }

  const labelMap: Record<string, { sectionTitle: string; headlinerLabel: string; supportLabel: string; artistNoun: string }> = {
    author:        { sectionTitle: "Featured Authors",  headlinerLabel: "Keynote Speakers", supportLabel: "Authors",    artistNoun: "authors" },
    musician:      { sectionTitle: "Lineup",            headlinerLabel: "Headliners",       supportLabel: "Supporting", artistNoun: "artists" },
    band:          { sectionTitle: "Lineup",            headlinerLabel: "Headliners",       supportLabel: "Supporting", artistNoun: "artists" },
    dj:            { sectionTitle: "Lineup",            headlinerLabel: "Headliners",       supportLabel: "DJs",        artistNoun: "artists" },
    comedian:      { sectionTitle: "Featured Comics",   headlinerLabel: "Headliners",       supportLabel: "Comics",     artistNoun: "comics" },
    speaker:       { sectionTitle: "Speakers",          headlinerLabel: "Keynote Speakers", supportLabel: "Speakers",   artistNoun: "speakers" },
    visual_artist: { sectionTitle: "Featured Artists",  headlinerLabel: "Featured",         supportLabel: "Artists",    artistNoun: "artists" },
    actor:         { sectionTitle: "Cast",              headlinerLabel: "Starring",         supportLabel: "Cast",       artistNoun: "performers" },
    filmmaker:     { sectionTitle: "Filmmakers",        headlinerLabel: "Featured",         supportLabel: "Filmmakers", artistNoun: "filmmakers" },
  };

  return labelMap[dominant] || { sectionTitle: "Featured Guests", headlinerLabel: "Featured", supportLabel: "Guests", artistNoun: "guests" };
}
