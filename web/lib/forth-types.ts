/**
 * Shared types for the FORTH hotel concierge portal.
 * Used by both server-side data modules and client components.
 */

export type DayPart = "morning" | "afternoon" | "evening" | "late_night";
// DiscoveryMode and ForthMode removed — unused after concierge migration

export type FeedSection = {
  title: string;
  slug?: string;
  description?: string;
  events: FeedEvent[];
};

export type FeedEvent = {
  id: string;
  title: string;
  start_date: string;
  start_time?: string | null;
  image_url?: string | null;
  description?: string | null;
  venue_name?: string | null;
  category?: string | null;
  subcategory?: string | null;
  is_free?: boolean;
  price_min?: number | null;
  distance_km?: number | null;
};

export type Destination = {
  venue: {
    id: number;
    slug: string;
    name: string;
    neighborhood: string | null;
    venue_type: string | null;
    image_url: string | null;
    short_description: string | null;
  };
  distance_km: number;
  proximity_tier: "walkable" | "close" | "destination";
  proximity_label: string;
  special_state: "active_now" | "starting_soon" | "none";
  top_special: {
    title: string;
    type: string;
    price_note: string | null;
    confidence?: "high" | "medium" | "low" | null;
    starts_in_minutes: number | null;
    remaining_minutes: number | null;
    last_verified_at?: string | null;
  } | null;
  next_event: {
    title: string;
    start_date: string;
    start_time: string | null;
  } | null;
};

export type SpecialsMeta = {
  total: number;
  active_now: number;
  starting_soon: number;
  tiers: {
    walkable: number;
    close: number;
    destination: number;
  };
};

export type AgentNarrative = {
  heroTitle: string;
  heroSubtitle: string;
  briefingTitle: string;
  summary: string;
};

// AgentJourney removed — unused, getForthFeed always returns null

export type SignatureVenue = {
  id: string;
  name: string;
  typeLabel: string;
  kind: "restaurant" | "bar";
  spotlight: string;
  mockSpecial: string;
  mockNote: string;
  photoUrl: string;
};

export type ForthAmenity = {
  id: string;
  name: string;
  serviceWindow: string;
  detail: string;
  photoUrl: string;
};

export type InRoomRequest = {
  id: string;
  title: string;
  detail: string;
  etaLabel: string;
  ctaLabel: string;
};

export type QuickAction = {
  label: string;
  icon: string;
  sectionId: string;
};

export type ForthFeedData = {
  sections: FeedSection[];
  destinations: Destination[];
  liveDestinations: Destination[];
  specialsMeta: SpecialsMeta | null;
  agentNarrative: AgentNarrative | null;
  agentJourney: null;
};

export type ForthPropertyData = {
  signatureVenues: SignatureVenue[];
  amenities: ForthAmenity[];
  inRoomServices: InRoomRequest[];
  conciergePhone: string;
};

/** Format a phone string into a tel: href */
export function phoneHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}
