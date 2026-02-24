/**
 * Shared TypeScript types for the City Pulse feed system.
 *
 * City Pulse is a unified feed that blends events, destinations (venues),
 * and specials as first-class content. Context-aware by default (time,
 * weather, holidays). Personalization is a scoring layer, not a separate tab.
 */

import type { FeedEventData } from "@/components/EventCard";
import type { Spot } from "@/lib/spots-constants";
import type { FeedSectionData } from "@/components/feed/FeedSection";
import type { WeatherData } from "@/lib/weather-utils";
import type { RecommendationReason } from "@/components/ReasonBadge";

// ---------------------------------------------------------------------------
// Time slots
// ---------------------------------------------------------------------------

export type TimeSlot =
  | "morning"       // 5:00 – 10:59
  | "midday"        // 11:00 – 14:59
  | "happy_hour"    // 15:00 – 17:59
  | "evening"       // 18:00 – 21:59
  | "late_night";   // 22:00 – 4:59

// ---------------------------------------------------------------------------
// Feed context
// ---------------------------------------------------------------------------

export interface QuickLink {
  label: string;
  icon: string;
  href: string;
  accent_color: string;
}

export interface FeedContext {
  time_slot: TimeSlot;
  day_of_week: string; // "monday" | "tuesday" | ...
  weather: Pick<WeatherData, "temperature_f" | "condition" | "icon"> | null;
  active_holidays: HolidayInfo[];
  active_festivals: FestivalInfo[];
  quick_links: QuickLink[];
  day_theme?: string; // "taco_tuesday" | "wine_wednesday" | "brunch_weekend" etc.
  weather_signal?: string; // "rain" | "cold" | "nice" | "hot"
}

export interface HolidayInfo {
  slug: string;
  title: string;
  accent_color: string;
}

export interface FestivalInfo {
  id: string;
  name: string;
  slug: string;
}

// ---------------------------------------------------------------------------
// Personalization
// ---------------------------------------------------------------------------

export type PersonalizationLevel =
  | "anonymous"
  | "logged_in"
  | "has_prefs"
  | "has_social";

export interface PersonalizationMeta {
  level: PersonalizationLevel;
  applied: boolean;
}

// ---------------------------------------------------------------------------
// City Pulse items
// ---------------------------------------------------------------------------

export type CityPulseItemType =
  | "event"
  | "destination"
  | "special"
  | "conversion_prompt";

export interface CityPulseEventItem {
  item_type: "event";
  event: FeedEventData & {
    contextual_label?: string;
    friends_going?: FriendGoingInfo[];
    score?: number;
    reasons?: RecommendationReason[];
    featured?: boolean;
    is_recurring?: boolean;
    recurrence_label?: string;
  };
}

export interface CityPulseDestinationItem {
  item_type: "destination";
  destination: {
    venue: Spot;
    contextual_label?: string;
    is_open?: boolean;
    top_special?: {
      id: number;
      title: string;
      type: string;
      state: "active_now" | "starting_soon";
    } | null;
  };
}

export interface CityPulseSpecialItem {
  item_type: "special";
  special: {
    id: number;
    venue: Pick<Spot, "id" | "name" | "slug" | "neighborhood" | "venue_type" | "image_url">;
    title: string;
    type: string;
    state: "active_now" | "starting_soon";
    starts_in_minutes?: number | null;
    remaining_minutes?: number | null;
    price_note?: string | null;
    description?: string | null;
  };
}

export interface CityPulseConversionItem {
  item_type: "conversion_prompt";
  conversion: {
    prompt_type: "friends_teaser" | "save_teaser" | "calendar_teaser" | "prefs_teaser";
    headline: string;
    cta_label: string;
    cta_href: string;
  };
}

export type CityPulseItem =
  | CityPulseEventItem
  | CityPulseDestinationItem
  | CityPulseSpecialItem
  | CityPulseConversionItem;

// ---------------------------------------------------------------------------
// City Pulse sections
// ---------------------------------------------------------------------------

export type CityPulseSectionType =
  | "city_pulse_banner"
  | "right_now"
  | "tonight"
  | "this_week"
  | "weather_discovery"
  | "this_weekend"
  | "your_people"
  | "new_from_spots"
  | "trending"
  | "coming_up"
  | "browse"
  | "todays_specials";

export type SectionLayout = "hero" | "carousel" | "list" | "grid";

export interface CityPulseSection {
  id: string;
  type: CityPulseSectionType;
  title: string;
  subtitle?: string;
  priority: "primary" | "secondary" | "tertiary";
  accent_color?: string;
  items: CityPulseItem[];
  meta?: Record<string, unknown>;
  layout?: SectionLayout;
  block_id?: string;
}

// ---------------------------------------------------------------------------
// Feed Header CMS types
// ---------------------------------------------------------------------------

/** Layout variants for the GreetingBar hero */
export type LayoutVariant = "centered" | "bottom-left" | "split" | "editorial";

/** Text treatment presets — control how text renders over hero photos */
export type TextTreatment = "auto" | "clean" | "frosted" | "bold" | "cinematic";

