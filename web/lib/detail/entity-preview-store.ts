/**
 * In-module subscribe-publish store for overlay seed data.
 *
 * Cards know enough to paint a detail-view skeleton (title, image, neighborhood,
 * dates) at render time. This store captures those breadcrumbs keyed by entity
 * ref so the overlay router can render seeded content immediately on open, then
 * silently replace it when the full fetch lands.
 *
 * Not context (cards don't know they wrap the overlay). Not URL (length +
 * staleness). Not Zustand (too heavy). Plain Map + TTL sweeps + LRU eviction
 * is all this needs.
 *
 * See docs/plans/explore-overlay-architecture-2026-04-18.md § Phase 7.
 */

export type EntityKind =
  | "event"
  | "spot"
  | "series"
  | "festival"
  | "org"
  | "neighborhood";

/** Canonical ref format — matches DetailOverlayTarget so router + cards agree. */
export type EntityRef =
  | `event:${number | string}`
  | `spot:${string}`
  | `series:${string}`
  | `festival:${string}`
  | `org:${string}`
  | `neighborhood:${string}`;

// ── Seed payload shapes ──────────────────────────────────────────────────────
//
// Minimum fields a card has in scope. These are explicitly NOT the full
// *ApiResponse shapes — the canonical fetch still runs and replaces them. Keep
// these lean; adding fields here means more card-level publish work and more
// surface area to get wrong.

export interface EventSeed {
  kind: "event";
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

export interface SpotSeed {
  kind: "spot";
  slug: string;
  name: string;
  image_url?: string | null;
  neighborhood?: string | null;
  spot_type?: string | null;
}

export interface SeriesSeed {
  kind: "series";
  slug: string;
  title: string;
  image_url?: string | null;
  category?: string | null;
}

export interface FestivalSeed {
  kind: "festival";
  slug: string;
  name: string;
  image_url?: string | null;
  announced_start?: string | null;
  announced_end?: string | null;
  neighborhood?: string | null;
}

export interface OrgSeed {
  kind: "org";
  slug: string;
  name: string;
  logo_url?: string | null;
  tagline?: string | null;
}

export interface NeighborhoodSeed {
  kind: "neighborhood";
  slug: string;
  name: string;
  color?: string | null;
  events_today_count?: number | null;
  venue_count?: number | null;
  hero_image?: string | null;
}

export type SeedPayload =
  | EventSeed
  | SpotSeed
  | SeriesSeed
  | FestivalSeed
  | OrgSeed
  | NeighborhoodSeed;

// ── Store internals ──────────────────────────────────────────────────────────

interface Entry {
  payload: SeedPayload;
  publishedAt: number;
}

const TTL_MS = 60_000;
const MAX_ENTRIES = 200;

const store = new Map<EntityRef, Entry>();

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function evictOldest(): void {
  // Map insertion order is iteration order. We also update entries on publish
  // by deleting-then-setting, so insertion order ≈ recency order.
  const first = store.keys().next();
  if (!first.done) store.delete(first.value);
}

// ── Public API ───────────────────────────────────────────────────────────────

export function publishEntityPreview(
  ref: EntityRef,
  payload: SeedPayload,
): void {
  // Re-inserting refreshes recency.
  store.delete(ref);
  store.set(ref, { payload, publishedAt: now() });
  while (store.size > MAX_ENTRIES) evictOldest();
}

export function peekEntityPreview(ref: EntityRef): SeedPayload | null {
  const entry = store.get(ref);
  if (!entry) return null;
  if (now() - entry.publishedAt > TTL_MS) {
    store.delete(ref);
    return null;
  }
  return entry.payload;
}

/**
 * Build a ref from the DetailOverlayTarget shape. Mirrors `overlayRef` in
 * overlay-perf.ts but typed for the seed store.
 */
export function buildEntityRef(
  kind: EntityKind,
  key: string | number,
): EntityRef {
  return `${kind}:${key}` as EntityRef;
}

// ── Test helpers (not exported from barrel; used by unit tests only) ─────────

export function __clearStoreForTests(): void {
  store.clear();
}

export function __storeSizeForTests(): number {
  return store.size;
}
