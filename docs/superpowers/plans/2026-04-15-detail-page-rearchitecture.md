# Detail Page Rearchitecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 5 monolithic detail views (~4,200 LOC) with a composable section module system that enables venue-type-specific templates and surfaces the interconnected data network.

**Architecture:** Type Shell + Section Slots — thin orchestrators compose a shared DetailLayout with registered section modules. Type-specific manifests control section ordering; trait functions gate inclusion based on data presence. A discriminated EntityData union provides type safety across the pipeline.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind CSS, Supabase, Phosphor Icons

**Spec:** `docs/superpowers/specs/2026-04-15-detail-page-rearchitecture-design.md`

**Important references:**
- Design system tokens: `web/CLAUDE.md`
- `getCategoryColor`: `web/lib/category-config.ts:134`
- `useDetailFetch`: `web/lib/hooks/useDetailFetch.ts`
- `DetailShell`: `web/components/detail/DetailShell.tsx`
- `DetailStickyBar`: `web/components/detail/DetailStickyBar.tsx`
- `ScopedStyles`: `web/components/ScopedStyles.tsx`
- `createCssVarClass`: `web/lib/css-utils.ts`
- `buildSpotUrl`: `web/lib/entity-urls.ts`
- `SpotDetailPayload`: `web/lib/spot-detail.ts:199`

---

## Phase 0: Pencil Design Comps

Before any code, create full-page design comps in Pencil for all 14 page types at web and mobile breakpoints (24 total comps). See spec section 9.1 for the full comp list. Design the section wrapper chrome, identity zones, and ConnectionsSection as reusable component blocks first, then compose into full pages.

**This phase is interactive design work — use the Pencil MCP tools and the `design` skill. Do not proceed to Phase 1 until comps are approved.**

---

## Phase 1: Core Types & Data Layer

### Task 1: Create EntityData types and SectionId union

**Files:**
- Create: `web/lib/detail/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// web/lib/detail/types.ts

// ─── Entity Types ───────────────────────────────────────────────
// Re-export existing response types used by each detail view.
// These are the shapes returned by the API routes.

// Event: currently defined inline in EventDetailView.tsx — NOT exported.
// Define the canonical type here. When the view is rewritten (Task 17),
// it will import from here instead of defining inline.
// The shape below matches EventDetailView.tsx lines 30-120.
export interface EventData {
  id: number;
  title: string;
  description: string | null;
  display_description?: string | null;
  start_date: string;
  start_time: string | null;
  doors_time?: string | null;
  end_time: string | null;
  end_date: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  price_note?: string | null;
  category: string | null;
  tags: string[] | null;
  genres?: string[] | null;
  ticket_url: string | null;
  source_url: string | null;
  image_url: string | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  is_live?: boolean;
  age_policy?: string | null;
  ticket_status?: string | null;
  reentry_policy?: string | null;
  set_times_mentioned?: boolean | null;
  cost_tier?: string | null;
  duration?: string | null;
  booking_required?: boolean | null;
  indoor_outdoor?: string | null;
  venue: {
    id: number; name: string; slug: string;
    address: string | null; neighborhood: string | null;
    city: string; state: string;
    place_type?: string | null;
    vibes: string[] | null;
    lat?: number | null; lng?: number | null;
    nearest_marta_station?: string | null;
    marta_walk_minutes?: number | null;
    marta_lines?: string[] | null;
    beltline_adjacent?: boolean | null;
    beltline_segment?: string | null;
    parking_type?: string[] | null;
    parking_free?: boolean | null;
    transit_score?: number | null;
  } | null;
  producer: {
    id: string; name: string; slug: string;
    org_type: string | null; website: string | null; logo_url: string | null;
  } | null;
  series: {
    id: string; title: string; slug: string; series_type: string;
    festival?: {
      id: string; name: string; slug: string;
      image_url: string | null; festival_type?: string | null;
      location: string | null; neighborhood: string | null;
    } | null;
  } | null;
}

export interface EventArtist {
  id: number;
  name: string;
  billing_order: number;
  is_headliner: boolean;
  role?: string | null;
  image_url?: string | null;
}

export interface EventApiResponse {
  event: EventData;
  eventArtists: EventArtist[];
  venueEvents: unknown[];
  nearbyEvents: unknown[];
  nearbyDestinations: Record<string, unknown[]>;
}

// Place: from web/lib/spot-detail.ts
export type { SpotDetailPayload as PlaceApiResponse } from "@/lib/spot-detail";

// Series: defined inline in SeriesDetailView — extract here
export interface SeriesData {
  id: string;
  title: string;
  slug: string;
  series_type: string;
  description: string | null;
  image_url: string | null;
  year: number | null;
  rating: string | null;
  runtime_minutes: number | null;
  director: string | null;
  trailer_url: string | null;
  genres: string[] | null;
  frequency: string | null;
  day_of_week: string | null;
  festival?: {
    id: string;
    slug: string;
    name: string;
    image_url: string | null;
    festival_type?: string | null;
    location: string | null;
    neighborhood: string | null;
  } | null;
}

export interface VenueShowtime {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    image_url?: string | null;
    address?: string | null;
    nearest_marta_station?: string | null;
    marta_walk_minutes?: number | null;
    marta_lines?: string[] | null;
    beltline_adjacent?: boolean | null;
    beltline_segment?: string | null;
    parking_type?: string[] | null;
    parking_free?: boolean | null;
    transit_score?: number | null;
  };
  events: {
    id: number;
    date: string;
    time: string | null;
    ticketUrl: string | null;
  }[];
}

export interface SeriesApiResponse {
  series: SeriesData;
  events: unknown[];
  venueShowtimes: VenueShowtime[];
}

// Festival: defined inline in FestivalDetailView — extract here
export interface FestivalData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  website: string | null;
  ticket_url: string | null;
  location: string | null;
  neighborhood: string | null;
  primary_type?: string | null;
  experience_tags?: string[] | null;
  announced_start?: string | null;
  announced_end?: string | null;
  indoor_outdoor?: string | null;
  price_tier?: string | null;
}

export interface FestivalSession {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    nearest_marta_station?: string | null;
    marta_walk_minutes?: number | null;
    marta_lines?: string[] | null;
    beltline_adjacent?: boolean | null;
    beltline_segment?: string | null;
    parking_type?: string[] | null;
    parking_free?: boolean | null;
    transit_score?: number | null;
  } | null;
}

export interface FestivalProgram {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sessions: FestivalSession[];
}

export interface FestivalApiResponse {
  festival: FestivalData;
  programs: FestivalProgram[];
  screenings?: unknown;
}

// Org: from web/app/api/organizations/by-slug/[slug]/route.ts
export interface OrgData {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  description?: string | null;
  website: string | null;
  logo_url: string | null;
  instagram?: string | null;
  email?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  categories?: string[] | null;
}

export interface VolunteerOpportunity {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  commitment_level: "drop_in" | "ongoing" | "lead_role";
  time_horizon: string | null;
  onboarding_level: string | null;
  schedule_summary: string | null;
  location_summary: string | null;
  remote_allowed: boolean;
  background_check_required: boolean;
  training_required: boolean;
  application_url: string;
}

export interface OrgApiResponse {
  organization: OrgData;
  events: unknown[];
  volunteer_opportunities: VolunteerOpportunity[];
}

// ─── Discriminated Union ────────────────────────────────────────

export type EntityType = "event" | "place" | "series" | "festival" | "org";

export type EntityData =
  | { entityType: "event"; payload: EventApiResponse }
  | { entityType: "place"; payload: PlaceApiResponse }
  | { entityType: "series"; payload: SeriesApiResponse }
  | { entityType: "festival"; payload: FestivalApiResponse }
  | { entityType: "org"; payload: OrgApiResponse };

// ─── Section System ─────────────────────────────────────────────

export type SectionId =
  | "about"
  | "lineup"
  | "showtimes"
  | "dining"
  | "exhibitions"
  | "schedule"
  | "upcomingDates"
  | "eventsAtVenue"
  | "features"
  | "connections"
  | "socialProof"
  | "gettingThere"
  | "nearby"
  | "planYourVisit"
  | "specials"
  | "occasions"
  | "accolades"
  | "showSignals"
  | "volunteer"
  | "producer";

export interface SectionModule {
  id: SectionId;
  component: React.FC<SectionProps>;
  trait: (data: EntityData) => boolean;
  label: string;
  icon?: React.FC<{ size?: number; weight?: string }>;
  allowedEntityTypes: EntityType[];
  getCount?: (data: EntityData) => number | null;
}

export interface SectionProps {
  data: EntityData;
  portalSlug: string;
  accentColor: string;
  entityType: EntityType;
}

// ─── Layout Configs ─────────────────────────────────────────────

export interface HeroConfig {
  imageUrl: string | null;
  aspectClass: string;
  fallbackMode: "category-icon" | "type-icon" | "logo" | "banner";
  galleryEnabled: boolean;
  galleryUrls?: string[];
  category?: string | null;
  isLive?: boolean;
  overlaySlot?: React.ReactNode;
  mobileMaxHeight?: string; // e.g., "max-h-[280px]" for film posters
}

export interface ActionButton {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
}

export interface ActionConfig {
  primaryCTA: {
    label: string;
    href?: string;
    onClick?: () => void;
    variant: "filled" | "outlined";
    color?: string;
  } | null;
  secondaryActions: ActionButton[];
  stickyBar: {
    enabled: boolean;
    scrollThreshold?: number;
  };
}

// ─── Connection Types ───────────────────────────────────────────

export interface ConnectionRow {
  id: string;
  type: "venue" | "series" | "festival" | "org" | "social" | "proximity" | "artist";
  label: string;
  contextLine: string;
  href: string;
  imageUrl?: string | null;
  accent?: "gold" | "coral" | null;
  avatars?: string[]; // for social connections
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd web && npx tsc --noEmit web/lib/detail/types.ts 2>&1 | head -20`