/** Raw database row from portal_feed_headers */
export interface FeedHeaderRow {
  id: string;
  portal_id: string;
  slug: string;
  name: string;
  is_active: boolean;
  priority: number;
  schedule_start: string | null;
  schedule_end: string | null;
  show_on_days: string[] | null;
  show_after_time: string | null;
  show_before_time: string | null;
  conditions: FeedHeaderConditions;
  headline: string | null;
  subtitle: string | null;
  hero_image_url: string | null;
  accent_color: string | null;
  layout_variant: LayoutVariant | null;
  text_treatment: TextTreatment | null;
  dashboard_cards: FeedHeaderCardConfig[] | null;
  quick_links: QuickLink[] | null;
  cta: FeedHeaderCta | null;
  suppressed_event_ids: number[] | null;
  boosted_event_ids: number[] | null;
  created_at: string;
  updated_at: string;
}

export interface FeedHeaderConditions {
  weather_signals?: string[];
  holidays?: string[];
  festivals?: boolean;
  time_slots?: string[];
  day_themes?: string[];
}

export interface FeedHeaderCardConfig {
  id: string;
  label: string;
  icon: string;
  href: string;
  accent?: string;
  value?: string;
  hide_when_empty?: boolean;
  query?: FeedHeaderCardQuery;
}

export interface FeedHeaderCardQuery {
  entity: "events" | "venues";
  category?: string;
  venue_type?: string;
  date_filter?: "today" | "tomorrow" | "this_weekend" | "this_week";
  time_after?: string;
  is_free?: boolean;
  is_open?: boolean;
}

export interface FeedHeaderCta {
  label: string;
  href: string;
  style?: "primary" | "ghost";
}

/** Server-resolved header sent to the client */
export interface ResolvedHeader {
  config_id: string | null;
  config_slug: string | null;
  headline: string;
  subtitle?: string;
  hero_image_url: string;
  accent_color: string;
  layout_variant?: LayoutVariant | null;
  text_treatment?: TextTreatment | null;
  dashboard_cards: DashboardCard[];
  quick_links: QuickLink[];
  cta?: FeedHeaderCta;
  events_pulse: EventsPulse;
  suppressed_event_ids: number[];
  boosted_event_ids: number[];
}

// ---------------------------------------------------------------------------
// API response
// ---------------------------------------------------------------------------

export interface CityPulseResponse {
  portal: {
    slug: string;
    name: string;
  };
  context: FeedContext;
  header: ResolvedHeader;
  sections: CityPulseSection[];
  /** Existing portal-admin curated sections, unchanged shape */
  curated_sections: FeedSectionData[];
  personalization: PersonalizationMeta;
  events_pulse: EventsPulse;
  /** Real event counts per timeline tab (cheap HEAD queries) */
  tab_counts?: { today: number; this_week: number; coming_up: number };
  /** Per-category event counts for each tab — exact server-side GROUP BY */
  category_counts?: {
    today: Record<string, number>;
    this_week: Record<string, number>;
    coming_up: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Friend info (used across scoring + social sections)
// ---------------------------------------------------------------------------

export interface FriendGoingInfo {
  user_id: string;
  username: string;
  display_name: string | null;
}

// ---------------------------------------------------------------------------
// User signals (loaded for authenticated users)
// ---------------------------------------------------------------------------

export interface UserSignals {
  userId: string;
  followedVenueIds: number[];
  followedOrganizationIds: string[];
  producerSourceIds: number[];
  sourceOrganizationMap: Record<number, string>;
  friendIds: string[];
  prefs: UserPreferences | null;
}

export interface UserPreferences {
  favorite_categories: string[] | null;
  favorite_genres?: Record<string, string[]> | null;
  favorite_neighborhoods: string[] | null;
  favorite_vibes: string[] | null;
  hide_adult_content?: boolean | null;
  needs_accessibility?: string[] | null;
  needs_dietary?: string[] | null;
  needs_family?: string[] | null;
  cross_portal_recommendations?: boolean | null;
  price_preference: string | null;
  feed_layout?: FeedLayout | null;
}

// ---------------------------------------------------------------------------
// Events pulse (GreetingBar stats)
// ---------------------------------------------------------------------------

export interface EventsPulse {
  total_active: number;
  trending_event: string | null;
}

// ---------------------------------------------------------------------------
// Dashboard cards (GreetingBar context-driven cards)
// ---------------------------------------------------------------------------

export interface DashboardCard {
  id: string;
  label: string;
  value: string;
  icon: string;
  href: string;
  accent?: string;
}

// ---------------------------------------------------------------------------
// Feed layout customization
// ---------------------------------------------------------------------------

export type FeedBlockId =
  | "timeline"
  | "trending"
  | "weather_discovery"
  | "your_people"
  | "new_from_spots"
  | "coming_up"
  | "browse";

export interface FeedLayout {
  visible_blocks: FeedBlockId[];
  hidden_blocks: FeedBlockId[];
  /** Active interest chip IDs for the Lineup filter. null/undefined = defaults. */
  interests?: string[] | null;
  version: 1;
}

export const DEFAULT_FEED_ORDER: FeedBlockId[] = [
  "timeline",
  "trending",
  "weather_discovery",
  "your_people",
  "new_from_spots",
  "coming_up",
  "browse",
];
