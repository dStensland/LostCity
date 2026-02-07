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
  };
  return labels[discipline] || discipline.replace(/_/g, " ");
}
