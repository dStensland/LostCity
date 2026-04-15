// web/lib/detail/types.ts

import type React from "react";

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
  is_adult?: boolean | null;
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
    id: number;
    name: string;
    slug: string;
    address: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
    place_type?: string | null;
    vibes: string[] | null;
    lat?: number | null;
    lng?: number | null;
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
    id: string;
    name: string;
    slug: string;
    org_type: string | null;
    website: string | null;
    logo_url: string | null;
  } | null;
  series: {
    id: string;
    title: string;
    slug: string;
    series_type: string;
    festival?: {
      id: string;
      name: string;
      slug: string;
      image_url: string | null;
      festival_type?: string | null;
      location: string | null;
      neighborhood: string | null;
    } | null;
  } | null;
}

export interface EventArtist {
  id: number;
  name: string;
  billing_order: number | null;
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
import type { SpotDetailPayload } from "@/lib/spot-detail";
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
  | { entityType: "place"; payload: SpotDetailPayload }
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon?: React.FC<any>;
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
    icon?: React.ReactNode;
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