Note: The re-exports from existing files may need adjustment if the existing views don't export their types. If `EventApiResponse` is not exported from `EventDetailView.tsx`, define it inline in `types.ts` instead. Check and fix any import errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/detail/types.ts
git commit -m "feat(detail): add EntityData discriminated union and section system types"
```

---

### Task 2: Create trait functions

**Files:**
- Create: `web/lib/detail/traits.ts`

- [ ] **Step 1: Create traits file**

Each trait function receives the full `EntityData` discriminated union and checks if the entity has data to support a given section. These are used by DetailLayout to filter the manifest.

```typescript
// web/lib/detail/traits.ts
import type { EntityData } from "./types";

export function hasDescription(data: EntityData): boolean {
  switch (data.entityType) {
    case "event":
      return !!(data.payload.event.description || data.payload.event.display_description);
    case "place":
      return !!data.payload.spot.description;
    case "series":
      return !!data.payload.series.description;
    case "festival":
      return !!data.payload.festival.description;
    case "org":
      return !!data.payload.organization.description;
  }
}

export function hasArtists(data: EntityData): boolean {
  return data.entityType === "event" && data.payload.eventArtists?.length > 0;
}

export function hasScreenings(data: EntityData): boolean {
  switch (data.entityType) {
    case "place":
      return !!data.payload.screenings;
    case "series":
      return data.payload.series.series_type === "film" && data.payload.venueShowtimes?.length > 0;
    case "festival":
      return !!data.payload.screenings;
    default:
      return false;
  }
}

export function hasDiningProfile(data: EntityData): boolean {
  return data.entityType === "place" && !!data.payload.placeVerticalDetails?.dining;
}

export function hasExhibitions(data: EntityData): boolean {
  return data.entityType === "place"
    ? data.payload.exhibitions?.length > 0
    : data.entityType === "festival"
      ? data.payload.programs?.some((p) => p.sessions?.length > 0)
      : false;
}

export function hasPrograms(data: EntityData): boolean {
  return data.entityType === "festival" && data.payload.programs?.length > 0;
}

export function hasUpcomingEvents(data: EntityData): boolean {
  switch (data.entityType) {
    case "place":
      return data.payload.upcomingEvents?.length > 0;
    case "org":
      return data.payload.events?.length > 0;
    default:
      return false;
  }
}

export function hasFeatures(data: EntityData): boolean {
  if (data.entityType !== "place") return false;
  const features = data.payload.features as Array<{ feature_type?: string }>;
  return features?.some((f) =>
    ["attraction", "exhibition", "collection", "experience"].includes(f.feature_type ?? "")
  );
}

export function hasConnections(data: EntityData): boolean {
  switch (data.entityType) {
    case "event":
      return !!(data.payload.event.venue || data.payload.event.series || data.payload.event.producer);
    case "place":
      return !!(data.payload.screenings || data.payload.upcomingEvents?.length > 0);
    case "series":
      return !!(data.payload.series.festival || data.payload.venueShowtimes?.length > 1);
    case "festival":
      return data.payload.programs?.length > 0;
    case "org":
      return data.payload.events?.length > 0;
  }
}

export function hasSocialData(data: EntityData): boolean {
  // Social proof requires client-side fetch — trait always returns true for allowed types.
  // The section component handles the empty state internally.
  return data.entityType === "event" || data.entityType === "place";
}

export function hasLocation(data: EntityData): boolean {
  switch (data.entityType) {
    case "event":
      return !!data.payload.event.venue?.address;
    case "place":
      return !!(data.payload.spot as Record<string, unknown>).address;
    case "series":
      return data.payload.venueShowtimes?.length === 1 && !!data.payload.venueShowtimes[0].venue.address;
    case "festival":
      return !!data.payload.festival.location;
    default:
      return false;
  }
}

export function hasCoordinates(data: EntityData): boolean {
  switch (data.entityType) {
    case "event":
      return !!(data.payload.event.venue?.lat && data.payload.event.venue?.lng);
    case "place": {
      const spot = data.payload.spot as Record<string, unknown>;
      return !!(spot.lat && spot.lng);
    }
    default:
      return false;
  }
}

export function hasAdmission(data: EntityData): boolean {
  if (data.entityType !== "place") return false;
  const profile = data.payload.placeProfile;
  return !!(profile?.typical_price_min != null || profile?.typical_duration_minutes != null);
}

export function hasAccessibility(data: EntityData): boolean {
  if (data.entityType !== "place") return false;
  const google = data.payload.placeVerticalDetails?.google;
  return !!(google?.wheelchair_accessible_entrance != null);
}

export function hasSpecials(data: EntityData): boolean {
  return data.entityType === "place" && data.payload.specials?.length > 0;
}

export function hasOccasions(data: EntityData): boolean {
  return data.entityType === "place" && data.payload.occasions?.length > 0;
}

export function hasEditorialMentions(data: EntityData): boolean {
  return data.entityType === "place" && data.payload.editorialMentions?.length > 0;
}

export function hasShowSignals(data: EntityData): boolean {
  if (data.entityType !== "event") return false;
  const e = data.payload.event;
  return !!(e.doors_time || e.age_policy || e.reentry_policy || e.set_times_mentioned || e.ticket_status);
}

export function hasVolunteerOpportunities(data: EntityData): boolean {
  return data.entityType === "org" && data.payload.volunteer_opportunities?.length > 0;
}

