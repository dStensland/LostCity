"use client";

import { useMemo } from "react";
import { usePublishEntityPreview } from "./usePublishEntityPreview";
import {
  buildEntityRef,
  type EventSeed,
  type SpotSeed,
  type SeriesSeed,
  type FestivalSeed,
  type OrgSeed,
  type NeighborhoodSeed,
  type EntityRef,
} from "./entity-preview-store";

/**
 * Thin wrappers that take a card-scoped entity-like object and publish a seed.
 * Each card component calls exactly one `usePublishXxxSeed(entity)` at top-level
 * — no manual ref-building, no inline payload construction.
 *
 * Pass `null` when the entity isn't ready (e.g., async-loaded card). The hook
 * no-ops.
 */

export interface EventLike {
  id: number;
  title: string;
  image_url?: string | null;
  category?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  is_all_day?: boolean | null;
  venue?: { name: string; slug?: string | null } | null;
  is_free?: boolean | null;
}

export function usePublishEventSeed(event: EventLike | null | undefined): void {
  const ref: EntityRef | null = event ? buildEntityRef("event", event.id) : null;
  const payload = useMemo<EventSeed | null>(
    () =>
      event
        ? {
            kind: "event",
            id: event.id,
            title: event.title,
            image_url: event.image_url ?? null,
            category: event.category ?? null,
            start_date: event.start_date ?? null,
            start_time: event.start_time ?? null,
            is_all_day: event.is_all_day ?? null,
            venue: event.venue
              ? { name: event.venue.name, slug: event.venue.slug ?? null }
              : null,
            is_free: event.is_free ?? null,
          }
        : null,
    [event],
  );
  usePublishEntityPreview(ref, payload);
}

export interface SpotLike {
  slug: string;
  name: string;
  image_url?: string | null;
  neighborhood?: string | null;
  spot_type?: string | null;
}

export function usePublishSpotSeed(spot: SpotLike | null | undefined): void {
  const ref: EntityRef | null = spot ? buildEntityRef("spot", spot.slug) : null;
  const payload = useMemo<SpotSeed | null>(
    () =>
      spot
        ? {
            kind: "spot",
            slug: spot.slug,
            name: spot.name,
            image_url: spot.image_url ?? null,
            neighborhood: spot.neighborhood ?? null,
            spot_type: spot.spot_type ?? null,
          }
        : null,
    [spot],
  );
  usePublishEntityPreview(ref, payload);
}

export interface SeriesLike {
  slug: string;
  title: string;
  image_url?: string | null;
  category?: string | null;
}

export function usePublishSeriesSeed(series: SeriesLike | null | undefined): void {
  const ref: EntityRef | null = series ? buildEntityRef("series", series.slug) : null;
  const payload = useMemo<SeriesSeed | null>(
    () =>
      series
        ? {
            kind: "series",
            slug: series.slug,
            title: series.title,
            image_url: series.image_url ?? null,
            category: series.category ?? null,
          }
        : null,
    [series],
  );
  usePublishEntityPreview(ref, payload);
}

export interface FestivalLike {
  slug: string;
  name: string;
  image_url?: string | null;
  announced_start?: string | null;
  announced_end?: string | null;
  neighborhood?: string | null;
}

export function usePublishFestivalSeed(
  festival: FestivalLike | null | undefined,
): void {
  const ref: EntityRef | null = festival
    ? buildEntityRef("festival", festival.slug)
    : null;
  const payload = useMemo<FestivalSeed | null>(
    () =>
      festival
        ? {
            kind: "festival",
            slug: festival.slug,
            name: festival.name,
            image_url: festival.image_url ?? null,
            announced_start: festival.announced_start ?? null,
            announced_end: festival.announced_end ?? null,
            neighborhood: festival.neighborhood ?? null,
          }
        : null,
    [festival],
  );
  usePublishEntityPreview(ref, payload);
}

export interface OrgLike {
  slug: string;
  name: string;
  logo_url?: string | null;
  tagline?: string | null;
}

export function usePublishOrgSeed(org: OrgLike | null | undefined): void {
  const ref: EntityRef | null = org ? buildEntityRef("org", org.slug) : null;
  const payload = useMemo<OrgSeed | null>(
    () =>
      org
        ? {
            kind: "org",
            slug: org.slug,
            name: org.name,
            logo_url: org.logo_url ?? null,
            tagline: org.tagline ?? null,
          }
        : null,
    [org],
  );
  usePublishEntityPreview(ref, payload);
}

export interface NeighborhoodLike {
  slug: string;
  name: string;
  color?: string | null;
  events_today_count?: number | null;
  venue_count?: number | null;
  hero_image?: string | null;
}

export function usePublishNeighborhoodSeed(
  neighborhood: NeighborhoodLike | null | undefined,
): void {
  const ref: EntityRef | null = neighborhood
    ? buildEntityRef("neighborhood", neighborhood.slug)
    : null;
  const payload = useMemo<NeighborhoodSeed | null>(
    () =>
      neighborhood
        ? {
            kind: "neighborhood",
            slug: neighborhood.slug,
            name: neighborhood.name,
            color: neighborhood.color ?? null,
            events_today_count: neighborhood.events_today_count ?? null,
            venue_count: neighborhood.venue_count ?? null,
            hero_image: neighborhood.hero_image ?? null,
          }
        : null,
    [neighborhood],
  );
  usePublishEntityPreview(ref, payload);
}
