import { classifyMusicVenue, capacityBand } from "./classification";
import { mapTagsToBuckets } from "./genre-map";
import type { MusicShowPayload, MusicVenuePayload } from "./types";

export interface RawEventRow {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  doors_time: string | null;
  image_url: string | null;
  is_free: boolean | null;
  is_curator_pick: boolean | null;
  is_tentpole: boolean | null;
  importance: string | null;
  festival_id: string | null;
  ticket_status: string | null;
  ticket_url: string | null;
  age_policy: string | null;
  featured_blurb: string | null;
  tags: string[] | null;
  genres: string[] | null;
  place: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url: string | null;
    hero_image_url: string | null;
    short_description: string | null;
    music_programming_style: MusicVenuePayload["music_programming_style"];
    music_venue_formats: string[] | null;
    capacity: number | null;
  };
  event_artists: Array<{
    artist_id: string | null;
    name: string;
    is_headliner: boolean | null;
    billing_order: number | null;
    artist: { slug: string | null } | null;
  }> | null;
}

export function buildShowPayload(e: RawEventRow): MusicShowPayload {
  const p = e.place;
  const venue: MusicVenuePayload = {
    id: p.id,
    name: p.name,
    slug: p.slug,
    neighborhood: p.neighborhood,
    image_url: p.image_url,
    hero_image_url: p.hero_image_url,
    music_programming_style: p.music_programming_style,
    music_venue_formats: p.music_venue_formats ?? [],
    capacity: p.capacity,
    // Editorial italic line sources from places.short_description for v1.
    editorial_line: p.short_description,
    display_tier: classifyMusicVenue(p),
    capacity_band: capacityBand(p.capacity),
  };

  const artists = (e.event_artists ?? [])
    .map((a) => ({
      id: a.artist_id,
      slug: a.artist?.slug ?? null,
      name: a.name,
      is_headliner: a.is_headliner ?? false,
      billing_order: a.billing_order,
    }))
    .sort(
      (x, y) =>
        (y.is_headliner ? 1 : 0) - (x.is_headliner ? 1 : 0) ||
        (x.billing_order ?? 999) - (y.billing_order ?? 999),
    );

  const importance = (e.importance ?? null) as MusicShowPayload["importance"];

  return {
    id: e.id,
    title: e.title,
    start_date: e.start_date,
    start_time: e.start_time,
    doors_time: e.doors_time,
    image_url: e.image_url,
    is_free: e.is_free ?? false,
    is_curator_pick: e.is_curator_pick ?? false,
    is_tentpole: e.is_tentpole ?? false,
    importance,
    festival_id: e.festival_id,
    ticket_status: e.ticket_status,
    ticket_url: e.ticket_url,
    age_policy: e.age_policy,
    featured_blurb: e.featured_blurb,
    tags: e.tags ?? [],
    genres: e.genres ?? [],
    genre_buckets: mapTagsToBuckets([...(e.tags ?? []), ...(e.genres ?? [])]),
    venue,
    artists,
  };
}