export function hasProducer(data: EntityData): boolean {
  if (data.entityType === "event") return !!data.payload.event.producer;
  if (data.entityType === "festival") return true; // festivals always have a presenting org conceptually
  return false;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/detail/traits.ts
git commit -m "feat(detail): add trait functions for section inclusion filtering"
```

---

### Task 3: Create shared formatters

**Files:**
- Create: `web/lib/detail/format.ts`

- [ ] **Step 1: Create formatters**

```typescript
// web/lib/detail/format.ts

/**
 * Format event time display.
 * Returns null if no meaningful time data exists.
 */
export function formatEventTime(
  isAllDay: boolean,
  startTime: string | null,
  endTime: string | null,
): string | null {
  if (isAllDay) return "All Day";
  if (!startTime) return null;

  const formatTime = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour = h % 12 || 12;
    return m === 0 ? `${hour} ${ampm}` : `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const start = formatTime(startTime);
  if (!endTime) return start;
  return `${start} – ${formatTime(endTime)}`;
}

/**
 * Format price range display.
 * Returns null if no price info.
 */
export function formatPriceRange(
  isFree: boolean,
  priceMin: number | null,
  priceMax: number | null,
): string | null {
  if (isFree) return "Free";
  if (priceMin == null) return null;
  if (priceMax == null || priceMax === priceMin) return `$${priceMin}`;
  return `$${priceMin}–$${priceMax}`;
}

/**
 * Format date range (e.g., "Apr 24 – May 3").
 * Returns null if no dates.
 */
export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start) return null;

  const fmt = (d: string) => {
    const date = new Date(d + "T12:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (!end || start === end) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

/**
 * Format recurrence label (e.g., "Every Tuesday").
 * Returns null if no recurrence data.
 */
export function formatRecurrence(
  frequency: string | null | undefined,
  dayOfWeek: string | null | undefined,
): string | null {
  if (!frequency && !dayOfWeek) return null;
  if (dayOfWeek) {
    const prefix = frequency === "biweekly" ? "Every other" : "Every";
    return `${prefix} ${dayOfWeek}`;
  }
  return frequency ? `${frequency.charAt(0).toUpperCase()}${frequency.slice(1)}` : null;
}

/**
 * Format duration from minutes.
 * Returns null if no data — never fabricates a default.
 */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (remaining === 0) return `${hours} hr`;
  return `${hours} hr ${remaining} min`;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/detail/format.ts
git commit -m "feat(detail): add shared formatters for time, price, date, recurrence, duration"
```

---

### Task 4: Create connection resolvers

**Files:**
- Create: `web/lib/detail/connections.ts`

- [ ] **Step 1: Create per-type connection resolvers**

```typescript
// web/lib/detail/connections.ts
import type {
  ConnectionRow,
  EntityData,
  EventApiResponse,
  PlaceApiResponse,
  SeriesApiResponse,
  FestivalApiResponse,
  OrgApiResponse,
} from "./types";

export function resolveConnections(data: EntityData, portalSlug: string): ConnectionRow[] {
  switch (data.entityType) {
    case "event":
      return resolveEventConnections(data.payload, portalSlug);
    case "place":
      return resolvePlaceConnections(data.payload, portalSlug);
    case "series":
      return resolveSeriesConnections(data.payload, portalSlug);
    case "festival":
      return resolveFestivalConnections(data.payload, portalSlug);
    case "org":
      return resolveOrgConnections(data.payload, portalSlug);
  }
}

function resolveEventConnections(data: EventApiResponse, portalSlug: string): ConnectionRow[] {
  const rows: ConnectionRow[] = [];
  const e = data.event;

  if (e.venue) {
    rows.push({
      id: `venue-${e.venue.id}`,
      type: "venue",
      label: e.venue.name,
      contextLine: [e.venue.place_type, e.venue.neighborhood].filter(Boolean).join(" · "),
      href: `/${portalSlug}?spot=${e.venue.slug}`,
      accent: null,
    });
  }

  if (e.series?.festival) {
    const f = e.series.festival;
    rows.push({
      id: `festival-${f.id}`,
      type: "festival",
      label: f.name,
      contextLine: "Festival",
      href: `/${portalSlug}?festival=${f.slug}`,
      imageUrl: f.image_url,
      accent: "gold",
    });
  } else if (e.series) {
    rows.push({
      id: `series-${e.series.id}`,
      type: "series",
      label: e.series.title,
      contextLine: e.series.series_type === "film" ? "Film" : "Series",
      href: `/${portalSlug}?series=${e.series.slug}`,
      accent: null,
    });
  }

  if (e.producer) {
    rows.push({
      id: `org-${e.producer.id}`,
      type: "org",
      label: e.producer.name,
      contextLine: e.producer.org_type || "Presenter",
      href: `/${portalSlug}?org=${e.producer.slug}`,
      imageUrl: e.producer.logo_url,
      accent: null,
    });
  }

  return rows;
}

function resolvePlaceConnections(data: PlaceApiResponse, portalSlug: string): ConnectionRow[] {
  const rows: ConnectionRow[] = [];
  // Place connections are data-dependent — festival screenings, recurring series, etc.
  // These require additional data that may need supplemental API calls.
  // For now, surface what's available in the payload.

  if (data.screenings) {
    rows.push({
      id: "screenings-hub",
      type: "festival",
      label: "Now Showing",
      contextLine: `${data.upcomingEvents?.length ?? 0} screenings`,
      href: "#showtimes",
      accent: null,
    });
  }

  return rows;
}

function resolveSeriesConnections(data: SeriesApiResponse, portalSlug: string): ConnectionRow[] {
  const rows: ConnectionRow[] = [];

  if (data.series.festival) {
    const f = data.series.festival;
    rows.push({
      id: `festival-${f.id}`,
      type: "festival",
      label: f.name,
      contextLine: "Official Selection",
      href: `/${portalSlug}?festival=${f.slug}`,
      imageUrl: f.image_url,
      accent: "gold",
    });
  }

  if (data.venueShowtimes?.length > 1) {
    rows.push({
      id: "theaters",
      type: "venue",
      label: `Screening at ${data.venueShowtimes.length} theaters`,
      contextLine: data.venueShowtimes.map((v) => v.venue.name).slice(0, 3).join(", "),
      href: "#showtimes",
      accent: null,
    });
  }

  return rows;
}

function resolveFestivalConnections(data: FestivalApiResponse, portalSlug: string): ConnectionRow[] {
  const rows: ConnectionRow[] = [];

  const allVenues = new Map<number, { name: string; slug: string }>();
  for (const program of data.programs) {
    for (const session of program.sessions) {
      if (session.venue) {
        allVenues.set(session.venue.id, { name: session.venue.name, slug: session.venue.slug });
      }
    }
  }

  if (allVenues.size > 0) {
    const names = [...allVenues.values()].map((v) => v.name).slice(0, 3);
    rows.push({
      id: "festival-venues",
      type: "venue",
      label: `${allVenues.size} festival venue${allVenues.size > 1 ? "s" : ""}`,
      contextLine: names.join(", ") + (allVenues.size > 3 ? `, +${allVenues.size - 3} more` : ""),
      href: "#schedule",
      accent: null,
    });
  }

  const totalSessions = data.programs.reduce((sum, p) => sum + p.sessions.length, 0);
  if (totalSessions > 0) {
    rows.push({
      id: "festival-programs",
      type: "series",
      label: `${totalSessions} event${totalSessions > 1 ? "s" : ""}`,
      contextLine: `Across ${data.programs.length} program${data.programs.length > 1 ? "s" : ""}`,
      href: "#schedule",
      accent: null,
    });
  }

  return rows;
}

function resolveOrgConnections(data: OrgApiResponse, portalSlug: string): ConnectionRow[] {
  const rows: ConnectionRow[] = [];

  if (data.events?.length > 0) {
    rows.push({
      id: "org-events",
      type: "venue",
      label: `${data.events.length} upcoming event${data.events.length > 1 ? "s" : ""}`,
      contextLine: "Produced by this organization",
      href: "#events",
      accent: null,
    });
  }

  return rows;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/detail/connections.ts
git commit -m "feat(detail): add per-type connection resolvers for data graph surfacing"
```

---

### Task 5: Create unified data hook

**Files:**
- Create: `web/lib/detail/use-detail-data.ts`

- [ ] **Step 1: Create the hook**

```typescript
// web/lib/detail/use-detail-data.ts
"use client";

import { useDetailFetch } from "@/lib/hooks/useDetailFetch";
import type { EntityType } from "./types";

const API_ROUTES: Record<EntityType, string> = {
  event: "/api/events",
  place: "/api/places/by-slug",
  series: "/api/series/by-slug",
  festival: "/api/festivals/by-slug",
  org: "/api/producers/by-slug",
};

interface UseDetailDataConfig<T> {
  entityType: EntityType;
  identifier: string | number;
  portalSlug: string;
  initialData?: T;
}

export function useDetailData<T>(config: UseDetailDataConfig<T>) {
  const { entityType, identifier, portalSlug, initialData } = config;

  const url = initialData
    ? null // skip fetch when SSR data provided
    : `${API_ROUTES[entityType]}/${identifier}${entityType === "event" ? `?portal_id=${portalSlug}` : ""}`;

  const { data: fetchedData, status, error, retry } = useDetailFetch<T>(url, {
    entityLabel: entityType,
  });

  return {
    data: initialData ?? fetchedData,
    status: initialData ? ("ready" as const) : status,
    error,
    retry,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/detail/use-detail-data.ts
git commit -m "feat(detail): add unified useDetailData hook wrapping useDetailFetch"
```

---

## Phase 2: Core Layout Components

### Task 6: Create SectionHeader

**Files:**
- Create: `web/components/detail/core/SectionHeader.tsx`

- [ ] **Step 1: Create the component**

```typescript
// web/components/detail/core/SectionHeader.tsx
import type { FC } from "react";

interface SectionHeaderProps {
  label: string;
  count?: number | null;
  icon?: FC<{ size?: number; className?: string }>;
}

export function SectionHeader({ label, count, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={16} className="text-[var(--muted)]" />}
      <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--soft)]">
        {label}
      </span>
      {count != null && count > 0 && (
        <span className="font-mono text-xs bg-[var(--twilight)] text-[var(--muted)] px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/detail/core/SectionHeader.tsx
git commit -m "feat(detail): add SectionHeader component with mono label and count badge"
```

---

### Task 7: Create SectionWrapper

**Files:**
- Create: `web/components/detail/core/SectionWrapper.tsx`

- [ ] **Step 1: Create the component**

```typescript
// web/components/detail/core/SectionWrapper.tsx
import { SectionHeader } from "./SectionHeader";
import type { SectionModule, EntityData } from "@/lib/detail/types";

interface SectionWrapperProps {
  module: SectionModule;
  data: EntityData;
  children: React.ReactNode;
}

export function SectionWrapper({ module, data, children }: SectionWrapperProps) {
  const count = module.getCount?.(data) ?? null;

  return (
    <section className="border-t border-[var(--twilight)]">
      <div className="px-4 lg:px-8 pt-5 pb-1">
        <SectionHeader label={module.label} count={count} icon={module.icon} />
      </div>
      <div className="px-4 lg:px-8 pb-5">{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/detail/core/SectionWrapper.tsx
git commit -m "feat(detail): add SectionWrapper with consistent section chrome"
```

---

### Task 8: Create DetailHero

**Files:**
- Create: `web/components/detail/core/DetailHero.tsx`

- [ ] **Step 1: Create the unified hero component**

This replaces both `DetailHeroImage.tsx` and `HeroGallery.tsx`. Supports image, gallery, poster, logo, and fallback modes.

```typescript
// web/components/detail/core/DetailHero.tsx
"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { getCategoryColor } from "@/lib/category-config";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { HeroConfig } from "@/lib/detail/types";

interface DetailHeroProps extends HeroConfig {}

export function DetailHero({
  imageUrl,
  aspectClass,
  fallbackMode,
  galleryEnabled,
  galleryUrls,
  category,
  isLive,
  overlaySlot,
  mobileMaxHeight,
}: DetailHeroProps) {
  const [imgError, setImgError] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  const images = galleryEnabled && galleryUrls?.length
    ? galleryUrls
    : imageUrl && !imgError
      ? [imageUrl]
      : [];

  const currentImage = images[galleryIndex];
  const categoryColor = getCategoryColor(category);

  const handlePrev = useCallback(() => {
    setGalleryIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setGalleryIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  // Fallback: no image
  if (!currentImage) {
    return (
      <div
        className={`relative ${aspectClass} ${mobileMaxHeight ?? ""} w-full overflow-hidden rounded-t-xl bg-gradient-to-b from-[var(--dusk)] to-[var(--night)]`}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `${categoryColor}05` }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <CategoryIcon category={category} size={64} className="opacity-[0.35]" />
          {category && (
            <span
              className="text-2xs font-mono uppercase tracking-wider"
              style={{ color: `${categoryColor}66` }}
            >
              {category}
            </span>
          )}
        </div>
        {overlaySlot}
      </div>
    );
  }

  return (
    <div className={`relative ${aspectClass} ${mobileMaxHeight ?? ""} w-full overflow-hidden rounded-t-xl bg-[var(--night)]`}>
      {/* Skeleton */}
      {!imgLoaded && (
        <div className="absolute inset-0 bg-[var(--twilight)] animate-pulse" />
      )}

      {/* Image */}
      <Image
        src={currentImage}
        alt=""
        fill
        className={`object-cover brightness-[0.85] transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
        sizes="(max-width: 1024px) 100vw, 340px"
        priority
      />

      {/* Live ring */}
      {isLive && (
        <div className="absolute inset-0 rounded-t-xl ring-2 ring-[var(--coral)] ring-inset" />
      )}

      {/* Gallery controls */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
            aria-label="Next image"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setGalleryIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === galleryIndex ? "bg-white" : "bg-white/40"}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {overlaySlot}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/detail/core/DetailHero.tsx
git commit -m "feat(detail): add unified DetailHero with image/gallery/fallback modes"
```

---

### Task 9: Create DetailIdentity wrapper

**Files:**
- Create: `web/components/detail/core/DetailIdentity.tsx`

- [ ] **Step 1: Create the component**

```typescript
// web/components/detail/core/DetailIdentity.tsx

interface DetailIdentityProps {
  children: React.ReactNode;
}

export function DetailIdentity({ children }: DetailIdentityProps) {
  return (
    <div className="px-5 py-4 border-b border-[var(--twilight)]/40">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/detail/core/DetailIdentity.tsx
git commit -m "feat(detail): add DetailIdentity sidebar wrapper"
```

---

### Task 10: Create DetailActions

**Files:**
- Create: `web/components/detail/core/DetailActions.tsx`

- [ ] **Step 1: Create the component**

```typescript
// web/components/detail/core/DetailActions.tsx
"use client";

import type { ActionConfig } from "@/lib/detail/types";

interface DetailActionsProps {
  config: ActionConfig;
  accentColor: string;
}

export function DetailActions({ config, accentColor }: DetailActionsProps) {
  const { primaryCTA, secondaryActions } = config;

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Primary CTA */}
      {primaryCTA && (
        primaryCTA.href ? (
          <a
            href={primaryCTA.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`block w-full text-center py-3 rounded-xl font-semibold text-sm transition-colors duration-300 min-h-[44px] ${
              primaryCTA.variant === "filled"
                ? "bg-[var(--coral)] text-white hover:bg-[var(--coral)]/90"
                : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
            }`}
          >
            {primaryCTA.label}
          </a>
        ) : (
          <button
            onClick={primaryCTA.onClick}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors duration-300 min-h-[44px] ${
              primaryCTA.variant === "filled"
                ? "bg-[var(--coral)] text-white hover:bg-[var(--coral)]/90"
                : "border border-[var(--twilight)] text-[var(--cream)] hover:bg-[var(--twilight)]/50"
            }`}
          >
            {primaryCTA.label}
          </button>
        )
      )}

      {/* Secondary actions row */}
      {secondaryActions.length > 0 && (
        <div className="flex gap-2 justify-center">
          {secondaryActions.map((action, i) => (
            action.href ? (
              <a
                key={i}
                href={action.href}
                className="w-10 h-10 rounded-xl border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors duration-300"
                title={action.label}
              >
                {action.icon}
              </a>
            ) : (
              <button
                key={i}
                onClick={action.onClick}
                className="w-10 h-10 rounded-xl border border-[var(--twilight)] flex items-center justify-center text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors duration-300"
                title={action.label}
              >
                {action.icon}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/detail/core/DetailActions.tsx
git commit -m "feat(detail): add DetailActions with primary CTA and secondary icon buttons"
```

---

### Task 11: Create DetailLayout — the central pipeline

**Files:**
- Create: `web/components/detail/core/DetailLayout.tsx`

This is the most important component. It wires everything together: sidebar (hero + identity + actions), content (section pipeline), and bottom bar.

- [ ] **Step 1: Create the component**

```typescript
// web/components/detail/core/DetailLayout.tsx
"use client";

import { useMemo } from "react";
import { DetailShell } from "@/components/detail/DetailShell";
import { DetailHero } from "./DetailHero";
import { DetailIdentity } from "./DetailIdentity";
import { DetailActions } from "./DetailActions";
import { SectionWrapper } from "./SectionWrapper";
import { DetailStickyBar } from "@/components/detail/DetailStickyBar";
import { NeonBackButton } from "@/components/detail/NeonBackButton";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { sectionRegistry } from "@/components/detail/sections";
import type {
  HeroConfig,
  ActionConfig,
  SectionId,
  EntityData,
  EntityType,
  SectionModule,
} from "@/lib/detail/types";

interface DetailLayoutProps {
  heroConfig: HeroConfig;
  identity: React.ReactNode;
  actionConfig: ActionConfig;
  manifest: SectionId[];
  data: EntityData;
  portalSlug: string;
  accentColor: string;
  entityType: EntityType;
  onClose?: () => void;
  accentColorSecondary?: string;
}

export function DetailLayout({
  heroConfig,
  identity,
  actionConfig,
  manifest,
  data,
  portalSlug,
  accentColor,
  entityType,
  onClose,
  accentColorSecondary,
}: DetailLayoutProps) {
  // Resolve accent color CSS
  const accentClass = useMemo(
    () => createCssVarClass("--detail-accent", accentColor, "detail-accent"),
    [accentColor],
  );
  const secondaryAccentClass = useMemo(
    () =>
      accentColorSecondary
        ? createCssVarClass("--detail-accent-secondary", accentColorSecondary, "detail-accent-2")
        : null,
    [accentColorSecondary],
  );

  // Filter manifest through trait checks and allowedEntityTypes
  const resolvedSections = useMemo(() => {
    const sections: SectionModule[] = [];
    for (const id of manifest) {
      const module = sectionRegistry.get(id);
      if (!module) continue;
      if (!module.allowedEntityTypes.includes(entityType)) continue;
      if (!module.trait(data)) continue;
      sections.push(module);
    }

    // Thin state: if <3 sections, try injecting nearby and connections
    if (sections.length < 3) {
      for (const fallbackId of ["nearby", "connections"] as SectionId[]) {
        if (sections.some((s) => s.id === fallbackId)) continue;
        const mod = sectionRegistry.get(fallbackId);
        if (mod && mod.allowedEntityTypes.includes(entityType) && mod.trait(data)) {
          sections.push(mod);
        }
      }
    }

    return sections;
  }, [manifest, data, entityType]);

  // Build sidebar
  const sidebar = (
    <>
      <DetailHero {...heroConfig} />
      <DetailIdentity>{identity}</DetailIdentity>
      <DetailActions config={actionConfig} accentColor={accentColor} />
    </>
  );

  // Build content
  const content = (
    <>
      {resolvedSections.length === 0 ? (
        // Empty state
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--twilight)] flex items-center justify-center mb-4 opacity-20">
            <span className="text-2xl">?</span>
          </div>
          <h3 className="text-base font-semibold text-[var(--cream)] mb-1">
            We&apos;re still learning about this place
          </h3>
          <p className="text-sm text-[var(--muted)]">
            Check back soon — or help us out by suggesting details
          </p>
        </div>
      ) : (
        resolvedSections.map((module) => {
          const Section = module.component;
          return (
            <SectionWrapper key={module.id} module={module} data={data}>
              <Section
                data={data}
                portalSlug={portalSlug}
                accentColor={accentColor}
                entityType={entityType}
              />
            </SectionWrapper>
          );
        })
      )}
    </>
  );

  // Build top bar
  const topBar = (
    <div className="flex items-center justify-between w-full">
      <NeonBackButton onClick={onClose} />
    </div>
  );

  // Build bottom bar (sticky on mobile)
  const bottomBar = actionConfig.stickyBar.enabled ? (
    <DetailStickyBar
      primaryAction={
        actionConfig.primaryCTA
          ? {
              label: actionConfig.primaryCTA.label,
              href: actionConfig.primaryCTA.href,
              onClick: actionConfig.primaryCTA.onClick,
            }
          : undefined
      }
      primaryVariant={actionConfig.primaryCTA?.variant}
      primaryColor={accentColor}
      scrollThreshold={actionConfig.stickyBar.scrollThreshold}
      showShareButton
    />
  ) : undefined;

  return (
    <>
      <ScopedStyles css={[accentClass?.css, secondaryAccentClass?.css].filter(Boolean).join("\n")} />
      <DetailShell
        topBar={topBar}
        sidebar={sidebar}
        content={content}
        bottomBar={bottomBar}
        onClose={onClose}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

Note: This will fail until the section registry exists (Task 13). That's expected. Verify no other type errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/detail/core/DetailLayout.tsx
git commit -m "feat(detail): add DetailLayout central pipeline with section filtering and thin state handling"
```

---

## Phase 3: Section Modules

### Task 12: Create AboutSection (template pattern)

This is the simplest section and establishes the pattern all others follow.

**Files:**
- Create: `web/components/detail/sections/AboutSection.tsx`

- [ ] **Step 1: Create the section**

```typescript
// web/components/detail/sections/AboutSection.tsx
import { LinkifyText } from "@/components/LinkifyText";
import type { SectionProps } from "@/lib/detail/types";

export function AboutSection({ data }: SectionProps) {
  let description: string | null = null;

  switch (data.entityType) {
    case "event":
      description = data.payload.event.display_description || data.payload.event.description;
      break;
    case "place":
      description = (data.payload.spot as Record<string, unknown>).description as string | null;
      break;
    case "series":
      description = data.payload.series.description;
      break;
    case "festival":
      description = data.payload.festival.description;
      break;
    case "org":
      description = data.payload.organization.description ?? null;
      break;
  }

  if (!description) return null;

  return (
    <div className="text-sm text-[var(--soft)] leading-relaxed">
      <LinkifyText text={description} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/components/detail/sections/AboutSection.tsx
git commit -m "feat(detail): add AboutSection module"
```

---

### Task 13: Create section registry with AboutSection

**Files:**
- Create: `web/components/detail/sections/index.ts`

- [ ] **Step 1: Create the registry**

```typescript
// web/components/detail/sections/index.ts
import type { SectionId, SectionModule } from "@/lib/detail/types";
import { hasDescription } from "@/lib/detail/traits";
import { AboutSection } from "./AboutSection";
import { Article } from "@phosphor-icons/react";

const about: SectionModule = {
  id: "about",
  component: AboutSection,
  trait: hasDescription,
  label: "About",
  icon: Article,
  allowedEntityTypes: ["event", "place", "series", "festival", "org"],
};

// Registry — add sections here as they're built
const modules: SectionModule[] = [about];

export const sectionRegistry = new Map<SectionId, SectionModule>(
  modules.map((m) => [m.id, m]),
);
```

- [ ] **Step 2: Verify it compiles with DetailLayout**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/detail/sections/index.ts
git commit -m "feat(detail): add section registry with AboutSection"
```

---

### Task 14: Build remaining section modules

Each section follows the same pattern as AboutSection. Build all 19 remaining sections, registering each in `index.ts`. For each section:

1. Create the component file in `web/components/detail/sections/`
2. The component receives `SectionProps` and narrows `data.entityType` internally
3. Extract rendering logic from the existing monolithic view that currently handles this content
4. Add the module definition to the registry in `index.ts`

**Source mapping — where to extract each section's rendering logic from:**

| Section | Extract from | Lines (approx) |
|---------|-------------|----------------|
| `LineupSection` | `EventDetailView.tsx` lineup rendering | 750-850 |
| `ShowtimesSection` | `SeriesDetailView.tsx` film showtimes + `PlaceScreeningsSection.tsx` | 500-558, all |
| `DiningSection` | `DiningDetailsSection.tsx` | all (301 lines) |
| `ExhibitionsSection` | `PlaceDetailView.tsx` exhibitions rendering | inline |
| `ScheduleSection` | `FestivalScheduleGrid.tsx` + `FestivalDetailView.tsx` day tabs | all + 348-600 |
| `UpcomingDatesSection` | `SeriesDetailView.tsx` non-film dates | 560-603 |
| `EventsAtVenueSection` | `PlaceDetailView.tsx` upcoming events | inline |
| `FeaturesSection` | `PlaceFeaturesSection.tsx` | all (276 lines) |
| `ConnectionsSection` | NEW — uses `resolveConnections` from `web/lib/detail/connections.ts` | new |
| `SocialProofSection` | `EventDetailView.tsx` social proof | inline |
| `GettingThereSection` | `EventDetailView.tsx` location + `PlaceDetailView.tsx` getting there | inline |
| `NearbySection` | `AroundHereSection.tsx` | all (399 lines) |
| `PlanYourVisitSection` | `PlanYourVisitSection.tsx` + `AccessibilitySection.tsx` | all + all |
| `SpecialsSection` | `PlaceSpecialsSection.tsx` | all (109 lines) |
| `OccasionsSection` | `PlaceDetailView.tsx` occasions rendering | inline |
| `AccoladesSection` | `AccoladesSection.tsx` | all (121 lines) |
| `ShowSignalsSection` | `EventDetailView.tsx` show signals panel | inline |
| `VolunteerSection` | `OrgDetailView.tsx` volunteer rendering | inline |
| `ProducerSection` | `ProducerSection.tsx` | all (65 lines) |

**For each section, follow this process:**
1. Read the source file(s) listed above
2. Create `web/components/detail/sections/{SectionName}.tsx`
3. Adapt the rendering to use `SectionProps` with `data.entityType` narrowing
4. Replace any hardcoded hex colors with CSS variables
5. Replace any inline SVGs with Phosphor icons
6. Add the module to the registry in `index.ts` with correct `trait`, `allowedEntityTypes`, and `getCount`

**ConnectionsSection is the only fully new section** — it renders `ConnectionRow[]` from `resolveConnections()`:

```typescript
// web/components/detail/sections/ConnectionsSection.tsx
import { resolveConnections } from "@/lib/detail/connections";
import type { SectionProps } from "@/lib/detail/types";

export function ConnectionsSection({ data, portalSlug }: SectionProps) {
  const connections = resolveConnections(data, portalSlug);
  if (connections.length === 0) return null;

  return (
    <div className="space-y-2">
      {connections.map((row) => (
        <a
          key={row.id}
          href={row.href}
          className={`flex items-center gap-3 rounded-lg p-3 transition-colors duration-300 hover:bg-[var(--twilight)]/50 ${
            row.accent === "gold"
              ? "bg-[var(--gold)]/5 border border-[var(--gold)]/20"
              : row.accent === "coral"
                ? "bg-[var(--coral)]/5 border border-[var(--coral)]/20"
                : "bg-[var(--night)]"
          }`}
        >
          {row.avatars ? (
            <div className="flex -space-x-1.5">
              {row.avatars.slice(0, 3).map((url, i) => (
                <div
                  key={i}
                  className="w-[18px] h-[18px] rounded-full border-2 border-[var(--night)]"
                  style={{ backgroundImage: `url(${url})`, backgroundSize: "cover" }}
                />
              ))}
            </div>
          ) : (
            <div className="w-9 h-9 bg-[var(--twilight)] rounded-lg flex items-center justify-center flex-shrink-0">
              {row.imageUrl ? (
                <img src={row.imageUrl} alt="" className="w-full h-full rounded-lg object-cover" />
              ) : (
                <span className="text-sm">
                  {row.type === "venue" ? "📍" : row.type === "festival" ? "🎪" : row.type === "org" ? "🏢" : row.type === "series" ? "🔄" : "⬡"}
                </span>
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-[var(--cream)] truncate">{row.label}</div>
            <div className="text-xs text-[var(--muted)] truncate">{row.contextLine}</div>
          </div>
          <span className="text-[var(--twilight)] text-sm flex-shrink-0">→</span>
        </a>
      ))}
    </div>
  );
}
```

- [ ] **Step 1: Build sections in batches of 4-5, committing after each batch**

Batch 1: `LineupSection`, `ShowtimesSection`, `DiningSection`, `ExhibitionsSection`
Batch 2: `ScheduleSection`, `UpcomingDatesSection`, `EventsAtVenueSection`, `FeaturesSection`
Batch 3: `ConnectionsSection`, `SocialProofSection`, `GettingThereSection`, `NearbySection`
Batch 4: `PlanYourVisitSection`, `SpecialsSection`, `OccasionsSection`, `AccoladesSection`
Batch 5: `ShowSignalsSection`, `VolunteerSection`, `ProducerSection`

- [ ] **Step 2: After each batch, register in index.ts and verify compilation**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: After all sections built, verify full registry**

The registry should have exactly 20 entries. Run:
```bash
grep -c "^const " web/components/detail/sections/index.ts
```
Expected: 20 module definitions

- [ ] **Step 4: Commit final registry state**

```bash
git add web/components/detail/sections/
git commit -m "feat(detail): complete all 20 section modules and registry"
```

---

## Phase 4: Manifests

### Task 15: Create all manifests

**Files:**
- Create: `web/components/detail/manifests/event.ts`
- Create: `web/components/detail/manifests/place.ts`
- Create: `web/components/detail/manifests/series.ts`
- Create: `web/components/detail/manifests/festival.ts`
- Create: `web/components/detail/manifests/org.ts`

- [ ] **Step 1: Create event manifest**

```typescript
// web/components/detail/manifests/event.ts
import type { SectionId } from "@/lib/detail/types";

export const eventManifest: SectionId[] = [
  "about",
  "lineup",
  "showSignals",
  "connections",
  "socialProof",
  "gettingThere",
  "producer",
  "nearby",
];
```

- [ ] **Step 2: Create place manifest with subtype routing**

```typescript
// web/components/detail/manifests/place.ts
import type { SectionId } from "@/lib/detail/types";

const cinema: SectionId[] = [
  "showtimes", "about", "connections", "eventsAtVenue",
  "features", "planYourVisit", "nearby",
];

const restaurant: SectionId[] = [
  "dining", "about", "occasions", "specials",
  "eventsAtVenue", "accolades", "connections", "nearby",
];

const museum: SectionId[] = [
  "exhibitions", "about", "features", "planYourVisit",
  "eventsAtVenue", "socialProof", "accolades", "connections", "nearby",
];

const bar: SectionId[] = [
  "eventsAtVenue", "about", "occasions", "specials",
  "accolades", "connections", "nearby",
];

const park: SectionId[] = [
  "features", "about", "eventsAtVenue", "planYourVisit",
  "accolades", "connections", "nearby",
];

const musicVenue: SectionId[] = [
  "eventsAtVenue", "about", "occasions", "specials",
  "features", "connections", "nearby",
];

const SUBTYPE_MAP: Record<string, SectionId[]> = {
  movie_theater: cinema,
  cinema: cinema,
  drive_in_theater: cinema,
  restaurant: restaurant,
  cafe: restaurant,
  bakery: restaurant,
  food_hall: restaurant,
  food_truck: restaurant,
  museum: museum,
  gallery: museum,
  arts_center: museum,
  historic_site: museum,
  science_center: museum,
  bar: bar,
  nightclub: bar,
  lounge: bar,
  sports_bar: bar,
  wine_bar: bar,
  brewery: bar,
  distillery: bar,
  park: park,
  garden: park,
  nature_preserve: park,
  recreation: park,
  trail: park,
  music_venue: musicVenue,
  amphitheater: musicVenue,
  stadium: musicVenue,
  theater: musicVenue,
  event_space: musicVenue,
};

export function getPlaceManifest(placeType: string | null | undefined): SectionId[] {
  return SUBTYPE_MAP[placeType ?? ""] ?? musicVenue;
}
```

- [ ] **Step 3: Create series manifest**

```typescript
// web/components/detail/manifests/series.ts
import type { SectionId } from "@/lib/detail/types";

const filmSeries: SectionId[] = ["showtimes", "about", "connections", "gettingThere"];
const recurringSeries: SectionId[] = ["upcomingDates", "about", "connections", "gettingThere"];

export function getSeriesManifest(isFilm: boolean): SectionId[] {
  return isFilm ? filmSeries : recurringSeries;
}
```

- [ ] **Step 4: Create festival manifest**

```typescript
// web/components/detail/manifests/festival.ts
import type { SectionId } from "@/lib/detail/types";

export const festivalManifest: SectionId[] = [
  "schedule", "about", "showtimes", "exhibitions",
  "connections", "gettingThere", "producer",
];
```

- [ ] **Step 5: Create org manifest**

```typescript
// web/components/detail/manifests/org.ts
import type { SectionId } from "@/lib/detail/types";

export const orgManifest: SectionId[] = [
  "about", "volunteer", "eventsAtVenue", "connections",
];
```

- [ ] **Step 6: Verify all compile**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add web/components/detail/manifests/
git commit -m "feat(detail): add section manifests for all entity types and place subtypes"
```

---

## Phase 5: Identity Zones

### Task 16: Create all identity zone components

**Files:**
- Create: `web/components/detail/identity/EventIdentity.tsx`
- Create: `web/components/detail/identity/PlaceIdentity.tsx`
- Create: `web/components/detail/identity/SeriesIdentity.tsx`
- Create: `web/components/detail/identity/FestivalIdentity.tsx`
- Create: `web/components/detail/identity/OrgIdentity.tsx`

Each identity component extracts the sidebar rendering from its corresponding monolithic view. The spec (section 5.4) defines what each zone contains.

- [ ] **Step 1: Create EventIdentity**

Extract from `EventDetailView.tsx` lines 470-730 (sidebar composition). Key elements:
- Title, venue link (with address inline below), date + time + price
- Genre pills, taxonomy badges (cost_tier, duration, indoor_outdoor, booking_required)
- Show signals summary (doors time, age policy)
- Use `formatEventTime` and `formatPriceRange` from `web/lib/detail/format.ts`
- Replace all hardcoded hex with CSS variables

- [ ] **Step 2: Create PlaceIdentity**

Extract from `PlaceDetailView.tsx` lines 415-550 (sidebar). Key elements:
- Name, type badge with `getCategoryColor`, neighborhood
- Price level, Google rating
- Quick actions grid (reserve/website, menu, phone, directions) using `QuickActionLink`
- Hours summary

- [ ] **Step 3: Create SeriesIdentity**

Extract from `SeriesDetailView.tsx` lines 269-421 (sidebar). Key elements:
- Title, type badge (Film/Recurring), recurrence label via `formatRecurrence`
- Venue link (single-venue series)
- Film metadata: year, rating, runtime via `formatDuration`
- Director + trailer link (film only)
- Genre pills

- [ ] **Step 4: Create FestivalIdentity**

Extract from `FestivalDetailView.tsx` lines 473-550 (sidebar). Key elements:
- Name, type badge, date range via `formatDateRange`
- Location, temporal status banner (derive from announced_start/end)
- Experience tags via `ExperienceTagStrip`
- Price/duration metadata

- [ ] **Step 5: Create OrgIdentity**

Extract from `OrgDetailView.tsx` (InfoCard content). Key elements:
- Logo (or category icon fallback), name, org_type, location
- Primary activity summary: next event name or "Presents N events"
- Category tags
- Links: website, Instagram, email

- [ ] **Step 6: Verify all compile**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add web/components/detail/identity/
git commit -m "feat(detail): add identity zone components for all 5 entity types"
```

---

## Phase 6: Orchestrators

### Task 17: Rewrite EventDetailView as thin orchestrator

**Files:**
- Modify: `web/components/views/EventDetailView.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the 990-line monolith with a ~60-line orchestrator that composes DetailLayout:

```typescript
// web/components/views/EventDetailView.tsx
"use client";

import { DetailLayout } from "@/components/detail/core/DetailLayout";
import { EventIdentity } from "@/components/detail/identity/EventIdentity";
import { eventManifest } from "@/components/detail/manifests/event";
import { useDetailData } from "@/lib/detail/use-detail-data";
import { getCategoryColor } from "@/lib/category-config";
import type { EventApiResponse, HeroConfig, ActionConfig, EntityData } from "@/lib/detail/types";
import { BookmarkSimple, CalendarPlus, ShareNetwork, UserPlus } from "@phosphor-icons/react";

interface EventDetailViewProps {
  eventId: number | string;
  portalSlug: string;
  onClose?: () => void;
  initialData?: EventApiResponse;
}

export default function EventDetailView({ eventId, portalSlug, onClose, initialData }: EventDetailViewProps) {
  const { data, status, error } = useDetailData<EventApiResponse>({
    entityType: "event",
    identifier: eventId,
    portalSlug,
    initialData,
  });

  if (status === "loading" || !data) return null; // TODO: skeleton from Phase 2 Task 8
  if (status === "error") return null; // TODO: error state

  const event = data.event;
  const accentColor = getCategoryColor(event.category);
  const entityData: EntityData = { entityType: "event", payload: data };

  const heroConfig: HeroConfig = {
    imageUrl: event.image_url,
    aspectClass: "aspect-video lg:aspect-[16/10]",
    fallbackMode: "category-icon",
    galleryEnabled: false,
    category: event.category,
    isLive: event.is_live,
  };

  const actionConfig: ActionConfig = {
    primaryCTA: event.ticket_url
      ? { label: event.is_free ? "RSVP" : "Get Tickets", href: event.ticket_url, variant: "filled" }
      : event.source_url
        ? { label: "Learn More", href: event.source_url, variant: "outlined" }
        : null,
    secondaryActions: [
      { icon: <BookmarkSimple size={18} weight="duotone" />, label: "Save" },
      { icon: <UserPlus size={18} weight="duotone" />, label: "Invite" },
      { icon: <CalendarPlus size={18} weight="duotone" />, label: "Calendar" },
      { icon: <ShareNetwork size={18} weight="duotone" />, label: "Share" },
    ],
    stickyBar: { enabled: !!event.ticket_url },
  };

  return (
    <DetailLayout
      heroConfig={heroConfig}
      identity={<EventIdentity event={event} portalSlug={portalSlug} />}
      actionConfig={actionConfig}
      manifest={eventManifest}
      data={entityData}
      portalSlug={portalSlug}
      accentColor={accentColor}
      entityType="event"
      onClose={onClose}
    />
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/components/views/EventDetailView.tsx
git commit -m "feat(detail): rewrite EventDetailView as thin orchestrator (~60 lines)"
```

---

### Task 18: Rewrite PlaceDetailView as thin orchestrator

**Files:**
- Modify: `web/components/views/PlaceDetailView.tsx`

- [ ] **Step 1: Rewrite the file**

Replace the 1,108-line monolith. Key differences from Event:
- Uses `getPlaceManifest(spot.spot_type)` for subtype-specific section ordering
- Gallery hero when `placeProfile.gallery_urls` exists
- Primary CTA varies: reservation_url → "Reserve", website → "Website", else → "Directions"

Follow the same pattern as Task 17 but with PlaceIdentity, getPlaceManifest, and PlaceApiResponse types.

- [ ] **Step 2: Verify and commit**

```bash
git add web/components/views/PlaceDetailView.tsx
git commit -m "feat(detail): rewrite PlaceDetailView as thin orchestrator with subtype manifests (~80 lines)"
```

---

### Task 19: Rewrite SeriesDetailView as thin orchestrator

**Files:**
- Modify: `web/components/views/SeriesDetailView.tsx`

- [ ] **Step 1: Rewrite the file**

Key differences:
- Uses `getSeriesManifest(series.series_type === "film")` for film vs non-film
- Film: poster aspect `aspect-[2/3]` with `mobileMaxHeight: "max-h-[280px]"`
- Non-film: banner fallback mode

- [ ] **Step 2: Verify and commit**

```bash
git add web/components/views/SeriesDetailView.tsx
git commit -m "feat(detail): rewrite SeriesDetailView as thin orchestrator (~60 lines)"
```

---

### Task 20: Rewrite FestivalDetailView as thin orchestrator

**Files:**
- Modify: `web/components/views/FestivalDetailView.tsx`

- [ ] **Step 1: Rewrite the file**

Key differences:
- Fixed hero height `h-[240px]` with gradient overlay
- Temporal CTA logic (from existing getTemporalState function — preserve this logic)
- festivalManifest

- [ ] **Step 2: Verify and commit**

```bash
git add web/components/views/FestivalDetailView.tsx
git commit -m "feat(detail): rewrite FestivalDetailView as thin orchestrator (~60 lines)"
```

---

### Task 21: Rewrite OrgDetailView as thin orchestrator

**Files:**
- Modify: `web/components/views/OrgDetailView.tsx`

- [ ] **Step 1: Rewrite the file**

Key differences:
- Logo hero mode (small centered)
- No sticky bar
- orgManifest
- Uses `useDetailData` instead of manual fetch (current view has bespoke retry logic)

- [ ] **Step 2: Verify and commit**

```bash
git add web/components/views/OrgDetailView.tsx
git commit -m "feat(detail): rewrite OrgDetailView as thin orchestrator (~50 lines)"
```

---

## Phase 7: Cleanup & Verification

### Task 22: Delete superseded files

**Files to delete** (23 files):

```bash
git rm web/components/detail/RelatedCard.tsx
git rm web/components/detail/RelatedSection.tsx
git rm web/components/detail/PlaceEventsSection.tsx
git rm web/components/detail/DescriptionTeaser.tsx
git rm web/components/detail/SocialProofStrip.tsx
git rm web/components/detail/MetadataGrid.tsx
git rm web/components/detail/DetailHero.tsx
git rm web/components/detail/InfoCard.tsx
git rm web/components/detail/DetailHeroImage.tsx
git rm web/components/detail/DiningDetailsSection.tsx
git rm web/components/detail/PlaceFeaturesSection.tsx
git rm web/components/detail/PlaceSpecialsSection.tsx
git rm web/components/detail/AccessibilitySection.tsx
git rm web/components/detail/PlaceScreeningsSection.tsx
git rm web/components/detail/FestivalScheduleGrid.tsx
git rm web/components/detail/AroundHereSection.tsx
git rm web/components/detail/DogNearbySection.tsx
git rm web/components/detail/AccoladesSection.tsx
git rm web/components/detail/HeroGallery.tsx
git rm web/components/detail/PlanYourVisitSection.tsx
git rm web/components/detail/ProducerSection.tsx
git rm web/components/detail/SectionHeader.tsx
git rm web/components/detail/YonderAdventureSnapshot.tsx
```

- [ ] **Step 1: Delete all superseded files**

- [ ] **Step 2: Update `web/components/detail/index.ts`** to remove exports of deleted files and add exports of new core/ components

- [ ] **Step 3: Fix any remaining import errors**

Run: `cd web && npx tsc --noEmit 2>&1 | head -40`

Fix any broken imports across the codebase that referenced deleted files.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(detail): delete 23 superseded detail components"
```

---

### Task 23: Full verification

- [ ] **Step 1: TypeScript compilation**

Run: `cd web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Run existing tests**

Run: `cd web && npm test`
Expected: All passing (the AccoladesSection.test.ts may need updating since the file moved)

- [ ] **Step 3: Dev server smoke test**

Run: `cd web && npm run dev`

Open in browser and verify:
1. Event detail page loads (click any event in feed)
2. Place detail page loads (click any venue)
3. Series detail page loads (click a film series)
4. Festival detail page loads (click a festival)
5. Org detail page loads (click a producer)
6. All section headers render with mono labels
7. NeonBackButton appears on all pages
8. Mobile layout shows compact identity (resize browser to 375px)

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(detail): resolve post-migration issues from full verification"
```

---

## Summary

| Phase | Tasks | Estimated Files |
|-------|-------|----------------|
| 0: Pencil Comps | Interactive design | 24 .pen comps |
| 1: Types & Data | Tasks 1-5 | 5 new files |
| 2: Core Layout | Tasks 6-11 | 6 new files |
| 3: Sections | Tasks 12-14 | 21 new files |
| 4: Manifests | Task 15 | 5 new files |
| 5: Identity | Task 16 | 5 new files |
| 6: Orchestrators | Tasks 17-21 | 5 modified files |
| 7: Cleanup | Tasks 22-23 | 23 deleted files |

**Net result:** ~4,200 LOC monoliths → ~310 LOC orchestrators + ~3,500 LOC focused modules. 23 dead files removed. 0 dead code.
