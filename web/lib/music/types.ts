import type { MusicGenreBucket } from "./genre-map";

export type MusicProgrammingStyle =
  | "listening_room"
  | "curated_indie"
  | "jazz_club"
  | "dj_electronic"
  | "drive_in_amph";

export type MusicDisplayTier = "editorial" | "marquee" | "additional";

export type CapacityBand = "intimate" | "club" | "theater" | "arena";

export interface MusicVenuePayload {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  image_url: string | null;
  hero_image_url: string | null;
  music_programming_style: MusicProgrammingStyle | null;
  music_venue_formats: string[];
  capacity: number | null;
  // Editorial italic line (venue-level description, CM-written).
  // Sourced from places.short_description for v1 — if this column is
  // in use for generic copy, see Revisions R21 for migrating to a
  // dedicated music_editorial_line column.
  editorial_line: string | null;
  display_tier: MusicDisplayTier;
  capacity_band: CapacityBand | null;
}

export interface MusicArtistPayload {
  id: string | null;
  slug: string | null;
  name: string;
  is_headliner: boolean;
  billing_order: number | null;
}

export interface MusicShowPayload {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  doors_time: string | null;
  image_url: string | null;
  is_free: boolean;
  is_curator_pick: boolean;
  is_tentpole: boolean;
  importance: "flagship" | "major" | "standard" | null;
  festival_id: string | null;
  ticket_status: string | null;
  ticket_url: string | null;
  age_policy: string | null;
  // NOTE: the editorial blurb field on events is named `featured_blurb` — the
  // existing column. Do NOT add a new `editorial_blurb` column.
  featured_blurb: string | null;
  tags: string[];
  genres: string[];
  genre_buckets: MusicGenreBucket[];
  venue: MusicVenuePayload;
  artists: MusicArtistPayload[];
}

export interface MusicResidencyPayload {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  day_of_week: string | null;
  image_url: string | null;
  venue: MusicVenuePayload | null;
  next_event: {
    id: number;
    start_date: string;
    start_time: string | null;
    doors_time: string | null;
  } | null;
}

export interface ThisWeekPayload {
  shows: MusicShowPayload[];
}

export interface TonightPayload {
  date: string;
  tonight: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];
  late_night: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];
}

export interface ByVenuePayload {
  date: string;
  my_venues: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];
  editorial: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];
  marquee: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];
  additional: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];
}

export interface ByShowPayload {
  groups: { day_label: string; date: string; shows: MusicShowPayload[] }[];
}

export interface FestivalHorizonPayload {
  festivals: {
    id: string;
    slug: string;
    name: string;
    start_date: string;
    end_date: string;
    venue_name: string | null;
    neighborhood: string | null;
    days_away: number;
    headliner_teaser: string | null;
    genre_bucket: MusicGenreBucket | null;
    image_url: string | null;
  }[];
}

export interface OnSalePayload {
  shows: MusicShowPayload[];
}
