"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { Portal } from "@/lib/portal-context";
import { useAuth } from "@/lib/auth-context";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import HotelHeader from "./HotelHeader";
import HotelSection from "./HotelSection";
import HotelCarousel from "./HotelCarousel";
import HotelHeroCard from "./HotelHeroCard";
import HotelEventCard from "./HotelEventCard";
import HotelDestinationCard from "./HotelDestinationCard";

type FeedSection = {
  title: string;
  slug?: string;
  description?: string;
  events: Array<{
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
  }>;
};

type Destination = {
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
    confidence: "high" | "medium" | "low" | null;
    starts_in_minutes: number | null;
    remaining_minutes: number | null;
    last_verified_at: string | null;
  } | null;
  next_event: {
    title: string;
    start_date: string;
    start_time: string | null;
  } | null;
};

type SpecialsMeta = {
  total: number;
  active_now: number;
  starting_soon: number;
  tiers: {
    walkable: number;
    close: number;
    destination: number;
  };
};

type DayPart = "morning" | "afternoon" | "evening" | "late_night";
type DiscoveryMode = "tonight" | "future";
type PlanAheadCategory = "all" | "food" | "entertainment" | "destinations";
type ConciergeDaypart = "all" | "morning" | "day" | "evening" | "late_night";
type GuestIntent = "business" | "romance" | "night_out" | "wellness";
type ExperienceView = "operate" | "property" | "explore";
type VisitorPersona = "first_time" | "business_traveler" | "weekend_couple" | "wellness_guest" | "club_member";
type DiscoveryFocusId = "any" | "live_music" | "comedy" | "sports" | "arts";
type FoodDrinkFocusId = "any" | "cocktails" | "sports_bar" | "mexican" | "coffee" | "rooftop";
type DestinationVibeId = "any" | "walkable" | "beltline" | "culture";
type CuratorModeId = "safe" | "elevated" | "adventurous";

type DiscoveryFocus = {
  id: DiscoveryFocusId;
  label: string;
  hint: string;
  eventKeywords: string[];
  venueTypes: string[];
  searchQuery: string;
};

type FoodDrinkFocus = {
  id: FoodDrinkFocusId;
  label: string;
  hint: string;
  venueTypes: string[];
  keywords: string[];
  searchQuery: string;
};

type DestinationVibe = {
  id: DestinationVibeId;
  label: string;
  hint: string;
  searchQuery: string;
  sources: string[];
  eyebrow: string;
};

type CuratorMode = {
  id: CuratorModeId;
  label: string;
  hint: string;
};

type AgentNarrative = {
  heroTitle: string;
  heroSubtitle: string;
  briefingTitle: string;
  summary: string;
};

type AgentJourney = {
  title: string;
  steps: Array<{
    title: string;
    detail: string;
  }>;
  primaryAction: string;
};

type OrchestratedConciergeResponse = {
  session?: {
    persona?: string;
    intent?: string;
    view?: string;
  };
  guest_explainers?: string[];
  agent_outputs?: {
    ux_architecture?: {
      flow_title?: string;
      flow_steps?: Array<{
        title?: string;
        detail?: string;
      }>;
      primary_action?: string;
    };
    voice_narrative?: {
      hero_title?: string;
      hero_subtitle?: string;
      briefing_title?: string;
      summary?: string;
    };
  };
  data?: {
    sections?: Array<{
      title?: string;
      slug?: string;
      description?: string;
      events?: Array<Record<string, unknown>>;
    }>;
    destinations?: Destination[];
    live_destinations?: Destination[];
    meta?: SpecialsMeta | null;
  };
};

const GUEST_INTENT_OPTIONS: Array<{
  id: GuestIntent;
  label: string;
  hint: string;
}> = [
  {
    id: "night_out",
    label: "Night Out",
    hint: "Great for guests who want dinner, drinks, and a lively finish.",
  },
  {
    id: "business",
    label: "Business",
    hint: "Great for guests who want efficient plans and reliable timing.",
  },
  {
    id: "romance",
    label: "Romance",
    hint: "Great for date nights and elevated, intimate picks.",
  },
  {
    id: "wellness",
    label: "Wellness",
    hint: "Great for restorative options with lower-friction routing.",
  },
];

type PersonaProfile = {
  id: VisitorPersona;
  label: string;
  sublabel: string;
  intent: GuestIntent;
  defaultView: ExperienceView;
  preferredBundleId: string;
};

const PERSONA_PROFILES: PersonaProfile[] = [
  {
    id: "first_time",
    label: "First-Time Guest",
    sublabel: "Show signature FORTH picks plus easy nearby wins.",
    intent: "night_out",
    defaultView: "explore",
    preferredBundleId: "dinner-rooftop",
  },
  {
    id: "business_traveler",
    label: "Business Traveler",
    sublabel: "Keep it efficient with high-reliability options.",
    intent: "business",
    defaultView: "operate",
    preferredBundleId: "business-express",
  },
  {
    id: "weekend_couple",
    label: "Weekend Couple",
    sublabel: "Prioritize atmosphere, dining, and standout moments.",
    intent: "romance",
    defaultView: "property",
    preferredBundleId: "date-night",
  },
  {
    id: "wellness_guest",
    label: "Wellness Stay",
    sublabel: "Blend spa, movement, and low-friction evening options.",
    intent: "wellness",
    defaultView: "property",
    preferredBundleId: "reset-wellness",
  },
  {
    id: "club_member",
    label: "FORTH Club Member",
    sublabel: "Lean into member perks, guest policy, and club etiquette.",
    intent: "night_out",
    defaultView: "property",
    preferredBundleId: "dinner-rooftop",
  },
];

const EXPERIENCE_VIEW_OPTIONS: Array<{
  id: ExperienceView;
  label: string;
  hint: string;
}> = [
  {
    id: "operate",
    label: "Concierge",
    hint: "Best when you want immediate recommendations and next actions.",
  },
  {
    id: "property",
    label: "At FORTH",
    hint: "Best when you want to stay anchored to property venues and amenities.",
  },
  {
    id: "explore",
    label: "Around Atlanta",
    hint: "Best when you want walkable routes and city-led exploration.",
  },
];

const DISCOVERY_FOCUS_OPTIONS: DiscoveryFocus[] = [
  {
    id: "any",
    label: "Surprise Me",
    hint: "A broad mix of tonight's strongest event and venue picks.",
    eventKeywords: [],
    venueTypes: [],
    searchQuery: "",
  },
  {
    id: "live_music",
    label: "Live Music",
    hint: "Bands, DJs, and music-forward rooms with strong evening energy.",
    eventKeywords: ["live music", "music", "concert", "band", "dj", "jazz", "showcase", "open mic"],
    venueTypes: ["bar", "rooftop", "brewery", "nightclub"],
    searchQuery: "live music",
  },
  {
    id: "comedy",
    label: "Comedy",
    hint: "Stand-up, improv, and lighter-night options.",
    eventKeywords: ["comedy", "stand-up", "standup", "improv", "laugh"],
    venueTypes: ["bar", "restaurant", "theater"],
    searchQuery: "comedy",
  },
  {
    id: "sports",
    label: "Sports",
    hint: "Watch parties and game-night destinations with easy routing.",
    eventKeywords: ["sports", "game", "match", "watch party", "soccer", "football", "basketball", "baseball", "hockey"],
    venueTypes: ["sports_bar", "bar", "brewery"],
    searchQuery: "sports",
  },
  {
    id: "arts",
    label: "Arts + Culture",
    hint: "Exhibitions, film, theater, and culture-led evening experiences.",
    eventKeywords: ["exhibition", "museum", "gallery", "film", "cinema", "theatre", "theater", "orchestra", "arts"],
    venueTypes: ["gallery", "museum", "theater"],
    searchQuery: "arts",
  },
];

const FOOD_DRINK_FOCUS_OPTIONS: FoodDrinkFocus[] = [
  {
    id: "any",
    label: "Surprise Me",
    hint: "A balanced mix of bars, restaurants, and easy nearby stops.",
    venueTypes: [],
    keywords: [],
    searchQuery: "",
  },
  {
    id: "cocktails",
    label: "Great Cocktails",
    hint: "Cocktail bars and rooftops with strong drink programs.",
    venueTypes: ["bar", "rooftop", "distillery", "nightclub"],
    keywords: ["cocktail", "martini", "speakeasy", "mixology", "aperitivo"],
    searchQuery: "cocktail bar",
  },
  {
    id: "sports_bar",
    label: "Sports Bar",
    hint: "Game-forward spots for watch parties and energetic nights.",
    venueTypes: ["sports_bar", "bar", "brewery"],
    keywords: ["sports bar", "watch party", "game day", "sports"],
    searchQuery: "sports bar",
  },
  {
    id: "mexican",
    label: "Mexican Food",
    hint: "Tacos, mezcal, and Mexican dining picks nearby.",
    venueTypes: ["restaurant", "food_hall", "bar"],
    keywords: ["mexican", "taqueria", "taco", "mezcal", "cantina"],
    searchQuery: "mexican food",
  },
  {
    id: "coffee",
    label: "Coffee + Casual",
    hint: "Coffee-led and casual options for lower-key plans.",
    venueTypes: ["coffee_shop", "restaurant", "food_hall"],
    keywords: ["coffee", "cafe", "espresso", "bakery", "brunch"],
    searchQuery: "coffee",
  },
  {
    id: "rooftop",
    label: "Rooftop",
    hint: "Skyline settings for drinks, dinner, and night views.",
    venueTypes: ["rooftop", "bar", "restaurant"],
    keywords: ["rooftop", "terrace", "skyline", "patio"],
    searchQuery: "rooftop",
  },
];

const CURATOR_MODES: CuratorMode[] = [
  {
    id: "safe",
    label: "Safe",
    hint: "Closest timing and highest-confidence picks for low-friction execution.",
  },
  {
    id: "elevated",
    label: "Elevated",
    hint: "Signature rooms and polished moments with premium atmosphere.",
  },
  {
    id: "adventurous",
    label: "Adventurous",
    hint: "Bolder jumps, farther stops, and high-energy options.",
  },
];

const PLAN_AHEAD_CATEGORY_OPTIONS: Array<{ id: PlanAheadCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "food", label: "Food" },
  { id: "entertainment", label: "Entertainment" },
  { id: "destinations", label: "Destinations" },
];

const CONCIERGE_DAYPART_OPTIONS: Array<{ id: ConciergeDaypart; label: string }> = [
  { id: "all", label: "Any Time" },
  { id: "morning", label: "Morning" },
  { id: "day", label: "Day" },
  { id: "evening", label: "Evening" },
  { id: "late_night", label: "Late Night" },
];

const DISCOVERY_FOCUS_VISUAL_ORDER: DiscoveryFocusId[] = [
  "any",
  "live_music",
  "comedy",
  "sports",
  "arts",
];

const FOOD_DRINK_FOCUS_VISUAL_ORDER: FoodDrinkFocusId[] = [
  "any",
  "cocktails",
  "sports_bar",
  "mexican",
  "coffee",
  "rooftop",
];

const DESTINATION_VIBE_VISUAL_ORDER: DestinationVibeId[] = [
  "any",
  "walkable",
  "beltline",
  "culture",
];

const DISCOVERY_FOCUS_VISUALS: Record<DiscoveryFocusId, { eyebrow: string; sources: string[] }> = {
  any: {
    eyebrow: "Concierge Mix",
    sources: [
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b2?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  live_music: {
    eyebrow: "Live",
    sources: [
      "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  comedy: {
    eyebrow: "Comedy",
    sources: [
      "https://images.unsplash.com/photo-1527224538127-2104bb71c51b?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  sports: {
    eyebrow: "Game Night",
    sources: [
      "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  arts: {
    eyebrow: "Arts",
    sources: [
      "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&w=1800&q=80",
    ],
  },
};

const FOOD_DRINK_FOCUS_VISUALS: Record<FoodDrinkFocusId, { eyebrow: string; sources: string[] }> = {
  any: {
    eyebrow: "Mixed Picks",
    sources: [
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  cocktails: {
    eyebrow: "Cocktails",
    sources: [
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1514361892635-a72a2472a7ee?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  sports_bar: {
    eyebrow: "Sports Bar",
    sources: [
      "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  mexican: {
    eyebrow: "Mexican",
    sources: [
      "https://images.unsplash.com/photo-1615870216519-2f9fa575fa5c?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  coffee: {
    eyebrow: "Coffee + Casual",
    sources: [
      "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  rooftop: {
    eyebrow: "Rooftop",
    sources: [
      "https://images.unsplash.com/photo-1470123808288-1e59739d9351?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=1800&q=80",
    ],
  },
};

const DESTINATION_VIBE_OPTIONS: DestinationVibe[] = [
  {
    id: "any",
    label: "Surprise Me",
    hint: "Mix the strongest nearby picks across neighborhoods and vibes.",
    searchQuery: "best nearby",
    eyebrow: "Concierge Mix",
    sources: [
      "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  {
    id: "walkable",
    label: "Walkable",
    hint: "Closest options that keep travel friction low.",
    searchQuery: "walkable",
    eyebrow: "Near FORTH",
    sources: [
      "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  {
    id: "beltline",
    label: "BeltLine",
    hint: "Route-forward picks around Eastside Trail energy.",
    searchQuery: "beltline",
    eyebrow: "Route Layer",
    sources: [
      "https://images.unsplash.com/photo-1519178614-68673b201f36?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1800&q=80",
    ],
  },
  {
    id: "culture",
    label: "Culture + Parks",
    hint: "Museums, galleries, markets, and day-friendly destination anchors.",
    searchQuery: "museum park market",
    eyebrow: "Day Discoveries",
    sources: [
      "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1800&q=80",
      "https://images.unsplash.com/photo-1463736932348-4915535cf6f9?auto=format&fit=crop&w=1800&q=80",
    ],
  },
];

type ConciergeBundle = {
  id: string;
  label: string;
  intent: GuestIntent;
  description: string;
  steps: Array<{
    kind: "event" | "destination";
    venueTypes?: string[];
  }>;
};

const COMMAND_BUNDLES: ConciergeBundle[] = [
  {
    id: "dinner-rooftop",
    label: "Dinner + Rooftop",
    intent: "night_out",
    description: "Start with dinner and finish with skyline drinks.",
    steps: [
      { kind: "destination", venueTypes: ["restaurant", "food_hall"] },
      { kind: "destination", venueTypes: ["rooftop", "bar"] },
      { kind: "event" },
    ],
  },
  {
    id: "date-night",
    label: "Date Night",
    intent: "romance",
    description: "Romantic dinner, skyline drinks, and one memorable event.",
    steps: [
      { kind: "destination", venueTypes: ["restaurant"] },
      { kind: "destination", venueTypes: ["rooftop", "bar"] },
      { kind: "event" },
    ],
  },
  {
    id: "business-express",
    label: "Business Evening",
    intent: "business",
    description: "Keep timing tight with reliable service windows.",
    steps: [
      { kind: "event" },
      { kind: "destination", venueTypes: ["restaurant", "coffee_shop"] },
      { kind: "destination", venueTypes: ["bar", "rooftop"] },
    ],
  },
  {
    id: "reset-wellness",
    label: "Reset + Wellness",
    intent: "wellness",
    description: "Balance recovery-first options with easy social moments.",
    steps: [
      { kind: "destination", venueTypes: ["spa", "fitness_center", "park"] },
      { kind: "destination", venueTypes: ["coffee_shop", "restaurant"] },
      { kind: "event" },
    ],
  },
];

type InRoomRequest = {
  id: string;
  title: string;
  detail: string;
  etaLabel: string;
  ctaLabel: string;
};

const IN_ROOM_REQUESTS: InRoomRequest[] = [
  {
    id: "spa-reset",
    title: "Spa Reset (75 min)",
    detail: "Thermal circuit plus recovery treatment designed for arrival-day decompression.",
    etaLabel: "Earliest same-day",
    ctaLabel: "Request treatment",
  },
  {
    id: "dining-hold",
    title: "Priority Dinner Hold",
    detail: "Priority table hold at signature venues based on your selected preferences.",
    etaLabel: "2-5 min setup",
    ctaLabel: "Place hold",
  },
  {
    id: "house-car",
    title: "House Car Routing",
    detail: "Door-to-door transfer for key city stops when timing matters most.",
    etaLabel: "Dispatch window 10-20 min",
    ctaLabel: "Request car",
  },
  {
    id: "late-checkout",
    title: "Late Checkout",
    detail: "Extend departure based on occupancy and active itinerary.",
    etaLabel: "Response within minutes",
    ctaLabel: "Check availability",
  },
];

type PlanCandidate = {
  id: string;
  title: string;
  subtitle: string;
  kind: "event" | "destination";
  venueType?: string | null;
  href: string;
  etaMinutes: number;
  confidence?: "high" | "medium" | "low" | null;
  proximityTier?: Destination["proximity_tier"] | null;
  isSignature?: boolean;
  isFromLive?: boolean;
};

type ConciergeStateSnapshot = {
  visitorPersona?: VisitorPersona;
  experienceView?: ExperienceView;
  discoveryMode?: DiscoveryMode;
  daypart?: ConciergeDaypart;
  futureDate?: string | null;
  planAheadCategory?: PlanAheadCategory;
  guestIntent?: GuestIntent;
  discoveryFocusId?: DiscoveryFocusId;
  foodDrinkFocusId?: FoodDrinkFocusId;
  destinationVibeId?: DestinationVibeId;
  curatorModeId?: CuratorModeId;
  requestedServiceIds?: string[];
  selectedPlanIds?: string[];
  requestTicketsByService?: Record<string, string>;
  activeBundleId?: string | null;
  isBriefMode?: boolean;
  showDetailedPlan?: boolean;
};

type EditorialMoment = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge: string;
  imageSrc: string;
};

type PreviewItem = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  href: string;
  imageSources: Array<string | null | undefined>;
};

type DecisionAction = {
  label: string;
  href: string;
  note: string;
};

type LiveSuggestion = {
  id: string;
  label: string;
  note: string;
  href: string;
  cta: string;
};

const DINE_TYPES = new Set(["restaurant", "food_hall"]);
const DRINK_TYPES = new Set(["bar", "brewery", "rooftop", "sports_bar", "distillery", "nightclub"]);
const ENTERTAINMENT_TYPES = new Set(["bar", "rooftop", "sports_bar", "nightclub", "brewery", "distillery", "theater", "museum", "gallery"]);
const HOTEL_AMENITY_TYPES = new Set(["hotel", "spa", "fitness_center", "restaurant", "bar", "rooftop"]);
const FOOD_EVENT_HINTS = ["dinner", "brunch", "lunch", "tasting", "wine", "cocktail", "chef", "happy hour", "menu", "food"];

const BELTLINE_NEIGHBORHOODS = new Set([
  "old fourth ward",
  "inman park",
  "poncey-highland",
  "reynoldstown",
  "cabbagetown",
]);

const BELTLINE_NAME_HINTS = ["beltline", "ponce city market", "krog", "historic fourth ward park", "eastside trail"];

type SignatureVenuePreset = {
  id: string;
  name: string;
  typeLabel: string;
  kind: "restaurant" | "bar";
  keywords: string[];
  spotlight: string;
  mockSpecial: string;
  mockNote: string;
  photoUrl: string;
};

const FORTH_SIGNATURE_VENUES: SignatureVenuePreset[] = [
  {
    id: "il-premio",
    name: "Il Premio",
    typeLabel: "Steakhouse",
    kind: "restaurant",
    keywords: ["il premio"],
    spotlight: "Signature dinner room with prime cuts and Italian influence.",
    mockSpecial: "Sommelier Pairing Menu",
    mockNote: "Pitch mock - four-course pairing from $95",
    photoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "elektra",
    name: "Elektra",
    typeLabel: "Pool Restaurant",
    kind: "restaurant",
    keywords: ["elektra"],
    spotlight: "Poolside Mediterranean with daytime-to-sunset transitions.",
    mockSpecial: "Poolside Lunch Prix Fixe",
    mockNote: "Pitch mock - weekdays until 3pm",
    photoUrl: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "bar-premio",
    name: "Bar Premio",
    typeLabel: "Cocktail Bar",
    kind: "bar",
    keywords: ["bar premio", "premio"],
    spotlight: "Pre-dinner cocktails anchored around classic Italian aperitivo.",
    mockSpecial: "Aperitivo Hour",
    mockNote: "Pitch mock - 5pm to 7pm",
    photoUrl: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "moonlight",
    name: "Moonlight at FORTH",
    typeLabel: "Rooftop Bar",
    kind: "bar",
    keywords: ["moonlight"],
    spotlight: "Rooftop views and late-night cocktail programming.",
    mockSpecial: "Sunset Martini Service",
    mockNote: "Pitch mock - daily from 6pm",
    photoUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b2?auto=format&fit=crop&w=1600&q=80",
  },
];

type ForthAmenity = {
  id: string;
  name: string;
  keywords: string[];
  serviceWindow: string;
  detail: string;
  mockNote: string;
  photoUrl: string;
};

const FORTH_AMENITIES: ForthAmenity[] = [
  {
    id: "spa",
    name: "FORTH Spa",
    keywords: ["spa", "forth spa"],
    serviceWindow: "Daily care",
    detail: "Treatment suites, hydrotherapy, private booking support.",
    mockNote: "Sample offering: signature reset ritual and recovery circuit.",
    photoUrl: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "fitness",
    name: "Fitness Club",
    keywords: ["fitness", "gym", "athletic", "club"],
    serviceWindow: "Open 24/7",
    detail: "24/7 training floor with guest access and class blocks.",
    mockNote: "Sample offering: class reservations by time of day.",
    photoUrl: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "pool",
    name: "Pool Deck",
    keywords: ["pool", "elektra"],
    serviceWindow: "Daylight to sunset",
    detail: "Resort-style loungers, service programming, and private cabana options.",
    mockNote: "Sample offering: poolside service windows and cabana options.",
    photoUrl: "https://images.unsplash.com/photo-1576013551627-0b0f2ecb12e1?auto=format&fit=crop&w=1600&q=80",
  },
  {
    id: "concierge",
    name: "Concierge Desk",
    keywords: ["concierge", "lobby"],
    serviceWindow: "Always on",
    detail: "Dining priority holds, route planning, and in-room recommendations.",
    mockNote: "Sample offering: white-glove recommendations tied to live availability.",
    photoUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80",
  },
];

const FORTH_IMAGE_FALLBACKS = [
  "https://forthatlanta.com/hubfs/Forth/Website/Images/Club/hero-banner-club-faq-desktop.jpg",
  "https://forthatlanta.com/hs-fs/hubfs/HOLD-FOR-PRESS-Method_Forth_Lobby_1815-2.jpg?width=1338&height=1700&name=HOLD-FOR-PRESS-Method_Forth_Lobby_1815-2.jpg",
  "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=2200&q=80",
];

const HERO_PHOTOS_BY_DAYPART: Record<DayPart, string> = {
  morning: "https://images.unsplash.com/photo-1444201983204-c43cbd584d93?auto=format&fit=crop&w=2200&q=80",
  afternoon: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2200&q=80",
  evening: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=2200&q=80",
  late_night: "https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=2200&q=80",
};

const FORTH_PANEL_CLASS = "rounded-[1.4rem] border border-[var(--hotel-sand)] bg-[linear-gradient(180deg,rgba(255,254,252,0.96)_0%,rgba(249,246,241,0.98)_100%)] shadow-[var(--hotel-shadow-medium)]";
const FORTH_PANEL_SOFT_CLASS = "rounded-[1.4rem] border border-[var(--hotel-sand)] bg-[linear-gradient(180deg,rgba(255,254,252,0.9)_0%,rgba(249,246,241,0.94)_100%)] shadow-[var(--hotel-shadow-soft)]";

function getDayPart(now: Date): DayPart {
  const hour = now.getHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 23) return "evening";
  return "late_night";
}

function getDayPartCopy(dayPart: DayPart): { title: string; subtitle: string } {
  if (dayPart === "morning") {
    return {
      title: "Good Morning",
      subtitle: "Start your stay with the best coffee, brunch, and nearby options around FORTH.",
    };
  }
  if (dayPart === "afternoon") {
    return {
      title: "Your Afternoon Plan",
      subtitle: "Happy hour, dinner, and tonight's standout events, arranged for easy decisions.",
    };
  }
  if (dayPart === "evening") {
    return {
      title: "Tonight at FORTH",
      subtitle: "Live specials, top events, and walkable picks for a great evening.",
    };
  }
  return {
    title: "Late Night",
    subtitle: "Best nightcap options now plus strong picks for tomorrow morning.",
  };
}

function parseHourFromEventTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const [hours] = value.split(":");
  const parsed = Number.parseInt(hours, 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 23) return null;
  return parsed;
}

function daypartFromHour(hour: number): ConciergeDaypart {
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 23) return "evening";
  return "late_night";
}

function matchesEventDaypart(event: FeedSection["events"][number], daypart: ConciergeDaypart): boolean {
  if (daypart === "all") return true;
  const hour = parseHourFromEventTime(event.start_time);
  if (hour === null) return true;
  return daypartFromHour(hour) === daypart;
}

function matchesDestinationDaypart(destination: Destination, daypart: ConciergeDaypart): boolean {
  if (daypart === "all") return true;

  const venueType = normalizeToken(destination.venue.venue_type);
  const searchBlob = [
    normalizeToken(destination.venue.name),
    normalizeToken(destination.venue.short_description),
    normalizeToken(destination.top_special?.title),
  ].join(" ");

  if (daypart === "morning") {
    return venueType === "coffee_shop" || searchBlob.includes("coffee") || searchBlob.includes("brunch") || searchBlob.includes("breakfast");
  }
  if (daypart === "day") {
    return ["restaurant", "food_hall", "museum", "gallery", "park", "coffee_shop"].includes(venueType) || searchBlob.includes("market");
  }
  if (daypart === "evening") {
    return ["restaurant", "bar", "rooftop", "theater", "nightclub"].includes(venueType) || searchBlob.includes("dinner");
  }
  return ["bar", "rooftop", "nightclub", "sports_bar", "brewery", "distillery"].includes(venueType) || searchBlob.includes("late");
}

function formatConciergeDaypart(daypart: ConciergeDaypart): string {
  if (daypart === "all") return "Any Time";
  if (daypart === "late_night") return "Late Night";
  return daypart.charAt(0).toUpperCase() + daypart.slice(1);
}

function buildImageCandidates(sources: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const source of sources) {
    if (!source) continue;
    const normalized = source.trim();
    if (!normalized) continue;
    const proxied = getProxiedImageSrc(normalized);
    if (typeof proxied !== "string") continue;
    if (seen.has(proxied)) continue;
    seen.add(proxied);
    candidates.push(proxied);
  }
  return candidates;
}

function formatMinutes(value: number | null): string {
  if (value === null || value === undefined) return "Now";
  if (value < 1) return "Now";
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getConfidenceTone(confidence: "high" | "medium" | "low" | null): string {
  if (confidence === "high") return "text-emerald-700 bg-emerald-100 border-emerald-200";
  if (confidence === "medium") return "text-amber-700 bg-amber-100 border-amber-200";
  return "text-stone-700 bg-stone-100 border-stone-200";
}

function getCategory(venueType: string | null): "dine" | "drink" | "explore" {
  if (!venueType) return "explore";
  if (DINE_TYPES.has(venueType)) return "dine";
  if (DRINK_TYPES.has(venueType)) return "drink";
  return "explore";
}

function isLikelyHotelAmenity(destination: Destination, portalName: string): boolean {
  const tokens = portalName
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length >= 4);

  const nameLower = destination.venue.name.toLowerCase();
  const tokenMatch = tokens.some((token) => nameLower.includes(token));
  const veryClose = destination.distance_km <= 0.35;
  const typeMatch = destination.venue.venue_type ? HOTEL_AMENITY_TYPES.has(destination.venue.venue_type) : false;

  return tokenMatch || (veryClose && typeMatch);
}

function isBeltlineDestination(destination: Destination): boolean {
  const neighborhood = (destination.venue.neighborhood || "").toLowerCase();
  const name = destination.venue.name.toLowerCase();

  if (BELTLINE_NEIGHBORHOODS.has(neighborhood)) return true;
  return BELTLINE_NAME_HINTS.some((hint) => name.includes(hint));
}

function isCultureDestination(destination: Destination): boolean {
  const venueType = normalizeToken(destination.venue.venue_type);
  if (["museum", "gallery", "park", "market", "food_hall"].includes(venueType)) return true;
  const searchBlob = [
    normalizeToken(destination.venue.name),
    normalizeToken(destination.venue.short_description),
    normalizeToken(destination.top_special?.title),
  ].join(" ");
  return ["museum", "gallery", "park", "market", "garden", "exhibit"].some((hint) => searchBlob.includes(hint));
}

function matchesDestinationVibe(destination: Destination, vibeId: DestinationVibeId): boolean {
  if (vibeId === "any") return true;
  if (vibeId === "walkable") return destination.proximity_tier === "walkable";
  if (vibeId === "beltline") return isBeltlineDestination(destination);
  return isCultureDestination(destination);
}

function findDestinationByKeywords(destinations: Destination[], keywords: string[]): Destination | null {
  for (const destination of destinations) {
    const name = destination.venue.name.toLowerCase();
    if (keywords.some((keyword) => name.includes(keyword))) {
      return destination;
    }
  }
  return null;
}

function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function getIntentTypeWeight(intent: GuestIntent, venueType: string | null): number {
  if (!venueType) return 0;

  const table: Record<GuestIntent, Record<string, number>> = {
    business: {
      restaurant: 18,
      food_hall: 14,
      coffee_shop: 16,
      bar: 8,
      rooftop: 8,
      fitness_center: 10,
      nightclub: -10,
    },
    romance: {
      restaurant: 18,
      rooftop: 18,
      bar: 16,
      art: 10,
      gallery: 10,
      nightclub: 4,
      sports_bar: -8,
    },
    night_out: {
      bar: 22,
      rooftop: 20,
      nightclub: 22,
      brewery: 16,
      sports_bar: 14,
      distillery: 14,
      restaurant: 6,
    },
    wellness: {
      spa: 24,
      fitness_center: 24,
      yoga: 20,
      park: 14,
      coffee_shop: 10,
      restaurant: 8,
      bar: -6,
      nightclub: -14,
    },
  };

  return table[intent][venueType] ?? 0;
}

function rankDestinationsForIntent(destinations: Destination[], intent: GuestIntent): Destination[] {
  return [...destinations]
    .map((destination, index) => {
      let score = 0;
      if (destination.special_state === "active_now") score += 40;
      if (destination.special_state === "starting_soon") score += 22;
      if (destination.proximity_tier === "walkable") score += 18;
      if (destination.proximity_tier === "close") score += 10;
      score += getIntentTypeWeight(intent, destination.venue.venue_type);
      if (destination.top_special?.confidence === "high") score += 12;
      if (destination.top_special?.confidence === "medium") score += 6;

      return { destination, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.destination);
}

function formatClockTime(value: Date): string {
  const hours = value.getHours();
  const minutes = value.getMinutes();
  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? "PM" : "AM";
  const minuteLabel = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${h12}:${minuteLabel} ${ampm}`;
}

function phoneHref(value: string): string {
  const digits = value.replace(/[^0-9+]/g, "");
  return digits ? `tel:${digits}` : "tel:+14045550144";
}

function mapsSearchHref(label: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
}

function resolveEventHref(
  portalSlug: string,
  event: { id?: string | null; title: string; venue_name?: string | null }
): string {
  const id = typeof event.id === "string" ? event.id.trim() : "";
  if (id) return `/${portalSlug}/events/${id}`;
  const fallbackQuery = event.venue_name || event.title;
  return `/${portalSlug}?view=find&type=events&search=${encodeURIComponent(fallbackQuery)}`;
}

function resolveDestinationHref(
  portalSlug: string,
  destination: { venue: { slug?: string | null; name: string } }
): string {
  const slug = typeof destination.venue.slug === "string" ? destination.venue.slug.trim() : "";
  if (slug) return `/${portalSlug}?spot=${slug}`;
  return `/${portalSlug}?view=find&type=destinations&search=${encodeURIComponent(destination.venue.name)}`;
}

function toLocalDateStamp(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateChip(value: string): string {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function hoursSinceTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.round((Date.now() - parsed) / (1000 * 60 * 60)));
}

function isVerifiedWithinHours(value: string | null | undefined, hourWindow: number): boolean {
  const hours = hoursSinceTimestamp(value);
  return hours !== null && hours <= hourWindow;
}

function normalizeToken(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

function hasKeywordMatch(value: string | null | undefined, keywords: string[]): boolean {
  const normalized = normalizeToken(value);
  if (!normalized) return false;
  return keywords.some((keyword) => normalized.includes(keyword));
}

function matchesEventFocus(event: FeedSection["events"][number], focus: DiscoveryFocus): boolean {
  if (focus.id === "any") return true;

  const searchable = [
    event.title,
    event.description || null,
    event.venue_name || null,
    event.category || null,
    event.subcategory || null,
  ];

  return searchable.some((value) => hasKeywordMatch(value, focus.eventKeywords));
}

function matchesDestinationFocus(destination: Destination, focus: DiscoveryFocus): boolean {
  if (focus.id === "any") return true;

  const venueType = normalizeToken(destination.venue.venue_type);
  if (venueType && focus.venueTypes.includes(venueType)) {
    return true;
  }

  const searchable = [
    destination.venue.name,
    destination.venue.short_description,
    destination.top_special?.title || null,
    destination.next_event?.title || null,
  ];

  return searchable.some((value) => hasKeywordMatch(value, focus.eventKeywords));
}

function matchesFoodDrinkFocus(destination: Destination, focus: FoodDrinkFocus): boolean {
  if (focus.id === "any") return true;

  const venueType = normalizeToken(destination.venue.venue_type);
  if (venueType && focus.venueTypes.includes(venueType)) {
    return true;
  }

  const searchable = [
    destination.venue.name,
    destination.venue.short_description,
    destination.top_special?.title || null,
    destination.top_special?.type || null,
    destination.next_event?.title || null,
  ];

  return searchable.some((value) => hasKeywordMatch(value, focus.keywords));
}

function isHappyHourCandidate(destination: Destination): boolean {
  const searchable = [
    destination.top_special?.title || null,
    destination.top_special?.type || null,
    destination.top_special?.price_note || null,
    destination.venue.short_description,
  ];
  return searchable.some((value) => hasKeywordMatch(value, ["happy hour", "aperitivo", "sunset sip"]));
}

function isOpenLateCandidate(destination: Destination): boolean {
  const venueType = normalizeToken(destination.venue.venue_type);
  if (["bar", "rooftop", "nightclub", "sports_bar", "brewery", "distillery"].includes(venueType)) {
    return true;
  }

  const searchable = [
    destination.venue.name,
    destination.venue.short_description,
    destination.top_special?.title || null,
    destination.top_special?.type || null,
    destination.top_special?.price_note || null,
  ];

  return searchable.some((value) => hasKeywordMatch(value, ["late", "after 9", "after 10", "late night", "night owl"]));
}

function parseDateAtNoon(value: string): Date | null {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function matchesPlanAheadCategoryForEvent(
  event: FeedSection["events"][number],
  category: PlanAheadCategory
): boolean {
  if (category === "all") return true;

  const searchable = [
    normalizeToken(event.title),
    normalizeToken(event.description),
    normalizeToken(event.venue_name),
    normalizeToken(event.category),
    normalizeToken(event.subcategory),
  ].join(" ");

  const isFood = FOOD_EVENT_HINTS.some((keyword) => searchable.includes(keyword));
  if (category === "food") return isFood;
  if (category === "entertainment") return !isFood;
  if (category === "destinations") return false;
  return true;
}

function matchesPlanAheadCategoryForDestination(destination: Destination, category: PlanAheadCategory): boolean {
  if (category === "all") return true;

  const venueType = normalizeToken(destination.venue.venue_type);
  const isFoodOrDrink = DINE_TYPES.has(venueType) || DRINK_TYPES.has(venueType);

  if (category === "food") return isFoodOrDrink;
  if (category === "entertainment") return ENTERTAINMENT_TYPES.has(venueType);
  if (category === "destinations") return !isFoodOrDrink;
  return true;
}

function confidenceScore(confidence: "high" | "medium" | "low" | null | undefined): number {
  if (confidence === "high") return 22;
  if (confidence === "medium") return 10;
  if (confidence === "low") return 3;
  return 0;
}

function rankPlanCandidatesForMode(candidates: PlanCandidate[], mode: CuratorModeId): PlanCandidate[] {
  return [...candidates]
    .map((candidate, index) => {
      let score = 0;

      if (mode === "safe") {
        score += confidenceScore(candidate.confidence);
        if (candidate.proximityTier === "walkable") score += 15;
        if (candidate.proximityTier === "close") score += 7;
        if (candidate.isFromLive) score += 10;
        if (candidate.kind === "event") score += 5;
        score -= candidate.etaMinutes * 0.12;
      } else if (mode === "elevated") {
        if (candidate.isSignature) score += 28;
        if (candidate.kind === "event") score += 8;
        if (candidate.venueType && ["restaurant", "rooftop", "bar"].includes(candidate.venueType)) score += 12;
        score += confidenceScore(candidate.confidence) * 0.6;
        score -= Math.abs(120 - candidate.etaMinutes) * 0.05;
      } else {
        if (candidate.kind === "event") score += 9;
        if (candidate.proximityTier === "destination") score += 18;
        if (candidate.proximityTier === "close") score += 8;
        if (candidate.venueType && ["nightclub", "sports_bar", "brewery", "distillery"].includes(candidate.venueType)) score += 14;
        if (candidate.etaMinutes >= 60) score += 8;
        score += candidate.confidence === "low" ? 4 : candidate.confidence === "medium" ? 2 : 0;
      }

      return { candidate, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.candidate);
}

interface ForthConciergeExperienceProps {
  portal: Portal;
  mode?: "default" | "stay";
  routeIntent?: "tonight" | "plan" | "dining" | "club";
}

export default function ForthConciergeExperience({
  portal,
  mode = "default",
  routeIntent = "tonight",
}: ForthConciergeExperienceProps) {
  const { profile } = useAuth();
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [liveDestinations, setLiveDestinations] = useState<Destination[]>([]);
  const [visitorPersona, setVisitorPersona] = useState<VisitorPersona>(
    routeIntent === "club" ? "club_member" : "first_time"
  );
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>(
    routeIntent === "plan" ? "future" : "tonight"
  );
  const [selectedDaypart, setSelectedDaypart] = useState<ConciergeDaypart>("all");
  const [futureDate, setFutureDate] = useState<string | null>(null);
  const [planAheadCategory, setPlanAheadCategory] = useState<PlanAheadCategory>("all");
  const [guestIntent, setGuestIntent] = useState<GuestIntent>("night_out");
  const [discoveryFocusId, setDiscoveryFocusId] = useState<DiscoveryFocusId>("any");
  const [foodDrinkFocusId, setFoodDrinkFocusId] = useState<FoodDrinkFocusId>(
    routeIntent === "dining" ? "cocktails" : "any"
  );
  const [destinationVibeId, setDestinationVibeId] = useState<DestinationVibeId>("any");
  const [curatorModeId, setCuratorModeId] = useState<CuratorModeId>("safe");
  const [requestedServiceIds, setRequestedServiceIds] = useState<string[]>([]);
  const [requestTicketsByService, setRequestTicketsByService] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submittingRequestId, setSubmittingRequestId] = useState<string | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [planInitialized, setPlanInitialized] = useState(false);
  const [experienceView, setExperienceView] = useState<ExperienceView>(
    routeIntent === "club" ? "explore" : "operate"
  );
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null);
  const [isBriefMode, setIsBriefMode] = useState(false);
  const [showDetailedPlan, setShowDetailedPlan] = useState(false);
  const [showStudioPanel, setShowStudioPanel] = useState(false);
  const [showExtendedExplore, setShowExtendedExplore] = useState(routeIntent === "club");
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [agentNarrative, setAgentNarrative] = useState<AgentNarrative | null>(null);
  const [agentJourney, setAgentJourney] = useState<AgentJourney | null>(null);
  const [loading, setLoading] = useState(true);

  const logoUrl = portal.branding?.logo_url as string | null | undefined;
  const searchParams = useSearchParams();
  const conciergePhoneDisplay = typeof portal.settings?.concierge_phone === "string"
    ? portal.settings.concierge_phone
    : "+1 (404) 555-0144";
  const conciergePhoneLink = phoneHref(conciergePhoneDisplay);
  const knownServiceIds = useMemo(() => IN_ROOM_REQUESTS.map((request) => request.id), []);
  const showStudioControls = profile?.is_admin === true && searchParams.get("studio") === "1";
  const isStayMode = mode === "stay";
  const isPlanRoute = routeIntent === "plan";
  const isDiningRoute = routeIntent === "dining";
  const isClubRoute = routeIntent === "club";

  useEffect(() => {
    const body = document.body;
    body.dataset.forthExperience = "true";
    return () => {
      delete body.dataset.forthExperience;
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const search = new URLSearchParams();
        const center = portal.filters?.geo_center;

        if (center?.[0] !== undefined && center?.[1] !== undefined) {
          search.set("lat", String(center[0]));
          search.set("lng", String(center[1]));
        }
        if (portal.filters?.geo_radius_km) {
          search.set("radius_km", String(portal.filters.geo_radius_km));
        }

        const baseQuery = search.toString();
        const allQuery = baseQuery ? `${baseQuery}&include_upcoming_hours=5&limit=120` : "include_upcoming_hours=5&limit=120";
        const activeQuery = baseQuery ? `${baseQuery}&active_now=true&limit=36` : "active_now=true&limit=36";
        const orchestrationQuery = baseQuery
          ? `${baseQuery}&include_upcoming_hours=5&limit=120&live_limit=36`
          : "include_upcoming_hours=5&limit=120&live_limit=36";

        let feedData: { sections?: Array<{ title?: string; slug?: string; description?: string; events?: Array<Record<string, unknown>> }> } = {};
        let allDestData: { destinations?: Destination[]; meta?: SpecialsMeta | null } = {};
        let liveDestData: { destinations?: Destination[] } = {};
        let orchestrated = false;

        try {
          const orchestratedRes = await fetch(`/api/portals/${portal.slug}/concierge/orchestrated?${orchestrationQuery}`);
          if (orchestratedRes.ok) {
            const orchestratedData = await orchestratedRes.json() as OrchestratedConciergeResponse;
            feedData = { sections: orchestratedData.data?.sections };
            allDestData = {
              destinations: orchestratedData.data?.destinations,
              meta: orchestratedData.data?.meta || null,
            };
            liveDestData = { destinations: orchestratedData.data?.live_destinations };
            orchestrated = true;
            const journey = orchestratedData.agent_outputs?.ux_architecture;
            const journeySteps = Array.isArray(journey?.flow_steps)
              ? journey.flow_steps
                .filter((step): step is { title?: string; detail?: string } => Boolean(step))
                .map((step) => ({
                  title: String(step.title || "").trim(),
                  detail: String(step.detail || "").trim(),
                }))
                .filter((step) => step.title.length > 0 && step.detail.length > 0)
                .slice(0, 3)
              : [];
            if (journey?.flow_title && journey?.primary_action && journeySteps.length > 0) {
              setAgentJourney({
                title: journey.flow_title,
                steps: journeySteps,
                primaryAction: journey.primary_action,
              });
            } else {
              setAgentJourney(null);
            }

            const narrative = orchestratedData.agent_outputs?.voice_narrative;
            if (narrative?.hero_title && narrative.hero_subtitle && narrative.briefing_title && narrative.summary) {
              setAgentNarrative({
                heroTitle: narrative.hero_title,
                heroSubtitle: narrative.hero_subtitle,
                briefingTitle: narrative.briefing_title,
                summary: narrative.summary,
              });
            } else {
              setAgentNarrative(null);
            }

            if (typeof window !== "undefined") {
              const params = new URLSearchParams(window.location.search);
              const hasExplicitSessionParams = [
                "guest_persona",
                "concierge_intent",
                "concierge_view",
                "concierge_focus",
                "concierge_food_focus",
                "concierge_destination_vibe",
                "concierge_mode",
              ].some((key) => params.has(key));
              const hasSavedSnapshot = Boolean(window.localStorage.getItem(`forth-concierge:${portal.slug}`));
              if (!hasExplicitSessionParams && !hasSavedSnapshot && orchestratedData.session) {
                const candidatePersona = orchestratedData.session.persona;
                const candidateIntent = orchestratedData.session.intent;
                const candidateView = orchestratedData.session.view;
                if (candidatePersona && PERSONA_PROFILES.some((persona) => persona.id === candidatePersona)) {
                  setVisitorPersona(candidatePersona as VisitorPersona);
                }
                if (candidateIntent && GUEST_INTENT_OPTIONS.some((option) => option.id === candidateIntent)) {
                  setGuestIntent(candidateIntent as GuestIntent);
                }
                if (candidateView && EXPERIENCE_VIEW_OPTIONS.some((option) => option.id === candidateView)) {
                  const normalizedView = (!isStayMode && candidateView === "property")
                    ? "operate"
                    : candidateView;
                  setExperienceView(normalizedView as ExperienceView);
                }
              }
            }
          }
        } catch {
          // Fall through to standard data fetch below.
        }

        if (!orchestrated) {
          setAgentNarrative(null);
          setAgentJourney(null);
          const [feedRes, allDestRes, liveDestRes] = await Promise.all([
            fetch(`/api/portals/${portal.slug}/feed`),
            fetch(`/api/portals/${portal.slug}/destinations/specials?${allQuery}`),
            fetch(`/api/portals/${portal.slug}/destinations/specials?${activeQuery}`),
          ]);

          feedData = await feedRes.json();
          allDestData = await allDestRes.json();
          liveDestData = await liveDestRes.json();
        }

        if (feedData.sections) {
          const normalized: FeedSection[] = feedData.sections
            .filter((s: { events?: unknown[] }) => (s.events || []).length > 0)
            .map((section) => {
              const events = Array.isArray(section.events) ? section.events : [];
              return {
                title: String(section.title || ""),
                slug: typeof section.slug === "string" ? section.slug : undefined,
                description: typeof section.description === "string" ? section.description : undefined,
                events: events.map((event) => ({
                id: String(event.id),
                title: String(event.title || ""),
                start_date: String(event.start_date || ""),
                start_time: event.start_time ? String(event.start_time) : null,
                image_url: event.image_url ? String(event.image_url) : null,
                description: event.description ? String(event.description) : null,
                venue_name: event.venue_name
                  ? String(event.venue_name)
                  : event.venue && typeof event.venue === "object" && "name" in event.venue
                    ? String((event.venue as { name?: string }).name || "")
                    : null,
                category: event.category ? String(event.category) : null,
                subcategory: event.subcategory ? String(event.subcategory) : null,
                is_free: Boolean(event.is_free),
                price_min: typeof event.price_min === "number" ? event.price_min : null,
              })),
              };
            });
          setSections(normalized);
        }

        setDestinations((allDestData.destinations || []) as Destination[]);
        setLiveDestinations((liveDestData.destinations || []) as Destination[]);
      } catch (error) {
        console.error("Failed to fetch FORTH concierge data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isStayMode, portal.slug, portal.filters?.geo_center, portal.filters?.geo_radius_km]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const key = `forth-concierge:${portal.slug}`;
    const params = new URLSearchParams(window.location.search);
    const requestedFromUrl = params.get("concierge_services");
    const planFromUrl = params.get("concierge_plan");
    const intentFromUrl = params.get("concierge_intent");
    const personaFromUrl = params.get("guest_persona");
    const viewFromUrl = params.get("concierge_view");
    const bundleFromUrl = params.get("concierge_bundle");
    const focusFromUrl = params.get("concierge_focus");
    const foodFocusFromUrl = params.get("concierge_food_focus");
    const destinationVibeFromUrl = params.get("concierge_destination_vibe");
    const modeFromUrl = params.get("concierge_mode");
    const planningFromUrl = params.get("concierge_planning");
    const daypartFromUrl = params.get("concierge_daypart");
    const futureDateFromUrl = params.get("concierge_future_date");
    const planTypeFromUrl = params.get("concierge_plan_type");
    const detailedFromUrl = params.get("concierge_detailed");
    const briefFromUrl = params.get("concierge_brief");

    const applyIntent = (value: string | null | undefined) => {
      if (value && GUEST_INTENT_OPTIONS.some((option) => option.id === value)) {
        setGuestIntent(value as GuestIntent);
      }
    };

    const applyRequested = (value: string[] | undefined) => {
      if (!value) return;
      setRequestedServiceIds(value.filter((id) => knownServiceIds.includes(id)));
    };

    const applyPlan = (value: string[] | undefined) => {
      if (!value || value.length === 0) return;
      setSelectedPlanIds(value);
      setPlanInitialized(true);
    };

    const applyPersona = (value: string | null | undefined) => {
      if (!value) return;
      if (PERSONA_PROFILES.some((persona) => persona.id === value)) {
        setVisitorPersona(value as VisitorPersona);
      }
    };

    const applyView = (value: string | null | undefined) => {
      if (!value) return;
      if (EXPERIENCE_VIEW_OPTIONS.some((option) => option.id === value)) {
        const normalizedView = (!isStayMode && value === "property")
          ? "operate"
          : value;
        setExperienceView(normalizedView as ExperienceView);
      }
    };

    const applyBundle = (value: string | null | undefined) => {
      if (!showStudioControls) return;
      if (!value) return;
      if (COMMAND_BUNDLES.some((bundle) => bundle.id === value)) {
        setActiveBundleId(value);
      }
    };

    const applyFocus = (value: string | null | undefined) => {
      if (!value) return;
      if (DISCOVERY_FOCUS_OPTIONS.some((focus) => focus.id === value)) {
        setDiscoveryFocusId(value as DiscoveryFocusId);
      }
    };

    const applyFoodFocus = (value: string | null | undefined) => {
      if (!value) return;
      if (FOOD_DRINK_FOCUS_OPTIONS.some((focus) => focus.id === value)) {
        setFoodDrinkFocusId(value as FoodDrinkFocusId);
      }
    };

    const applyDestinationVibe = (value: string | null | undefined) => {
      if (!value) return;
      if (DESTINATION_VIBE_OPTIONS.some((option) => option.id === value)) {
        setDestinationVibeId(value as DestinationVibeId);
      }
    };

    const applyCuratorMode = (value: string | null | undefined) => {
      if (!showStudioControls) return;
      if (!value) return;
      if (CURATOR_MODES.some((mode) => mode.id === value)) {
        setCuratorModeId(value as CuratorModeId);
      }
    };

    const applyPlanning = (value: string | null | undefined) => {
      if (!value) return;
      if (value === "tonight" || value === "future") {
        setDiscoveryMode(value as DiscoveryMode);
      }
    };

    const applyDaypart = (value: string | null | undefined) => {
      if (!value) return;
      if (CONCIERGE_DAYPART_OPTIONS.some((option) => option.id === value)) {
        setSelectedDaypart(value as ConciergeDaypart);
      }
    };

    const applyFutureDate = (value: string | null | undefined) => {
      if (!value) return;
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        setFutureDate(value);
      }
    };

    const applyPlanType = (value: string | null | undefined) => {
      if (!value) return;
      if (PLAN_AHEAD_CATEGORY_OPTIONS.some((option) => option.id === value)) {
        setPlanAheadCategory(value as PlanAheadCategory);
      }
    };

    if (
      requestedFromUrl ||
      planFromUrl ||
      intentFromUrl ||
      personaFromUrl ||
      viewFromUrl ||
      bundleFromUrl ||
      focusFromUrl ||
      foodFocusFromUrl ||
      destinationVibeFromUrl ||
      modeFromUrl ||
      planningFromUrl ||
      daypartFromUrl ||
      futureDateFromUrl ||
      planTypeFromUrl ||
      detailedFromUrl ||
      briefFromUrl
    ) {
      applyPersona(personaFromUrl);
      applyView(viewFromUrl);
      applyBundle(bundleFromUrl);
      applyFocus(focusFromUrl);
      applyFoodFocus(foodFocusFromUrl);
      applyDestinationVibe(destinationVibeFromUrl);
      applyCuratorMode(modeFromUrl);
      applyPlanning(planningFromUrl);
      applyDaypart(daypartFromUrl);
      applyFutureDate(futureDateFromUrl);
      applyPlanType(planTypeFromUrl);
      applyIntent(intentFromUrl);
      applyRequested(requestedFromUrl?.split(",").filter(Boolean));
      applyPlan(planFromUrl?.split(",").filter(Boolean));
      setShowDetailedPlan(detailedFromUrl === "1" || detailedFromUrl === "true");
      setIsBriefMode(briefFromUrl === "1" || briefFromUrl === "true");
      return;
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as ConciergeStateSnapshot;
      applyPersona(parsed.visitorPersona);
      applyView(parsed.experienceView);
      applyFocus(parsed.discoveryFocusId);
      applyFoodFocus(parsed.foodDrinkFocusId);
      applyDestinationVibe(parsed.destinationVibeId);
      applyCuratorMode(parsed.curatorModeId);
      applyPlanning(parsed.discoveryMode);
      applyDaypart(parsed.daypart);
      applyFutureDate(parsed.futureDate);
      applyPlanType(parsed.planAheadCategory);
      applyIntent(parsed.guestIntent);
      applyRequested(parsed.requestedServiceIds);
      applyPlan(parsed.selectedPlanIds);
      if (parsed.requestTicketsByService && typeof parsed.requestTicketsByService === "object") {
        setRequestTicketsByService(parsed.requestTicketsByService);
      }
      if (typeof parsed.activeBundleId === "string" || parsed.activeBundleId === null) {
        setActiveBundleId(parsed.activeBundleId ?? null);
      }
      if (typeof parsed.isBriefMode === "boolean") {
        setIsBriefMode(parsed.isBriefMode);
      }
      if (typeof parsed.showDetailedPlan === "boolean") {
        setShowDetailedPlan(parsed.showDetailedPlan);
      }
    } catch {
      // Ignore malformed local state snapshots.
    }
  }, [isStayMode, knownServiceIds, portal.slug, showStudioControls]);

  const now = useMemo(() => new Date(), []);
  const dayPart = useMemo(() => getDayPart(now), [now]);
  const greeting = useMemo(() => getDayPartCopy(dayPart), [dayPart]);
  const heroTitle = agentNarrative?.heroTitle || greeting.title;
  const heroSubtitle = agentNarrative?.heroSubtitle || greeting.subtitle;
  const todayStamp = useMemo(() => toLocalDateStamp(now), [now]);

  const tonightSection = sections.find((s) => s.slug === "tonight" || s.slug === "today" || s.slug === "this-evening") || sections[0];
  const picksSection = sections.find((s) => s.slug === "curated" || s.slug === "picks" || s.slug === "our-picks");
  const activeDiscoveryFocus = useMemo(
    () => DISCOVERY_FOCUS_OPTIONS.find((focus) => focus.id === discoveryFocusId) || DISCOVERY_FOCUS_OPTIONS[0],
    [discoveryFocusId]
  );
  const activeFoodDrinkFocus = useMemo(
    () => FOOD_DRINK_FOCUS_OPTIONS.find((focus) => focus.id === foodDrinkFocusId) || FOOD_DRINK_FOCUS_OPTIONS[0],
    [foodDrinkFocusId]
  );
  const activeDestinationVibe = useMemo(
    () => DESTINATION_VIBE_OPTIONS.find((option) => option.id === destinationVibeId) || DESTINATION_VIBE_OPTIONS[0],
    [destinationVibeId]
  );
  const activeCuratorMode = useMemo(
    () => CURATOR_MODES.find((mode) => mode.id === curatorModeId) || CURATOR_MODES[0],
    [curatorModeId]
  );
  const activeIntent = useMemo(
    () => GUEST_INTENT_OPTIONS.find((option) => option.id === guestIntent) || GUEST_INTENT_OPTIONS[0],
    [guestIntent]
  );
  const allEventPool = useMemo(() => sections.flatMap((section) => section.events), [sections]);
  const futureNightDates = useMemo(() => {
    const unique = new Set<string>();
    for (const event of allEventPool) {
      if (!event.start_date || event.start_date <= todayStamp) continue;
      unique.add(event.start_date);
    }
    return Array.from(unique).sort().slice(0, 7);
  }, [allEventPool, todayStamp]);
  const hasFutureNights = futureNightDates.length > 0;
  const effectiveDiscoveryMode: DiscoveryMode = !isStayMode && discoveryMode === "future" && hasFutureNights
    ? "future"
    : "tonight";
  const selectedFutureDate = effectiveDiscoveryMode === "future"
    ? (futureDate && futureNightDates.includes(futureDate) ? futureDate : futureNightDates[0] || null)
    : null;
  const hasGuidedVenueFilter = activeDiscoveryFocus.id !== "any"
    || activeFoodDrinkFocus.id !== "any"
    || (planAheadCategory === "destinations" && activeDestinationVibe.id !== "any");
  const activeVenueGuidanceLabel = useMemo(() => {
    if (effectiveDiscoveryMode === "future") {
      if (planAheadCategory === "food") return "Food";
      if (planAheadCategory === "entertainment") return "Entertainment";
      if (planAheadCategory === "destinations") return activeDestinationVibe.id === "any" ? "Destinations" : activeDestinationVibe.label;
      return "Future Night";
    }
    if (planAheadCategory === "food") return "Food";
    if (planAheadCategory === "entertainment") return "Entertainment";
    if (planAheadCategory === "destinations") return activeDestinationVibe.id === "any" ? "Destinations" : activeDestinationVibe.label;
    if (activeFoodDrinkFocus.id !== "any") return activeFoodDrinkFocus.label;
    if (activeDiscoveryFocus.id !== "any") return activeDiscoveryFocus.label;
    return activeIntent.label;
  }, [activeDestinationVibe.id, activeDestinationVibe.label, activeDiscoveryFocus.id, activeDiscoveryFocus.label, activeFoodDrinkFocus.id, activeFoodDrinkFocus.label, activeIntent.label, effectiveDiscoveryMode, planAheadCategory]);
  const selectedDaypartLabel = useMemo(() => formatConciergeDaypart(selectedDaypart), [selectedDaypart]);
  const eventContextLabel = useMemo(() => {
    if (selectedDaypart !== "all") return selectedDaypartLabel;
    return effectiveDiscoveryMode === "future" ? "For later" : "Right now";
  }, [effectiveDiscoveryMode, selectedDaypart, selectedDaypartLabel]);
  const activePersona = useMemo(
    () => PERSONA_PROFILES.find((persona) => persona.id === visitorPersona) || PERSONA_PROFILES[0],
    [visitorPersona]
  );

  const rankedDestinations = useMemo(
    () => rankDestinationsForIntent(destinations, guestIntent),
    [destinations, guestIntent]
  );

  const focusedDestinations = useMemo(() => {
    if (activeDiscoveryFocus.id === "any") return rankedDestinations;
    const matches = rankedDestinations.filter((destination) => matchesDestinationFocus(destination, activeDiscoveryFocus));
    return matches.length > 0 ? matches : rankedDestinations;
  }, [activeDiscoveryFocus, rankedDestinations]);

  const rankedLiveDestinations = useMemo(
    () => rankDestinationsForIntent(liveDestinations, guestIntent),
    [liveDestinations, guestIntent]
  );

  const focusedLiveDestinations = useMemo(() => {
    if (activeDiscoveryFocus.id === "any") return rankedLiveDestinations;
    const matches = rankedLiveDestinations.filter((destination) => matchesDestinationFocus(destination, activeDiscoveryFocus));
    return matches.length > 0 ? matches : rankedLiveDestinations;
  }, [activeDiscoveryFocus, rankedLiveDestinations]);

  const foodFocusedDestinations = useMemo(() => {
    if (activeFoodDrinkFocus.id === "any") return focusedDestinations;
    const matches = focusedDestinations.filter((destination) => matchesFoodDrinkFocus(destination, activeFoodDrinkFocus));
    return matches.length > 0 ? matches : focusedDestinations;
  }, [activeFoodDrinkFocus, focusedDestinations]);

  const foodFocusedLiveDestinations = useMemo(() => {
    if (activeFoodDrinkFocus.id === "any") return focusedLiveDestinations;
    const matches = focusedLiveDestinations.filter((destination) => matchesFoodDrinkFocus(destination, activeFoodDrinkFocus));
    return matches.length > 0 ? matches : focusedLiveDestinations;
  }, [activeFoodDrinkFocus, focusedLiveDestinations]);

  const guidedTonightEventsBase = useMemo(() => {
    const events = tonightSection?.events || [];
    if (activeDiscoveryFocus.id === "any") return events;
    const matches = events.filter((event) => matchesEventFocus(event, activeDiscoveryFocus));
    return matches.length > 0 ? matches : events;
  }, [activeDiscoveryFocus, tonightSection]);

  const guidedTonightEvents = useMemo(() => {
    if (selectedDaypart === "all") return guidedTonightEventsBase;
    const matches = guidedTonightEventsBase.filter((event) => matchesEventDaypart(event, selectedDaypart));
    return matches.length > 0 ? matches : guidedTonightEventsBase;
  }, [guidedTonightEventsBase, selectedDaypart]);

  const futureNightEventsBase = useMemo(() => {
    if (!selectedFutureDate) return [];
    const futurePool = allEventPool.filter((event) => event.start_date === selectedFutureDate);
    if (activeDiscoveryFocus.id === "any") return futurePool;
    const matches = futurePool.filter((event) => matchesEventFocus(event, activeDiscoveryFocus));
    return matches.length > 0 ? matches : futurePool;
  }, [activeDiscoveryFocus, allEventPool, selectedFutureDate]);

  const futureNightEvents = useMemo(() => {
    if (selectedDaypart === "all") return futureNightEventsBase;
    const matches = futureNightEventsBase.filter((event) => matchesEventDaypart(event, selectedDaypart));
    return matches.length > 0 ? matches : futureNightEventsBase;
  }, [futureNightEventsBase, selectedDaypart]);

  const planAheadEvents = useMemo(() => {
    if (effectiveDiscoveryMode !== "future") return futureNightEvents;
    if (planAheadCategory === "destinations") return [];
    if (planAheadCategory === "all") return futureNightEvents;

    const matches = futureNightEvents.filter((event) => matchesPlanAheadCategoryForEvent(event, planAheadCategory));
    return isPlanRoute ? matches : (matches.length > 0 ? matches : futureNightEvents);
  }, [effectiveDiscoveryMode, futureNightEvents, isPlanRoute, planAheadCategory]);

  const planAheadDestinations = useMemo(() => {
    if (effectiveDiscoveryMode !== "future") return foodFocusedDestinations;
    if (planAheadCategory === "all") return foodFocusedDestinations;

    const matches = foodFocusedDestinations.filter((destination) => (
      matchesPlanAheadCategoryForDestination(destination, planAheadCategory)
    ));
    return isPlanRoute ? matches : (matches.length > 0 ? matches : foodFocusedDestinations);
  }, [effectiveDiscoveryMode, foodFocusedDestinations, isPlanRoute, planAheadCategory]);

  const tonightEvents = useMemo(() => {
    if (planAheadCategory === "all" || planAheadCategory === "destinations") return guidedTonightEvents;
    const matches = guidedTonightEvents.filter((event) => matchesPlanAheadCategoryForEvent(event, planAheadCategory));
    return matches.length > 0 ? matches : guidedTonightEvents;
  }, [guidedTonightEvents, planAheadCategory]);

  const tonightDestinations = useMemo(() => {
    if (planAheadCategory === "all") return foodFocusedLiveDestinations;
    const matches = foodFocusedLiveDestinations.filter((destination) => (
      matchesPlanAheadCategoryForDestination(destination, planAheadCategory)
    ));
    return matches.length > 0 ? matches : foodFocusedLiveDestinations;
  }, [foodFocusedLiveDestinations, planAheadCategory]);

  const tonightFallbackDestinations = useMemo(() => {
    if (planAheadCategory === "all") return focusedLiveDestinations;
    const matches = focusedLiveDestinations.filter((destination) => (
      matchesPlanAheadCategoryForDestination(destination, planAheadCategory)
    ));
    return matches.length > 0 ? matches : focusedLiveDestinations;
  }, [focusedLiveDestinations, planAheadCategory]);

  const explorationDestinationsBase = useMemo(
    () => effectiveDiscoveryMode === "future" ? planAheadDestinations : tonightDestinations,
    [effectiveDiscoveryMode, planAheadDestinations, tonightDestinations]
  );
  const explorationDestinations = useMemo(() => {
    const daypartFiltered = selectedDaypart === "all"
      ? explorationDestinationsBase
      : (() => {
        const matches = explorationDestinationsBase.filter((destination) => matchesDestinationDaypart(destination, selectedDaypart));
        return matches.length > 0 ? matches : explorationDestinationsBase;
      })();

    if (planAheadCategory !== "destinations" || destinationVibeId === "any") return daypartFiltered;

    const vibeMatches = daypartFiltered.filter((destination) => matchesDestinationVibe(destination, destinationVibeId));
    return vibeMatches.length > 0 ? vibeMatches : daypartFiltered;
  }, [destinationVibeId, explorationDestinationsBase, planAheadCategory, selectedDaypart]);

  const fallbackExplorationDestinationsBase = useMemo(() => {
    if (effectiveDiscoveryMode !== "future") return tonightFallbackDestinations;
    if (planAheadCategory === "all") return focusedDestinations;

    const matches = focusedDestinations.filter((destination) => (
      matchesPlanAheadCategoryForDestination(destination, planAheadCategory)
    ));
    return isPlanRoute ? matches : (matches.length > 0 ? matches : focusedDestinations);
  }, [effectiveDiscoveryMode, focusedDestinations, isPlanRoute, planAheadCategory, tonightFallbackDestinations]);

  const fallbackExplorationDestinations = useMemo(() => {
    const daypartFiltered = selectedDaypart === "all"
      ? fallbackExplorationDestinationsBase
      : (() => {
        const matches = fallbackExplorationDestinationsBase.filter((destination) => matchesDestinationDaypart(destination, selectedDaypart));
        return matches.length > 0 ? matches : fallbackExplorationDestinationsBase;
      })();

    if (planAheadCategory !== "destinations" || destinationVibeId === "any") return daypartFiltered;

    const vibeMatches = daypartFiltered.filter((destination) => matchesDestinationVibe(destination, destinationVibeId));
    return vibeMatches.length > 0 ? vibeMatches : daypartFiltered;
  }, [destinationVibeId, fallbackExplorationDestinationsBase, planAheadCategory, selectedDaypart]);

  const featuredEvents = effectiveDiscoveryMode === "future" ? planAheadEvents : tonightEvents;
  const hourOfDay = now.getHours();
  const happyHourWindowActive = hourOfDay >= 14 && hourOfDay < 21;
  const openLateWindowActive = hourOfDay >= 21 || hourOfDay < 3;
  const showHappyHourRail = useMemo(() => {
    if (selectedDaypart === "day" || selectedDaypart === "evening") return true;
    if (selectedDaypart === "late_night" || selectedDaypart === "morning") return false;
    return happyHourWindowActive;
  }, [happyHourWindowActive, selectedDaypart]);
  const happyHourDestinations = useMemo(() => {
    const source = effectiveDiscoveryMode === "future" ? planAheadDestinations : explorationDestinations;
    return source.filter(isHappyHourCandidate).slice(0, 10);
  }, [effectiveDiscoveryMode, explorationDestinations, planAheadDestinations]);
  const showOpenLateRail = useMemo(() => {
    if (selectedDaypart === "late_night") return true;
    if (selectedDaypart === "morning" || selectedDaypart === "day") return false;
    return openLateWindowActive;
  }, [openLateWindowActive, selectedDaypart]);
  const openLateDestinations = useMemo(() => {
    const source = effectiveDiscoveryMode === "future" ? planAheadDestinations : explorationDestinations;
    return source.filter(isOpenLateCandidate).slice(0, 10);
  }, [effectiveDiscoveryMode, explorationDestinations, planAheadDestinations]);
  const weekEvents = useMemo(() => {
    const today = parseDateAtNoon(todayStamp);
    if (!today) return [];
    const focusFiltered = activeDiscoveryFocus.id === "any"
      ? allEventPool
      : allEventPool.filter((event) => matchesEventFocus(event, activeDiscoveryFocus));
    return focusFiltered
      .filter((event) => {
        const eventDate = parseDateAtNoon(event.start_date);
        if (!eventDate) return false;
        const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      })
      .slice(0, 6);
  }, [activeDiscoveryFocus, allEventPool, todayStamp]);
  const weekendEvents = useMemo(() => {
    const today = parseDateAtNoon(todayStamp);
    if (!today) return [];
    const focusFiltered = activeDiscoveryFocus.id === "any"
      ? allEventPool
      : allEventPool.filter((event) => matchesEventFocus(event, activeDiscoveryFocus));
    return focusFiltered
      .filter((event) => {
        const eventDate = parseDateAtNoon(event.start_date);
        if (!eventDate) return false;
        const diffDays = Math.round((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || diffDays > 14) return false;
        const day = eventDate.getDay();
        return day === 5 || day === 6 || day === 0;
      })
      .slice(0, 6);
  }, [activeDiscoveryFocus, allEventPool, todayStamp]);

  const startingSoon = useMemo(
    () => foodFocusedDestinations.filter((d) => d.special_state === "starting_soon").slice(0, 9),
    [foodFocusedDestinations]
  );

  const walkable = useMemo(
    () => foodFocusedDestinations.filter((d) => d.proximity_tier === "walkable").slice(0, 16),
    [foodFocusedDestinations]
  );

  const categorized = useMemo(() => {
    const grouped: Record<"dine" | "drink" | "explore", Destination[]> = {
      dine: [],
      drink: [],
      explore: [],
    };

    for (const destination of foodFocusedDestinations) {
      grouped[getCategory(destination.venue.venue_type)].push(destination);
    }

    return grouped;
  }, [foodFocusedDestinations]);

  const signatureVenueEntries = useMemo(
    () => FORTH_SIGNATURE_VENUES.map((preset) => ({
      preset,
      destination: findDestinationByKeywords(destinations, preset.keywords),
    })),
    [destinations]
  );

  const signatureVenueIds = useMemo(() => {
    const ids = new Set<number>();
    for (const entry of signatureVenueEntries) {
      if (entry.destination) {
        ids.add(entry.destination.venue.id);
      }
    }
    return ids;
  }, [signatureVenueEntries]);

  const amenityEntries = useMemo(
    () => FORTH_AMENITIES.map((amenity) => ({
      amenity,
      destination: findDestinationByKeywords(destinations, amenity.keywords),
    })),
    [destinations]
  );

  const topAmenityPreviewItems = useMemo(() => {
    const signaturePreviews: PreviewItem[] = signatureVenueEntries.map(({ preset, destination }) => ({
      id: `signature-${preset.id}`,
      title: destination?.venue.name || preset.name,
      subtitle: preset.spotlight,
      badge: preset.kind === "restaurant" ? "Dining" : "Bar",
      href: destination
        ? resolveDestinationHref(portal.slug, destination)
        : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(preset.name)}`,
      imageSources: [destination?.venue.image_url, preset.photoUrl, ...FORTH_IMAGE_FALLBACKS],
    }));

    const amenityPreviews: PreviewItem[] = amenityEntries.map(({ amenity, destination }) => ({
      id: `amenity-${amenity.id}`,
      title: amenity.name,
      subtitle: amenity.detail,
      badge: "Amenity",
      href: destination
        ? resolveDestinationHref(portal.slug, destination)
        : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(amenity.name)}`,
      imageSources: [destination?.venue.image_url, amenity.photoUrl, ...FORTH_IMAGE_FALLBACKS],
    }));

    return [...signaturePreviews, ...amenityPreviews].slice(0, 6);
  }, [amenityEntries, portal.slug, signatureVenueEntries]);

  const propertyDestinations = useMemo(
    () => foodFocusedDestinations
      .filter((d) => isLikelyHotelAmenity(d, portal.name) && !signatureVenueIds.has(d.venue.id))
      .slice(0, 8),
    [foodFocusedDestinations, portal.name, signatureVenueIds]
  );

  const beltline = useMemo(() => foodFocusedDestinations.filter(isBeltlineDestination).slice(0, 8), [foodFocusedDestinations]);

  const highConfidenceDestinationCount = useMemo(
    () => explorationDestinations.filter((destination) => destination.top_special?.confidence === "high").length,
    [explorationDestinations]
  );
  const verifiedWithinDayCount = useMemo(
    () => explorationDestinations.filter((destination) => isVerifiedWithinHours(destination.top_special?.last_verified_at, 24)).length,
    [explorationDestinations]
  );
  const walkableDestinationCount = useMemo(
    () => explorationDestinations.filter((destination) => destination.proximity_tier === "walkable").length,
    [explorationDestinations]
  );
  const freshestSignalHours = useMemo(() => {
    const hours = explorationDestinations
      .map((destination) => hoursSinceTimestamp(destination.top_special?.last_verified_at))
      .filter((value): value is number => value !== null)
      .sort((a, b) => a - b);
    return hours[0] ?? null;
  }, [explorationDestinations]);
  const quickActions = useMemo<DecisionAction[]>(() => {
    if (isStayMode) {
      return [
        {
          label: "Signature Dining At FORTH",
          href: "#forth-signature-venues",
          note: "Lead with FORTH's flagship dining and bar rooms.",
        },
        {
          label: "Reserve Spa + Wellness",
          href: "#forth-amenities",
          note: "Secure high-value amenities before evening plans.",
        },
        {
          label: "Request In-Room Service",
          href: "#guest-service-layer",
          note: "Send a concierge request in one step.",
        },
      ];
    }

    if (isDiningRoute) {
      return [
        {
          label: "Great Cocktails Nearby",
          href: `/${portal.slug}?view=find&type=destinations&search=cocktail bar`,
          note: "Bars and rooftops with polished drink programs.",
        },
        {
          label: "Reserve Dinner",
          href: `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,rooftop,bar`,
          note: "Open reservation-friendly dining picks.",
        },
        {
          label: "Sports Bar Energy",
          href: `/${portal.slug}?view=find&type=destinations&search=sports bar`,
          note: "Game-night options with live atmosphere.",
        },
      ];
    }

    if (effectiveDiscoveryMode === "future") {
      return [
        {
          label: selectedFutureDate ? `Events ${formatDateChip(selectedFutureDate)}` : "Explore Upcoming Events",
          href: `/${portal.slug}?view=find&type=events`,
          note: "Start with what is happening on your stay date.",
        },
        {
          label: "Where To Dine",
          href: `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,rooftop,bar`,
          note: "Open dining picks with reservation potential.",
        },
        {
          label: "Neighborhoods To Bookmark",
          href: `/${portal.slug}?view=find&type=destinations&neighborhoods=Old Fourth Ward,Inman Park,Poncey-Highland,Midtown`,
          note: "Save walkable or short-ride anchors for your trip.",
        },
      ];
    }

    if (activePersona.id === "club_member") {
      return [
        {
          label: "Member-Favorite Dining",
          href: `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,bar,rooftop`,
          note: "Start with destinations that fit FORTH Club habits.",
        },
        {
          label: "Club-Adjacent Events",
          href: `/${portal.slug}?view=find&type=events&search=club`,
          note: "Find events aligned to member social rhythms.",
        },
        {
          label: "Wellness + Recovery",
          href: `/${portal.slug}?view=find&type=destinations&venue_type=spa,fitness_center`,
          note: "Balance social plans with reset options.",
        },
      ];
    }

    return [
      {
        label: "Top Happy Hour Right Now",
        href: `/${portal.slug}?view=find&type=destinations&venue_type=bar,rooftop,brewery,sports_bar`,
        note: "A polished start if you want drinks first.",
      },
      {
        label: "Dinner Near FORTH",
        href: `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,food_hall`,
        note: "Closest strong restaurant choices for now.",
      },
      {
        label: "Tonight's Signature Events",
        href: `/${portal.slug}?view=find&type=events&date=today`,
        note: "Open the strongest options for your selected time window.",
      },
    ];
  }, [activePersona.id, effectiveDiscoveryMode, isDiningRoute, isStayMode, portal.slug, selectedFutureDate]);
  const decisionStackLabel = effectiveDiscoveryMode === "future" ? "Stay Selections" : "Concierge Selections";
  const topFeaturedEvent = featuredEvents[0];
  const editorialMoments = useMemo(() => {
    const items: EditorialMoment[] = [];

    if (topFeaturedEvent) {
      items.push({
        id: `moment-event-${topFeaturedEvent.id}`,
        title: topFeaturedEvent.title,
        subtitle: topFeaturedEvent.venue_name || "Featured event",
        href: resolveEventHref(portal.slug, topFeaturedEvent),
        badge: "Featured Pick",
        imageSrc: getProxiedImageSrc(topFeaturedEvent.image_url || HERO_PHOTOS_BY_DAYPART[dayPart]) as string,
      });
    }

    const signatureLead = signatureVenueEntries.find((entry) => entry.destination || entry.preset.photoUrl);
    if (signatureLead) {
      items.push({
        id: `moment-signature-${signatureLead.preset.id}`,
        title: signatureLead.destination?.venue.name || signatureLead.preset.name,
        subtitle: signatureLead.preset.spotlight,
        href: signatureLead.destination
          ? resolveDestinationHref(portal.slug, signatureLead.destination)
          : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(signatureLead.preset.name)}`,
        badge: "Signature Venue",
        imageSrc: getProxiedImageSrc(signatureLead.destination?.venue.image_url || signatureLead.preset.photoUrl) as string,
      });
    }

    const amenityLead = amenityEntries[0];
    if (amenityLead) {
      items.push({
        id: `moment-amenity-${amenityLead.amenity.id}`,
        title: amenityLead.amenity.name,
        subtitle: amenityLead.amenity.detail,
        href: amenityLead.destination
          ? resolveDestinationHref(portal.slug, amenityLead.destination)
          : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(amenityLead.amenity.name)}`,
        badge: "Property Service",
        imageSrc: getProxiedImageSrc(amenityLead.destination?.venue.image_url || amenityLead.amenity.photoUrl) as string,
      });
    }

    if (items.length < 3) {
      const fallbackPhotos = [
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=2200&q=80",
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=2200&q=80",
        "https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=2200&q=80",
      ];
      while (items.length < 3) {
        const idx = items.length;
        items.push({
          id: `moment-fallback-${idx}`,
          title: idx === 0 ? "Arrival Lobby" : idx === 1 ? "Signature Dining" : "Night Session",
          subtitle: "Featured photography placeholder while live venue imagery updates.",
          href: `/${portal.slug}?view=find&type=destinations`,
          badge: "Pitch Mode",
          imageSrc: getProxiedImageSrc(fallbackPhotos[idx]) as string,
        });
      }
    }

    return items.slice(0, 3);
  }, [amenityEntries, dayPart, portal.slug, signatureVenueEntries, topFeaturedEvent]);

  const planCandidates = useMemo(() => {
    const items: PlanCandidate[] = [];
    const seen = new Set<string>();

    if (topFeaturedEvent) {
      const id = `event-${topFeaturedEvent.id}`;
      seen.add(id);
      items.push({
        id,
        title: topFeaturedEvent.title,
        subtitle: topFeaturedEvent.venue_name || "Featured event",
        kind: "event",
        venueType: null,
        href: resolveEventHref(portal.slug, topFeaturedEvent),
        etaMinutes: 0,
        confidence: null,
        proximityTier: null,
        isSignature: false,
        isFromLive: true,
      });
    }

    const planSourceDestinations = effectiveDiscoveryMode === "future"
      ? foodFocusedDestinations
      : foodFocusedLiveDestinations;

    for (const [index, destination] of planSourceDestinations.slice(0, 5).entries()) {
      const id = `dest-${destination.venue.id}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const liveBias = effectiveDiscoveryMode === "future"
        ? 120 + index * 45
        : destination.special_state === "active_now"
          ? 35 + index * 35
          : destination.top_special?.starts_in_minutes !== null && destination.top_special?.starts_in_minutes !== undefined
            ? Math.max(25, destination.top_special.starts_in_minutes + 30)
            : 90 + index * 25;

      items.push({
        id,
        title: destination.venue.name,
        subtitle: destination.top_special?.title || destination.proximity_label,
        kind: "destination",
        venueType: destination.venue.venue_type,
        href: resolveDestinationHref(portal.slug, destination),
        etaMinutes: liveBias,
        confidence: destination.top_special?.confidence || null,
        proximityTier: destination.proximity_tier,
        isSignature: false,
        isFromLive: effectiveDiscoveryMode !== "future",
      });
    }

    for (const [index, entry] of signatureVenueEntries.entries()) {
      if (!entry.destination) continue;
      const id = `dest-${entry.destination.venue.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      items.push({
        id,
        title: entry.destination.venue.name,
        subtitle: entry.destination.top_special?.title || entry.preset.mockSpecial,
        kind: "destination",
        venueType: entry.destination.venue.venue_type,
        href: resolveDestinationHref(portal.slug, entry.destination),
        etaMinutes: 120 + index * 30,
        confidence: entry.destination.top_special?.confidence || null,
        proximityTier: entry.destination.proximity_tier,
        isSignature: true,
        isFromLive: false,
      });
    }

    return items.slice(0, 8);
  }, [effectiveDiscoveryMode, foodFocusedDestinations, foodFocusedLiveDestinations, portal.slug, signatureVenueEntries, topFeaturedEvent]);

  const rankedPlanCandidates = useMemo(
    () => rankPlanCandidatesForMode(planCandidates, curatorModeId),
    [curatorModeId, planCandidates]
  );

  const planCandidateById = useMemo(
    () => new Map(planCandidates.map((candidate) => [candidate.id, candidate])),
    [planCandidates]
  );

  useEffect(() => {
    if (planInitialized || rankedPlanCandidates.length === 0) return;
    setSelectedPlanIds(rankedPlanCandidates.slice(0, 3).map((candidate) => candidate.id));
    setPlanInitialized(true);
  }, [planInitialized, rankedPlanCandidates]);

  useEffect(() => {
    if (showStudioControls) return;
    if (curatorModeId !== "safe") {
      setCuratorModeId("safe");
    }
    if (activeBundleId !== null) {
      setActiveBundleId(null);
    }
    if (showStudioPanel) {
      setShowStudioPanel(false);
    }
  }, [activeBundleId, curatorModeId, showStudioControls, showStudioPanel]);

  useEffect(() => {
    if (!showDetailedPlan) return;
    if (showStudioPanel) return;
    if (showStudioControls) {
      setShowStudioPanel(true);
      return;
    }
    setShowDetailedPlan(false);
  }, [showDetailedPlan, showStudioControls, showStudioPanel]);

  const selectedPlan = useMemo(() => {
    return selectedPlanIds
      .map((id) => planCandidateById.get(id))
      .filter((candidate): candidate is PlanCandidate => Boolean(candidate))
      .sort((a, b) => a.etaMinutes - b.etaMinutes);
  }, [planCandidateById, selectedPlanIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `forth-concierge:${portal.slug}`;
    const snapshot: ConciergeStateSnapshot = {
      visitorPersona,
      experienceView,
      discoveryMode,
      daypart: selectedDaypart,
      futureDate,
      planAheadCategory,
      guestIntent,
      discoveryFocusId,
      foodDrinkFocusId,
      destinationVibeId,
      curatorModeId: showStudioControls ? curatorModeId : "safe",
      requestedServiceIds,
      selectedPlanIds,
      requestTicketsByService,
      activeBundleId: showStudioControls ? activeBundleId : null,
      isBriefMode,
      showDetailedPlan,
    };
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  }, [activeBundleId, curatorModeId, destinationVibeId, discoveryFocusId, discoveryMode, experienceView, foodDrinkFocusId, futureDate, guestIntent, isBriefMode, planAheadCategory, portal.slug, requestedServiceIds, requestTicketsByService, selectedDaypart, selectedPlanIds, showStudioControls, showDetailedPlan, visitorPersona]);

  const submitServiceRequest = async (requestId: string) => {
    if (requestedServiceIds.includes(requestId)) {
      setRequestedServiceIds((current) => current.filter((value) => value !== requestId));
      setRequestTicketsByService((current) => {
        const next: Record<string, string> = { ...current };
        if (requestId in next) {
          delete next[requestId];
        }
        return next;
      });
      return;
    }

    setRequestError(null);
    setSubmittingRequestId(requestId);
    try {
      const response = await fetch(`/api/portals/${portal.slug}/concierge/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          request_type: requestId,
          guest_intent: guestIntent,
          itinerary_ids: selectedPlanIds.slice(0, 8),
          source: "forth_concierge",
        }),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data = await response.json() as { request_id?: string };
      setRequestedServiceIds((current) => (current.includes(requestId) ? current : [...current, requestId]));
      const ticketId = typeof data.request_id === "string" ? data.request_id : null;
      if (ticketId) {
        setRequestTicketsByService((current) => ({ ...current, [requestId]: ticketId }));
      }
    } catch {
      setRequestError("Unable to submit request right now. Please call concierge.");
    } finally {
      setSubmittingRequestId(null);
    }
  };

  const togglePlanCandidate = (candidateId: string) => {
    setSelectedPlanIds((current) => (
      current.includes(candidateId)
        ? current.filter((value) => value !== candidateId)
        : [...current, candidateId]
    ));
  };

  const applyCuratorModeProfile = (modeId: CuratorModeId) => {
    if (!showStudioControls) return;
    setCuratorModeId(modeId);
    const ranked = rankPlanCandidatesForMode(planCandidates, modeId);
    if (ranked.length > 0) {
      setSelectedPlanIds(ranked.slice(0, 3).map((candidate) => candidate.id));
      setPlanInitialized(true);
    }
  };

  const applyCommandBundle = (bundle: ConciergeBundle) => {
    if (!showStudioControls) return;
    setGuestIntent(bundle.intent);

    const selected = new Set<string>();
    const ordered: string[] = [];

    const pickCandidate = (predicate: (candidate: PlanCandidate) => boolean) => {
      const match = rankedPlanCandidates.find((candidate) => !selected.has(candidate.id) && predicate(candidate));
      if (!match) return;
      selected.add(match.id);
      ordered.push(match.id);
    };

    for (const step of bundle.steps) {
      if (step.kind === "event") {
        pickCandidate((candidate) => candidate.kind === "event");
        continue;
      }

      if (step.venueTypes && step.venueTypes.length > 0) {
        const venueTypes = step.venueTypes;
        pickCandidate((candidate) => (
          candidate.kind === "destination" &&
          !!candidate.venueType &&
          venueTypes.includes(candidate.venueType)
        ));
      } else {
        pickCandidate((candidate) => candidate.kind === "destination");
      }
    }

    if (ordered.length < 3) {
      for (const candidate of rankedPlanCandidates) {
        if (selected.has(candidate.id)) continue;
        selected.add(candidate.id);
        ordered.push(candidate.id);
        if (ordered.length >= 3) break;
      }
    }

    setSelectedPlanIds(ordered.slice(0, 4));
    setPlanInitialized(true);
    setActiveBundleId(bundle.id);
  };

  const applyPersonaProfile = (persona: PersonaProfile) => {
    setVisitorPersona(persona.id);
    setGuestIntent(persona.intent);
    const normalizedView = (!isStayMode && persona.defaultView === "property")
      ? "operate"
      : persona.defaultView;
    setExperienceView(normalizedView);
    if (!showStudioControls) {
      setActiveBundleId(null);
      return;
    }
    const preferredBundle = COMMAND_BUNDLES.find((bundle) => bundle.id === persona.preferredBundleId);
    if (preferredBundle) {
      applyCommandBundle(preferredBundle);
    } else {
      setActiveBundleId(null);
    }
  };

  const briefingPath = useMemo(() => {
    const params = new URLSearchParams();
    if (showStudioControls) {
      params.set("studio", "1");
    }
    params.set("guest_persona", visitorPersona);
    params.set("concierge_view", experienceView);
    params.set("concierge_planning", effectiveDiscoveryMode);
    params.set("concierge_daypart", selectedDaypart);
    if (selectedFutureDate) {
      params.set("concierge_future_date", selectedFutureDate);
    }
    params.set("concierge_plan_type", planAheadCategory);
    params.set("concierge_intent", guestIntent);
    params.set("concierge_focus", discoveryFocusId);
    params.set("concierge_food_focus", foodDrinkFocusId);
    params.set("concierge_destination_vibe", destinationVibeId);
    if (showStudioControls) {
      params.set("concierge_mode", curatorModeId);
      if (activeBundleId) {
        params.set("concierge_bundle", activeBundleId);
      }
    }
    if (selectedPlanIds.length > 0) {
      params.set("concierge_plan", selectedPlanIds.join(","));
    }
    if (requestedServiceIds.length > 0) {
      params.set("concierge_services", requestedServiceIds.join(","));
    }
    if (showDetailedPlan) {
      params.set("concierge_detailed", "1");
    }
    params.set("concierge_brief", "1");
    return `/${portal.slug}?${params.toString()}`;
  }, [activeBundleId, curatorModeId, destinationVibeId, discoveryFocusId, effectiveDiscoveryMode, experienceView, foodDrinkFocusId, guestIntent, planAheadCategory, portal.slug, requestedServiceIds, selectedDaypart, selectedFutureDate, selectedPlanIds, showStudioControls, showDetailedPlan, visitorPersona]);

  const copyBriefingLink = async () => {
    if (typeof window === "undefined") return;
    const absolute = `${window.location.origin}${briefingPath}`;
    try {
      await navigator.clipboard.writeText(absolute);
      setCopiedBriefing(true);
      window.setTimeout(() => setCopiedBriefing(false), 1800);
    } catch {
      setRequestError("Unable to copy briefing link. Please copy the URL from your browser.");
    }
  };

  const printBrief = () => {
    if (typeof window === "undefined") return;
    window.print();
  };

  useEffect(() => {
    if (isStayMode) {
      if (experienceView !== "property") {
        setExperienceView("property");
      }
      return;
    }
    if (experienceView === "property") {
      setExperienceView("operate");
    }
  }, [experienceView, isStayMode]);

  const showFullExperience = !isBriefMode;
  const effectiveView: ExperienceView = isStayMode
    ? "property"
    : experienceView === "property"
      ? "operate"
      : experienceView;
  const showOperate = showFullExperience && effectiveView === "operate";
  const showProperty = showFullExperience && effectiveView === "property";
  const showExplore = showFullExperience && effectiveView === "explore";
  const activeView = EXPERIENCE_VIEW_OPTIONS.find((option) => option.id === effectiveView) || EXPERIENCE_VIEW_OPTIONS[0];
  const experienceOptions = isStayMode
    ? EXPERIENCE_VIEW_OPTIONS
    : EXPERIENCE_VIEW_OPTIONS.filter((option) => option.id !== "property");
  const showExperienceSwitcher = showStudioControls && !isPlanRoute && !isDiningRoute && !isClubRoute;
  const showStudioPanelToggle = showFullExperience && !isStayMode && !isClubRoute && showStudioControls;
  const showGuidedSetup = showStudioPanelToggle && showStudioPanel;
  const showExtendedExploreToggle = showFullExperience && !isStayMode && showExplore && !isDiningRoute && !isPlanRoute && !isClubRoute;
  const showExtendedExploreSections = showFullExperience && !isStayMode && showExplore && !isDiningRoute && !isPlanRoute && (isClubRoute || showExtendedExplore);
  const showServiceLayer = showFullExperience && isStayMode;
  const showPlanBuilder = showStudioPanelToggle && showStudioPanel && showOperate && !isDiningRoute && !isPlanRoute;
  const planAheadShowsEvents = !isPlanRoute || planAheadCategory === "all" || planAheadCategory === "entertainment";
  const planAheadShowsDestinations = !isPlanRoute || planAheadCategory === "all" || planAheadCategory === "food" || planAheadCategory === "destinations";
  const planAheadEventSectionTitle = isPlanRoute
    ? planAheadCategory === "entertainment"
      ? "Future Night Entertainment"
      : "Future Night Cultural Highlights"
    : "Future Evening Selection";
  const planAheadEventSectionSubtitle = isPlanRoute
    ? planAheadCategory === "entertainment"
      ? "Shows, comedy, sports, and events worth planning your night around."
      : "Top event options for your selected date."
    : "Top options for your selected date, so you can plan before arrival.";
  const planAheadDestinationSectionTitle = isPlanRoute
    ? planAheadCategory === "food"
      ? "Dining Worth Booking"
      : planAheadCategory === "destinations"
        ? "Destinations To Bookmark"
        : "Near FORTH For Your Stay"
    : "Near FORTH For Your Stay";
  const planAheadDestinationSectionSubtitle = isPlanRoute
    ? planAheadCategory === "food"
      ? "Restaurants, bars, and rooftops aligned to your date."
      : planAheadCategory === "destinations"
        ? "Neighborhood-led places to anchor your stay."
        : "Dining, drinks, and neighborhood options to bookmark before check-in."
    : "Dining, drinks, and neighborhood options to bookmark before check-in.";
  const focusEventPool = useMemo(() => {
    if (planAheadCategory === "destinations") return [];

    const modeEvents = effectiveDiscoveryMode === "future"
      ? (selectedFutureDate ? allEventPool.filter((event) => event.start_date === selectedFutureDate) : [])
      : (tonightSection?.events || []);

    const daypartFiltered = selectedDaypart === "all"
      ? modeEvents
      : modeEvents.filter((event) => matchesEventDaypart(event, selectedDaypart));

    return daypartFiltered.filter((event) => matchesPlanAheadCategoryForEvent(event, planAheadCategory));
  }, [allEventPool, effectiveDiscoveryMode, planAheadCategory, selectedDaypart, selectedFutureDate, tonightSection]);
  const focusDestinationPool = useMemo(() => {
    const modeDestinations = effectiveDiscoveryMode === "future" ? rankedDestinations : rankedLiveDestinations;
    const daypartFiltered = selectedDaypart === "all"
      ? modeDestinations
      : modeDestinations.filter((destination) => matchesDestinationDaypart(destination, selectedDaypart));

    return daypartFiltered.filter((destination) => (
      matchesPlanAheadCategoryForDestination(destination, planAheadCategory)
    ));
  }, [effectiveDiscoveryMode, planAheadCategory, rankedDestinations, rankedLiveDestinations, selectedDaypart]);
  const discoveryFocusMatchCounts = useMemo(() => {
    const counts = new Map<DiscoveryFocusId, number>();

    for (const focus of DISCOVERY_FOCUS_OPTIONS) {
      if (focus.id === "any") {
        counts.set(focus.id, focusEventPool.length + focusDestinationPool.length);
        continue;
      }

      const eventMatches = focusEventPool.filter((event) => matchesEventFocus(event, focus)).length;
      const destinationMatches = focusDestinationPool.filter((destination) => matchesDestinationFocus(destination, focus)).length;
      counts.set(focus.id, eventMatches + destinationMatches);
    }

    return counts;
  }, [focusDestinationPool, focusEventPool]);
  const foodDrinkFocusMatchCounts = useMemo(() => {
    const counts = new Map<FoodDrinkFocusId, number>();

    for (const focus of FOOD_DRINK_FOCUS_OPTIONS) {
      if (focus.id === "any") {
        counts.set(focus.id, focusDestinationPool.length);
        continue;
      }

      const destinationMatches = focusDestinationPool.filter((destination) => matchesFoodDrinkFocus(destination, focus)).length;
      counts.set(focus.id, destinationMatches);
    }

    return counts;
  }, [focusDestinationPool]);
  const destinationVibeMatchCounts = useMemo(() => {
    const counts = new Map<DestinationVibeId, number>();
    for (const option of DESTINATION_VIBE_OPTIONS) {
      if (option.id === "any") {
        counts.set(option.id, focusDestinationPool.length);
        continue;
      }
      const matches = focusDestinationPool.filter((destination) => matchesDestinationVibe(destination, option.id)).length;
      counts.set(option.id, matches);
    }
    return counts;
  }, [focusDestinationPool]);
  const showPersonaSelector = !isDiningRoute;
  const showMoodSelector = !isDiningRoute;
  const setupLabel = isPlanRoute ? "Stay Preferences" : isDiningRoute ? "Dining Preferences" : "Concierge Preferences";
  const setupTitle = "How can we help?";
  const setupSubtitle = isPlanRoute
    ? "Choose your date and preferences so we can surface events and places worth reserving before arrival."
    : isDiningRoute
      ? "Choose your dining style first. We will tune recommendations to bars, restaurants, and rooftops that fit."
      : "Choose guest profile, mood, and craving. Recommendations below adapt to your evening.";
  const signalRecencyLabel = freshestSignalHours === null
    ? "Verification in progress"
    : freshestSignalHours === 0
      ? "Verified moments ago"
      : `Verified ${freshestSignalHours}h ago`;
  const preferencePromptTitle = "How can we help?";
  const preferencePromptSubtitle = "Tell us what you are looking for, and we will adapt recommendations in real time.";
  const liveBriefSummary = useMemo(() => {
    const timingLabel = effectiveDiscoveryMode === "future"
      ? (selectedFutureDate ? `For ${formatDateChip(selectedFutureDate)}` : "For a future date")
      : selectedDaypartLabel === "Any Time"
        ? "For right now"
        : `For ${selectedDaypartLabel.toLowerCase()}`;
    const categoryLabel = planAheadCategory === "all"
      ? "Across all categories"
      : planAheadCategory === "food"
        ? "Focused on food and drink"
        : planAheadCategory === "entertainment"
          ? "Focused on events and entertainment"
          : "Focused on destinations";
    const focusLabel = planAheadCategory === "food"
      ? activeFoodDrinkFocus.label
      : planAheadCategory === "destinations"
        ? activeDestinationVibe.label
        : activeDiscoveryFocus.label;
    const focusNote = focusLabel === "Surprise Me"
      ? "Broad curation"
      : focusLabel;
    return `${timingLabel} · ${categoryLabel} · ${focusNote}`;
  }, [
    activeDestinationVibe.label,
    activeDiscoveryFocus.label,
    activeFoodDrinkFocus.label,
    effectiveDiscoveryMode,
    planAheadCategory,
    selectedDaypartLabel,
    selectedFutureDate,
  ]);
  const sectionJumpLinks = useMemo(() => {
    const links: Array<{ href: string; label: string; note: string }> = [];
    if (showFullExperience && !isStayMode) {
      links.push({ href: "#concierge-command-deck", label: "Guide", note: "Refine mood + timing" });
    }
    if (showOperate && planAheadShowsEvents && featuredEvents.length > 0) {
      links.push({ href: "#concierge-events", label: "Events", note: "Tonight's curation" });
    }
    if (showOperate && planAheadShowsDestinations && (explorationDestinations.length > 0 || fallbackExplorationDestinations.length > 0)) {
      links.push({ href: "#concierge-destinations", label: "Venues", note: "Nearby recommendations" });
    }
    if (showProperty) {
      links.push({ href: "#forth-signature-venues", label: "At FORTH", note: "House venues" });
    }
    if (showServiceLayer) {
      links.push({ href: "#guest-service-layer", label: "Services", note: "Room requests" });
    }
    return links;
  }, [
    explorationDestinations.length,
    fallbackExplorationDestinations.length,
    featuredEvents.length,
    isStayMode,
    planAheadShowsDestinations,
    planAheadShowsEvents,
    showFullExperience,
    showOperate,
    showProperty,
    showServiceLayer,
  ]);
  const liveSelectionSuggestions = useMemo<LiveSuggestion[]>(() => {
    const suggestions: LiveSuggestion[] = [];
    suggestions.push({
      id: `live-brief-${effectiveDiscoveryMode}-${planAheadCategory}-${selectedDaypart}-${discoveryFocusId}-${foodDrinkFocusId}-${destinationVibeId}`,
      label: "Your Current Brief",
      note: liveBriefSummary,
      href: briefingPath,
      cta: "Open brief",
    });

    if (topFeaturedEvent) {
      const eventNote = effectiveDiscoveryMode === "future"
        ? (selectedFutureDate ? `Featured for ${formatDateChip(selectedFutureDate)}` : "Featured for your selected stay date")
        : `${selectedDaypartLabel} event match`;
      suggestions.push({
        id: `live-event-${topFeaturedEvent.id}`,
        label: topFeaturedEvent.title,
        note: topFeaturedEvent.venue_name ? `${eventNote} at ${topFeaturedEvent.venue_name}` : eventNote,
        href: resolveEventHref(portal.slug, topFeaturedEvent),
        cta: "View event",
      });
    }

    const leadDestination = explorationDestinations[0] || fallbackExplorationDestinations[0];
    if (leadDestination) {
      const leadDetail = leadDestination.top_special?.title
        || leadDestination.venue.short_description
        || "Nearby concierge recommendation";
      suggestions.push({
        id: `live-destination-${leadDestination.venue.id}`,
        label: leadDestination.venue.name,
        note: `${leadDestination.proximity_label} · ${leadDetail}`,
        href: resolveDestinationHref(portal.slug, leadDestination),
        cta: "View venue",
      });
    }

    if (suggestions.length < 3) {
      if (planAheadCategory === "food" && activeFoodDrinkFocus.id !== "any") {
        suggestions.push({
          id: `live-food-focus-${activeFoodDrinkFocus.id}`,
          label: `${activeFoodDrinkFocus.label} Matches`,
          note: "Open venues aligned to your current dining preference.",
          href: `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeFoodDrinkFocus.searchQuery)}`,
          cta: "View matches",
        });
      } else if (planAheadCategory === "destinations" && activeDestinationVibe.id !== "any") {
        suggestions.push({
          id: `live-destination-focus-${activeDestinationVibe.id}`,
          label: `${activeDestinationVibe.label} Matches`,
          note: "Open destinations aligned to your current place preference.",
          href: `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeDestinationVibe.searchQuery)}`,
          cta: "View matches",
        });
      } else if (activeDiscoveryFocus.id !== "any") {
        suggestions.push({
          id: `live-discovery-focus-${activeDiscoveryFocus.id}`,
          label: `${activeDiscoveryFocus.label} Matches`,
          note: "Open events tuned to your current mood selection.",
          href: `/${portal.slug}?view=find&type=events&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`,
          cta: "View matches",
        });
      } else if (quickActions[0]) {
        suggestions.push({
          id: `live-action-${quickActions[0].label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          label: quickActions[0].label,
          note: quickActions[0].note,
          href: quickActions[0].href,
          cta: "Open",
        });
      }
    }

    if (suggestions.length < 3) {
      suggestions.push({
        id: "live-brief",
        label: "Save This Curation",
        note: "Keep this exact preference mix for your stay or share with your guest.",
        href: briefingPath,
        cta: "Open brief",
      });
    }

    return suggestions.slice(0, 3);
  }, [
    activeDestinationVibe.id,
    activeDestinationVibe.label,
    activeDestinationVibe.searchQuery,
    activeDiscoveryFocus.id,
    activeDiscoveryFocus.label,
    activeDiscoveryFocus.searchQuery,
    activeFoodDrinkFocus.id,
    activeFoodDrinkFocus.label,
    activeFoodDrinkFocus.searchQuery,
    briefingPath,
    destinationVibeId,
    discoveryFocusId,
    effectiveDiscoveryMode,
    explorationDestinations,
    fallbackExplorationDestinations,
    foodDrinkFocusId,
    liveBriefSummary,
    planAheadCategory,
    portal.slug,
    quickActions,
    selectedDaypart,
    selectedDaypartLabel,
    selectedFutureDate,
    topFeaturedEvent,
  ]);
  const visualDiscoveryFocuses = useMemo(
    () => DISCOVERY_FOCUS_VISUAL_ORDER
      .map((id) => DISCOVERY_FOCUS_OPTIONS.find((focus) => focus.id === id))
      .filter((focus): focus is DiscoveryFocus => Boolean(focus))
      .filter((focus) => focus.id === "any" || (discoveryFocusMatchCounts.get(focus.id) || 0) > 0),
    [discoveryFocusMatchCounts]
  );
  const visualFoodDrinkFocuses = useMemo(
    () => FOOD_DRINK_FOCUS_VISUAL_ORDER
      .map((id) => FOOD_DRINK_FOCUS_OPTIONS.find((focus) => focus.id === id))
      .filter((focus): focus is FoodDrinkFocus => Boolean(focus))
      .filter((focus) => focus.id === "any" || (foodDrinkFocusMatchCounts.get(focus.id) || 0) > 0),
    [foodDrinkFocusMatchCounts]
  );
  const visualDestinationVibes = useMemo(
    () => DESTINATION_VIBE_VISUAL_ORDER
      .map((id) => DESTINATION_VIBE_OPTIONS.find((option) => option.id === id))
      .filter((option): option is DestinationVibe => Boolean(option))
      .filter((option) => option.id === "any" || (destinationVibeMatchCounts.get(option.id) || 0) > 0),
    [destinationVibeMatchCounts]
  );
  const foodSecondaryChoices = useMemo(
    () => visualFoodDrinkFocuses.filter((focus) => focus.id !== "any").slice(0, 4),
    [visualFoodDrinkFocuses]
  );
  const entertainmentSecondaryChoices = useMemo(
    () => visualDiscoveryFocuses.filter((focus) => focus.id !== "any").slice(0, 4),
    [visualDiscoveryFocuses]
  );
  const destinationSecondaryChoices = useMemo(
    () => visualDestinationVibes.filter((option) => option.id !== "any").slice(0, 4),
    [visualDestinationVibes]
  );

  useEffect(() => {
    if (visualDiscoveryFocuses.some((focus) => focus.id === discoveryFocusId)) return;
    setDiscoveryFocusId("any");
  }, [discoveryFocusId, visualDiscoveryFocuses]);

  useEffect(() => {
    if (visualFoodDrinkFocuses.some((focus) => focus.id === foodDrinkFocusId)) return;
    setFoodDrinkFocusId("any");
  }, [foodDrinkFocusId, visualFoodDrinkFocuses]);

  useEffect(() => {
    if (planAheadCategory !== "destinations" && destinationVibeId !== "any") {
      setDestinationVibeId("any");
      return;
    }
    if (visualDestinationVibes.some((option) => option.id === destinationVibeId)) return;
    setDestinationVibeId("any");
  }, [destinationVibeId, planAheadCategory, visualDestinationVibes]);

  useEffect(() => {
    if (isPlanRoute && discoveryMode !== "future") {
      setDiscoveryMode("future");
    }
    if (!isPlanRoute && !isStayMode && discoveryMode === "future" && !hasFutureNights) {
      setDiscoveryMode("tonight");
    }
    if (isPlanRoute && !isStayMode && experienceView !== "operate") {
      setExperienceView("operate");
    }
    if (isClubRoute && visitorPersona !== "club_member") {
      setVisitorPersona("club_member");
    }
    if (isClubRoute && !isStayMode && experienceView !== "explore") {
      setExperienceView("explore");
    }
    if (isDiningRoute && !isStayMode && experienceView !== "explore") {
      setExperienceView("explore");
    }
    if (isDiningRoute && foodDrinkFocusId === "any") {
      setFoodDrinkFocusId("cocktails");
    }
  }, [discoveryMode, experienceView, foodDrinkFocusId, hasFutureNights, isClubRoute, isDiningRoute, isPlanRoute, isStayMode, visitorPersona]);

  if (loading) {
    return <ForthLoadingSkeleton />;
  }

  return (
    <div data-forth-experience="true" className="relative min-h-screen bg-[var(--hotel-ivory)] overflow-x-clip">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(212,175,122,0.11),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(201,168,138,0.08),transparent_32%),linear-gradient(180deg,rgba(253,251,247,1)_0%,rgba(253,251,247,0.985)_36%,rgba(247,245,240,0.95)_100%)]" />

      <div className="relative">
        <HotelHeader portalSlug={portal.slug} portalName={portal.name} logoUrl={logoUrl} showStayLink useForthNav />

        <main className="max-w-[1240px] mx-auto px-4 sm:px-5 md:px-8 py-6 sm:py-8 md:py-12 overflow-x-clip">
          <section id="concierge-top" className="mb-7 md:mb-10">
            <div className={`relative min-w-0 overflow-hidden text-white p-5 sm:p-6 md:p-8 lg:p-10 ${FORTH_PANEL_CLASS} shadow-[0_26px_60px_rgba(19,16,12,0.34)]`}>
              <ResilientImage
                sources={[HERO_PHOTOS_BY_DAYPART[dayPart], ...FORTH_IMAGE_FALLBACKS]}
                alt="FORTH guest experience backdrop"
                sizes="(max-width: 1280px) 100vw, 1280px"
                className="absolute inset-0 h-full w-full object-cover forth-zoom-image"
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(12,10,9,0.8),rgba(19,16,14,0.86),rgba(12,11,10,0.93))]" />

              <div className="relative z-10">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--hotel-champagne)] mb-2">FORTH Concierge</p>
                <div className="max-w-3xl">
                  <h1 className="font-display text-[2rem] sm:text-4xl md:text-5xl leading-tight mb-3">
                    {isStayMode
                      ? "Stay At FORTH"
                      : isDiningRoute
                        ? "Dining + Drinks At FORTH"
                        : isClubRoute
                          ? "FORTH Club Concierge"
                      : effectiveDiscoveryMode === "future"
                        ? "Plan Your FORTH Stay"
                        : heroTitle}
                  </h1>
                  <p className="text-[14px] sm:text-sm md:text-base text-white/75 max-w-[56ch] leading-relaxed">
                    {isStayMode
                      ? "Restaurants, bars, amenities, and in-room services in one polished property view."
                      : isDiningRoute
                        ? "From cocktails to late-night tables, discover where to eat and drink with confidence."
                        : isClubRoute
                          ? "Member-led recommendations, guest policy context, and strongest club-adjacent picks."
                      : effectiveDiscoveryMode === "future"
                        ? "Pick your future date, explore events, and line up restaurants before arrival."
                        : heroSubtitle}
                  </p>

                  <div className="mt-5 sm:mt-6 flex flex-wrap gap-2">
                    <a
                      href={conciergePhoneLink}
                      className="rounded-full border border-white/18 bg-white/8 px-3.5 py-2 text-[10px] uppercase tracking-[0.13em] text-white/88 hover:bg-white/14 transition-colors"
                    >
                      Concierge Desk
                    </a>
                    <a
                      href={`sms:${conciergePhoneLink.replace("tel:", "")}`}
                      className="rounded-full border border-white/18 bg-white/8 px-3.5 py-2 text-[10px] uppercase tracking-[0.13em] text-white/88 hover:bg-white/14 transition-colors"
                    >
                      Message Desk
                    </a>
                    <a
                      href={isStayMode ? "#guest-service-layer" : `/${portal.slug}/stay#guest-service-layer`}
                      className="rounded-full border border-white/18 bg-white/8 px-3.5 py-2 text-[10px] uppercase tracking-[0.13em] text-white/88 hover:bg-white/14 transition-colors"
                    >
                      In-Room Service
                    </a>
                  </div>
                </div>

                <div className="mt-6 sm:mt-7 grid gap-3 sm:gap-4 xl:grid-cols-[0.8fr_1.2fr]">
                  <div className="rounded-xl border border-white/16 bg-black/20 p-3.5 sm:p-4 backdrop-blur-sm">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/68">Curation Signal</p>
                    <p className="mt-2 text-sm text-white/86">
                      Confidence, proximity, and recency are balanced to support confident choices.
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.13em] text-[var(--hotel-champagne)]">{signalRecencyLabel}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/16 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/82">
                        High confidence: {highConfidenceDestinationCount}
                      </span>
                      <span className="rounded-full border border-white/16 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/82">
                        Verified &lt;24h: {verifiedWithinDayCount}
                      </span>
                      <span className="rounded-full border border-white/16 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/82">
                        Walkable: {walkableDestinationCount}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/15 bg-white/5 p-3 sm:p-3.5 md:p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/65">{decisionStackLabel}</p>
                      <span className="text-[10px] uppercase tracking-[0.13em] text-white/55">Three suggestions</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {quickActions.map((action, index) => (
                        <Link
                          key={action.label}
                          href={action.href}
                          className="group flex items-start justify-between gap-3 rounded-lg border border-white/16 bg-black/15 px-3 py-3 hover:bg-white/12 transition-colors"
                        >
                          <div>
                            <p className="text-sm text-white/92">
                              <span className="text-white/60 mr-2">{index + 1}.</span>
                              {action.label}
                            </p>
                            <p className="mt-0.5 text-xs text-white/62">{action.note}</p>
                          </div>
                          <span className="pt-1 text-xs text-white/55 group-hover:text-white/78 transition-colors">Open</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {sectionJumpLinks.length > 0 && (
            <section className="mb-7 md:mb-10">
              <nav className={`sticky top-[4.7rem] md:top-[5.4rem] z-30 p-1 ${FORTH_PANEL_SOFT_CLASS}`}>
                <div className="flex items-center gap-2 overflow-x-auto overflow-y-hidden scroll-touch scrollbar-hide px-1 py-1">
                  {sectionJumpLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      className="group flex-shrink-0 rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3.5 py-2 text-left hover:border-[var(--hotel-champagne)] transition-colors"
                    >
                      <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)]">{link.label}</p>
                      <p className="text-[10px] text-[var(--hotel-stone)] group-hover:text-[var(--hotel-charcoal)] transition-colors">{link.note}</p>
                    </a>
                  ))}
                </div>
              </nav>
            </section>
          )}

          {showFullExperience && !isStayMode && (
            <section id="concierge-property-preview" className="mb-8 md:mb-10">
              <div className={`min-w-0 p-4 sm:p-5 md:p-6 ${FORTH_PANEL_CLASS}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--hotel-stone)]">At FORTH</p>
                    <h2 className="font-display text-[1.7rem] md:text-3xl text-[var(--hotel-charcoal)] mt-1">At FORTH</h2>
                    <p className="mt-2 text-xs text-[var(--hotel-stone)] max-w-[38ch]">
                      Signature dining, bars, and amenities linked directly to your stay.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <TrustChip label="High confidence" value={`${highConfidenceDestinationCount}`} />
                      <TrustChip label="Verified <24h" value={`${verifiedWithinDayCount}`} />
                      <TrustChip label="Walkable" value={`${walkableDestinationCount}`} />
                      {freshestSignalHours !== null && <TrustChip label="Freshest signal" value={`${freshestSignalHours}h ago`} />}
                    </div>
                  </div>
                  <Link
                    href={`/${portal.slug}/stay`}
                    className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-champagne)] hover:text-[var(--hotel-charcoal)] transition-colors"
                  >
                    Open Stay Page
                  </Link>
                </div>

                <HotelCarousel className="mt-4">
                  {topAmenityPreviewItems.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      className="group flex-shrink-0 snap-start w-[82vw] max-w-[280px] sm:w-[280px] overflow-hidden rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] shadow-[var(--hotel-shadow-soft)] hover:border-[var(--hotel-champagne)] transition-all forth-hover-lift"
                    >
                      <div className="relative aspect-[16/10]">
                        <ResilientImage
                          sources={item.imageSources}
                          alt={item.title}
                          sizes="(max-width: 640px) 82vw, 280px"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 forth-zoom-image"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
                        <div className="absolute left-3 top-3">
                          <span className="rounded-full bg-black/50 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-champagne)]">
                            {item.badge}
                          </span>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="font-display text-xl text-[var(--hotel-charcoal)] leading-tight">{item.title}</p>
                        <p className="mt-1 text-xs text-[var(--hotel-stone)] line-clamp-2">{item.subtitle}</p>
                      </div>
                    </Link>
                  ))}
                </HotelCarousel>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/${portal.slug}/stay#forth-signature-venues`}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Dining + Bars
                  </Link>
                  <Link
                    href={`/${portal.slug}/stay#forth-amenities`}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Amenities
                  </Link>
                  <Link
                    href={`/${portal.slug}/stay#guest-service-layer`}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    In-Room Service
                  </Link>
                </div>
              </div>
            </section>
          )}

          {showFullExperience && !isStayMode && (
            <section id="concierge-command-deck" className={`mb-10 md:mb-12 p-4 sm:p-5 md:p-6 ${FORTH_PANEL_SOFT_CLASS}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Concierge</p>
                  <h2 className="font-display text-[1.7rem] md:text-3xl text-[var(--hotel-charcoal)] mt-1">{preferencePromptTitle}</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2">
                    {preferencePromptSubtitle}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] shadow-[var(--hotel-shadow-soft)]">
                    {effectiveDiscoveryMode === "future" ? "Another date" : "Tonight"}
                  </span>
                  <span className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] shadow-[var(--hotel-shadow-soft)]">
                    {selectedDaypartLabel}
                  </span>
                  <span className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] shadow-[var(--hotel-shadow-soft)]">
                    {featuredEvents.length} events
                  </span>
                  <span className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] shadow-[var(--hotel-shadow-soft)]">
                    {explorationDestinations.length} venues
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(250,247,241,0.95)_100%)] px-3 py-3 shadow-[var(--hotel-shadow-soft)]">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">When</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDiscoveryMode("tonight")}
                      disabled={isPlanRoute}
                      className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors ${
                        effectiveDiscoveryMode === "tonight"
                          ? "bg-[linear-gradient(135deg,var(--hotel-charcoal),#2c241b)] text-[var(--hotel-cream)] shadow-[0_8px_16px_rgba(18,14,10,0.24)]"
                          : isPlanRoute
                            ? "border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] text-[var(--hotel-stone)] opacity-60 cursor-not-allowed"
                            : "border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                      }`}
                    >
                      Tonight
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscoveryMode("future")}
                      disabled={!hasFutureNights}
                      className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors ${
                        effectiveDiscoveryMode === "future"
                          ? "bg-[linear-gradient(135deg,var(--hotel-charcoal),#2c241b)] text-[var(--hotel-cream)] shadow-[0_8px_16px_rgba(18,14,10,0.24)]"
                          : !hasFutureNights
                            ? "border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] text-[var(--hotel-stone)] opacity-60 cursor-not-allowed"
                            : "border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                      }`}
                    >
                      Another date
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(250,247,241,0.95)_100%)] px-3 py-3 shadow-[var(--hotel-shadow-soft)]">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">Looking for</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PLAN_AHEAD_CATEGORY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setPlanAheadCategory(option.id)}
                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors ${
                          planAheadCategory === option.id
                            ? "bg-[linear-gradient(135deg,var(--hotel-charcoal),#2c241b)] text-[var(--hotel-cream)] shadow-[0_8px_16px_rgba(18,14,10,0.24)]"
                            : "border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[linear-gradient(180deg,rgba(255,255,255,0.85)_0%,rgba(250,247,241,0.95)_100%)] px-3 py-3 shadow-[var(--hotel-shadow-soft)]">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">Time of day</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CONCIERGE_DAYPART_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedDaypart(option.id)}
                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors ${
                          selectedDaypart === option.id
                            ? "bg-[linear-gradient(135deg,var(--hotel-charcoal),#2c241b)] text-[var(--hotel-cream)] shadow-[0_8px_16px_rgba(18,14,10,0.24)]"
                            : "border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {hasFutureNights && effectiveDiscoveryMode === "future" ? (
                <>
                  <OptionRail className="mt-5">
                    {futureNightDates.map((dateValue) => (
                      <button
                        key={dateValue}
                        type="button"
                        onClick={() => setFutureDate(dateValue)}
                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors whitespace-nowrap ${
                          selectedFutureDate === dateValue
                            ? "bg-[linear-gradient(135deg,var(--hotel-champagne),#e4c89a)] text-[var(--hotel-ink)] shadow-[0_8px_16px_rgba(110,84,48,0.26)]"
                            : "border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                        }`}
                      >
                        {formatDateChip(dateValue)}
                      </button>
                    ))}
                  </OptionRail>
                </>
              ) : effectiveDiscoveryMode === "future" ? (
                <p className="mt-4 text-sm text-[var(--hotel-stone)]">
                  Future-stay event data has not loaded yet. You can still browse destinations below.
                </p>
              ) : null}

              {liveSelectionSuggestions.length > 0 && (
                <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-4 shadow-[var(--hotel-shadow-soft)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Suggested For You</p>
                      <p className="text-xs text-[var(--hotel-stone)] mt-1">
                        These recommendations update as you adjust timing, category, and daypart.
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-charcoal)]">
                      Live
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {liveSelectionSuggestions.map((suggestion) => (
                      <Link
                        key={suggestion.id}
                        href={suggestion.href}
                        className="group rounded-lg border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-3 hover:border-[var(--hotel-champagne)] transition-colors"
                      >
                        <p className="text-sm font-medium text-[var(--hotel-charcoal)]">{suggestion.label}</p>
                        <p className="mt-1 text-xs text-[var(--hotel-stone)] line-clamp-2">{suggestion.note}</p>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] group-hover:text-[var(--hotel-champagne)] transition-colors">
                          {suggestion.cta}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {planAheadCategory === "food" && foodSecondaryChoices.length > 0 && (
                <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Food + Drink Style</p>
                      <p className="text-xs text-[var(--hotel-stone)] mt-1">Only showing styles with live content now.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFoodDrinkFocusId("any")}
                      className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] transition-colors ${
                        foodDrinkFocusId === "any"
                          ? "border-[var(--hotel-charcoal)] bg-[var(--hotel-charcoal)] text-[var(--hotel-cream)]"
                          : "border-[var(--hotel-sand)] bg-[var(--hotel-cream)] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)]"
                      }`}
                    >
                      Surprise me
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {foodSecondaryChoices.map((focus) => {
                      const visual = FOOD_DRINK_FOCUS_VISUALS[focus.id];
                      return (
                        <ChoiceCard
                          key={focus.id}
                          label={focus.label}
                          hint={focus.hint}
                          eyebrow={visual.eyebrow}
                          selected={foodDrinkFocusId === focus.id}
                          sources={[...visual.sources, ...FORTH_IMAGE_FALLBACKS]}
                          onClick={() => setFoodDrinkFocusId(focus.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {planAheadCategory === "entertainment" && entertainmentSecondaryChoices.length > 0 && (
                <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Entertainment Style</p>
                      <p className="text-xs text-[var(--hotel-stone)] mt-1">Choose a lane and we will narrow events and nearby options.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDiscoveryFocusId("any")}
                      className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] transition-colors ${
                        discoveryFocusId === "any"
                          ? "border-[var(--hotel-charcoal)] bg-[var(--hotel-charcoal)] text-[var(--hotel-cream)]"
                          : "border-[var(--hotel-sand)] bg-[var(--hotel-cream)] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)]"
                      }`}
                    >
                      Surprise me
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {entertainmentSecondaryChoices.map((focus) => {
                      const visual = DISCOVERY_FOCUS_VISUALS[focus.id];
                      return (
                        <ChoiceCard
                          key={focus.id}
                          label={focus.label}
                          hint={focus.hint}
                          eyebrow={visual.eyebrow}
                          selected={discoveryFocusId === focus.id}
                          sources={[...visual.sources, ...FORTH_IMAGE_FALLBACKS]}
                          onClick={() => setDiscoveryFocusId(focus.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {planAheadCategory === "destinations" && destinationSecondaryChoices.length > 0 && (
                <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Destination Style</p>
                      <p className="text-xs text-[var(--hotel-stone)] mt-1">Pick a destination lane and we will tailor nearby rails.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDestinationVibeId("any")}
                      className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] transition-colors ${
                        destinationVibeId === "any"
                          ? "border-[var(--hotel-charcoal)] bg-[var(--hotel-charcoal)] text-[var(--hotel-cream)]"
                          : "border-[var(--hotel-sand)] bg-[var(--hotel-cream)] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)]"
                      }`}
                    >
                      Surprise me
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {destinationSecondaryChoices.map((option) => (
                      <ChoiceCard
                        key={option.id}
                        label={option.label}
                        hint={option.hint}
                        eyebrow={option.eyebrow}
                        selected={destinationVibeId === option.id}
                        sources={[...option.sources, ...FORTH_IMAGE_FALLBACKS]}
                        onClick={() => setDestinationVibeId(option.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {showStudioPanelToggle && (
            <section className="mb-10 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Admin Only</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">Studio Controls</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2">
                    Advanced tuning controls are hidden by default so this page stays guest-first during demos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStudioPanel((current) => !current)}
                  className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-charcoal)] px-4 py-2 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-cream)] hover:border-[var(--hotel-champagne)] transition-colors"
                >
                  {showStudioPanel ? "Hide Advanced Controls" : "Open Advanced Controls"}
                </button>
              </div>
            </section>
          )}

          {showGuidedSetup && (
            <section className="mb-10 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-soft)] overflow-x-clip">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">{setupLabel}</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">{setupTitle}</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2 max-w-2xl">
                    {setupSubtitle}
                  </p>
                </div>
                {showExperienceSwitcher && (
                  <div className="w-full md:w-auto md:max-w-[430px] min-w-0">
                    <OptionRail>
                      {experienceOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setExperienceView(option.id)}
                          className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors whitespace-nowrap ${
                            experienceView === option.id
                              ? "bg-[var(--hotel-charcoal)] text-[var(--hotel-cream)]"
                              : "border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </OptionRail>
                  </div>
                )}
              </div>
              {showStudioControls && (
                <p className="mt-3 text-xs text-[var(--hotel-stone)]">{activeView.hint}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {showPersonaSelector && <SummaryChip label="Guest" value={activePersona.label} />}
                {showMoodSelector && <SummaryChip label="Mood" value={activeDiscoveryFocus.label} />}
                <SummaryChip
                  label={isPlanRoute ? "Reserve Around" : "Craving"}
                  value={activeFoodDrinkFocus.label}
                />
                {showStudioControls && <SummaryChip label="Pace" value={activeCuratorMode.label} />}
              </div>

              {showStudioControls && agentJourney && (
                <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Guest Journey</p>
                  <h3 className="font-display text-xl text-[var(--hotel-charcoal)] mt-1">{agentJourney.title}</h3>
                  <div className="mt-3 grid md:grid-cols-3 gap-3">
                    {agentJourney.steps.map((step, index) => (
                      <div key={`${step.title}-${index}`} className="rounded-lg border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Step {index + 1}</p>
                        <p className="text-sm font-medium text-[var(--hotel-charcoal)] mt-1">{step.title}</p>
                        <p className="text-xs text-[var(--hotel-stone)] mt-1">{step.detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <a
                      href="#itinerary-composer"
                      onClick={() => setExperienceView("operate")}
                      className="inline-flex rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-charcoal)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-cream)] hover:border-[var(--hotel-champagne)] transition-colors"
                    >
                      {agentJourney.primaryAction}
                    </a>
                  </div>
                </div>
              )}

              <div className={`mt-5 grid gap-5 ${showPersonaSelector || showStudioControls ? "xl:grid-cols-[1fr_1.25fr]" : "xl:grid-cols-1"}`}>
                {(showPersonaSelector || showStudioControls) && (
                  <div className="min-w-0 space-y-4">
                    {showPersonaSelector && (
                      <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Who Is This For?</p>
                        <OptionRail className="mt-2">
                          {PERSONA_PROFILES.map((persona) => (
                            <button
                              key={persona.id}
                              type="button"
                              onClick={() => applyPersonaProfile(persona)}
                              className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors whitespace-nowrap ${
                                visitorPersona === persona.id
                                  ? "bg-[var(--hotel-charcoal)] text-[var(--hotel-cream)]"
                                  : "border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                              }`}
                            >
                              {persona.label}
                            </button>
                          ))}
                        </OptionRail>
                        <p className="mt-2 text-xs text-[var(--hotel-stone)]">{activePersona.sublabel}</p>
                      </div>
                    )}

                    {showStudioControls && (
                      <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Express Plans</p>
                        <p className="mt-2 text-sm text-[var(--hotel-stone)]">
                          Curated bundles for guests who prefer a graceful starting point.
                        </p>
                        <div className="mt-3 flex w-full min-w-0 gap-3 overflow-x-auto overflow-y-hidden scroll-touch scrollbar-hide pb-1 pr-2 sm:pr-4">
                          {COMMAND_BUNDLES.map((bundle) => (
                            <button
                              key={bundle.id}
                              type="button"
                              onClick={() => applyCommandBundle(bundle)}
                              className={`rounded-xl border px-4 py-3 text-left transition-colors forth-hover-lift min-w-[72vw] max-w-[82vw] sm:min-w-[220px] sm:max-w-none md:min-w-[240px] flex-shrink-0 ${
                                activeBundleId === bundle.id
                                  ? "border-[var(--hotel-champagne)] bg-[var(--hotel-ivory)]"
                                  : "border-[var(--hotel-sand)] bg-[var(--hotel-cream)] hover:border-[var(--hotel-champagne)]"
                              }`}
                            >
                              <p className="font-display text-xl text-[var(--hotel-charcoal)] leading-tight">{bundle.label}</p>
                              <p className="text-xs text-[var(--hotel-stone)] mt-1">{bundle.description}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="min-w-0 space-y-4">
                  {showMoodSelector && (
                    <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">
                        {isPlanRoute ? "What Do You Want To Do?" : "Current Mood"}
                      </p>
                      <p className="mt-2 text-sm text-[var(--hotel-stone)] max-w-3xl">
                        {isPlanRoute
                          ? "Choose the kind of events or energy you want so we can tune future-stay recommendations."
                          : "Choose the kind of experience you want and we will prioritize matching events and destinations."}
                      </p>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        {visualDiscoveryFocuses.map((focus) => {
                          const visual = DISCOVERY_FOCUS_VISUALS[focus.id];
                          return (
                            <ChoiceCard
                              key={focus.id}
                              label={focus.label}
                              hint={focus.hint}
                              eyebrow={visual.eyebrow}
                              selected={discoveryFocusId === focus.id}
                              sources={[...visual.sources, ...FORTH_IMAGE_FALLBACKS]}
                              onClick={() => setDiscoveryFocusId(focus.id)}
                            />
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-[var(--hotel-stone)]">{activeDiscoveryFocus.hint}</p>
                    </div>
                  )}

                  <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">
                      {isPlanRoute ? "Food + Drink To Book Around" : "Food + Drink Craving"}
                    </p>
                    <p className="mt-2 text-sm text-[var(--hotel-stone)] max-w-3xl">
                      {isPlanRoute
                        ? "Pick the dining vibe you want nearby so reservation-friendly recommendations stay relevant."
                        : "Choose what sounds best right now and we will tune the nearby recommendations."}
                    </p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                      {visualFoodDrinkFocuses.map((focus) => {
                        const visual = FOOD_DRINK_FOCUS_VISUALS[focus.id];
                        return (
                          <ChoiceCard
                            key={focus.id}
                            label={focus.label}
                            hint={focus.hint}
                            eyebrow={visual.eyebrow}
                            selected={foodDrinkFocusId === focus.id}
                            sources={[...visual.sources, ...FORTH_IMAGE_FALLBACKS]}
                            onClick={() => setFoodDrinkFocusId(focus.id)}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-[var(--hotel-stone)]">{activeFoodDrinkFocus.hint}</p>
                  </div>

                  {showStudioControls && (
                    <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Experience Tempo</p>
                      <p className="mt-2 text-sm text-[var(--hotel-stone)] max-w-3xl">
                        Select how adventurous the recommendations should be.
                      </p>
                      <div className="mt-3 grid md:grid-cols-3 gap-3">
                        {CURATOR_MODES.map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => applyCuratorModeProfile(mode.id)}
                            className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                              curatorModeId === mode.id
                                ? "border-[var(--hotel-charcoal)] bg-[var(--hotel-ivory)]"
                                : "border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] hover:border-[var(--hotel-champagne)]"
                            }`}
                          >
                            <p className="font-display text-xl text-[var(--hotel-charcoal)] leading-tight">{mode.label}</p>
                            <p className="text-xs text-[var(--hotel-stone)] mt-1">{mode.hint}</p>
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-[var(--hotel-stone)]">{activeCuratorMode.hint}</p>
                      {rankedPlanCandidates.length > 0 && (
                        <div className="mt-3 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-3">
                          <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Suggested Sequence</p>
                          <ol className="mt-2 space-y-1.5">
                            {rankedPlanCandidates.slice(0, 3).map((candidate, index) => (
                              <li key={candidate.id} className="flex items-center justify-between gap-3 text-sm">
                                <span className="text-[var(--hotel-charcoal)]">
                                  {index + 1}. {candidate.title}
                                </span>
                                <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">
                                  {formatMinutes(candidate.etaMinutes)}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {showExtendedExploreToggle && (
            <section className="mb-12 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Optional</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">More Ways To Explore</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2">
                    Open this to see editorial layers, neighborhood routes, and deeper browsing sections.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExtendedExplore((current) => !current)}
                  className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-charcoal)] px-4 py-2 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-cream)] hover:border-[var(--hotel-champagne)] transition-colors"
                >
                  {showExtendedExplore ? "Hide Extra Sections" : "Open Extra Sections"}
                </button>
              </div>
            </section>
          )}

          {showExtendedExploreSections && visitorPersona === "club_member" && (
            <section className="mb-12 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">FORTH Club</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">Member Opportunities</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2 max-w-3xl">
                    Built from FORTH Club FAQ guidance: member guest allowances, wellness access, concierge privileges, and etiquette.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://atl.member.forthclub.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Member Login
                  </a>
                  <a
                    href="https://forthatlanta.com/club/inquire"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Inquire
                  </a>
                </div>
              </div>

              <div className="mt-4 grid md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Guest Access</p>
                  <p className="text-sm text-[var(--hotel-charcoal)] mt-1">Club + Wellness: up to 3 guests per visit. Pool: 1 guest per visit.</p>
                </div>
                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Member Perks</p>
                  <p className="text-sm text-[var(--hotel-charcoal)] mt-1">Priority reservations, dedicated concierge, and member hotel/event rates.</p>
                </div>
                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Club Etiquette</p>
                  <p className="text-sm text-[var(--hotel-charcoal)] mt-1">No calls in club spaces. No photos/video in Club or Wellness without permission.</p>
                </div>
                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Workday Note</p>
                  <p className="text-sm text-[var(--hotel-charcoal)] mt-1">Laptops/tablets are welcome at Bar, Lounge, and Terrace until 5:00 PM.</p>
                </div>
              </div>
            </section>
          )}

          {showExtendedExploreSections && visitorPersona !== "club_member" && (
            <section className="mb-12 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">FORTH Club Opportunity</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">Interested In Club Access?</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2">
                    Explore membership benefits, guest policy, and application steps if you want a deeper FORTH experience.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href="https://forthatlanta.com/club/faq"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Club FAQ
                  </a>
                  <a
                    href="https://forthatlanta.com/club/membership"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Apply
                  </a>
                </div>
              </div>
            </section>
          )}

          {showExtendedExploreSections && !isClubRoute && editorialMoments.length > 0 && (
            <section className="mb-14">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">FORTH Editorial Layer</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Property Atmosphere</h2>
                </div>
                <Link
                  href={`/${portal.slug}?view=find&type=destinations`}
                  className="text-xs uppercase tracking-[0.14em] text-[var(--hotel-champagne)]"
                >
                  Explore all
                </Link>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                {editorialMoments.map((moment) => (
                  <Link
                    key={moment.id}
                    href={moment.href}
                    className="group relative overflow-hidden rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] shadow-[var(--hotel-shadow-soft)] hover:border-[var(--hotel-champagne)] hover:shadow-[var(--hotel-shadow-medium)] transition-all forth-hover-lift"
                  >
                    <div className="relative aspect-[4/5]">
                      <ResilientImage
                        sources={[moment.imageSrc, ...FORTH_IMAGE_FALLBACKS]}
                        alt={moment.title}
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 forth-zoom-image"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-champagne)]">{moment.badge}</p>
                        <p className="font-display text-2xl text-white leading-tight mt-1">{moment.title}</p>
                        <p className="text-xs text-white/75 mt-2">{moment.subtitle}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {isBriefMode && (
            <section className="mb-14 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Shareable Summary</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">Concierge Snapshot</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2">
                    A clean view you can share with your guest or travel companion.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={printBrief}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyBriefingLink();
                    }}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    {copiedBriefing ? "Copied" : "Copy Link"}
                  </button>
                </div>
              </div>

              <div className="mt-4 grid md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">Intent</p>
                  <p className="text-sm text-[var(--hotel-charcoal)] mt-1">{activeIntent.label}</p>
                </div>
                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">Service Requests</p>
                  <p className="text-sm text-[var(--hotel-charcoal)] mt-1">{requestedServiceIds.length}</p>
                </div>
                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">Plan Stops</p>
                  <p className="text-sm text-[var(--hotel-charcoal)] mt-1">{selectedPlan.length}</p>
                </div>
              </div>
            </section>
          )}

          {showProperty && (
            <section id="forth-signature-venues" className="mb-14 grid xl:grid-cols-[1.45fr_1fr] gap-5">
            <div className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">FORTH Signature Venues</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Restaurants + Bars In-House</h2>
                </div>
                <Link
                  href={`/${portal.slug}?view=find&type=destinations&venue_type=restaurant,bar,rooftop`}
                  className="text-xs uppercase tracking-[0.14em] text-[var(--hotel-champagne)]"
                >
                  Property feed
                </Link>
              </div>
              <p className="text-sm text-[var(--hotel-stone)] mb-5">
                A guest-friendly mix of live destination data and curated property highlights for a polished demo experience.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {signatureVenueEntries.map(({ preset, destination }) => {
                  const isLive = destination?.special_state === "active_now";
                  const isSoon = destination?.special_state === "starting_soon";
                  const href = destination
                    ? resolveDestinationHref(portal.slug, destination)
                    : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(preset.name)}`;
                  const imageUrl = destination?.venue.image_url || null;
                  const imageCandidates = [imageUrl, preset.photoUrl, ...FORTH_IMAGE_FALLBACKS];
                  const specialTitle = destination?.top_special?.title || preset.mockSpecial;
                  const specialNote = destination?.top_special?.price_note || preset.mockNote;
                  const stateLabel = isLive
                    ? "Live now"
                    : isSoon
                      ? `Starts ${formatMinutes(destination?.top_special?.starts_in_minutes ?? null)}`
                      : destination
                        ? "Tracked on property"
                        : "Sample highlight";
                  const venueType = destination?.venue.venue_type ? titleCase(destination.venue.venue_type) : preset.typeLabel;

                  return (
                    <Link
                      key={preset.id}
                      href={href}
                      className="group overflow-hidden rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] shadow-[var(--hotel-shadow-soft)] hover:border-[var(--hotel-champagne)] hover:shadow-[var(--hotel-shadow-medium)] transition-all forth-hover-lift"
                    >
                      <div className="relative aspect-[16/10] bg-[var(--hotel-sand)]">
                        <ResilientImage
                          sources={imageCandidates}
                          alt={destination?.venue.name || preset.name}
                          sizes="(max-width: 768px) 100vw, 420px"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 forth-zoom-image"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                        <div className="absolute top-3 left-3 flex items-center gap-2">
                          <span className="rounded-full bg-[var(--hotel-ink)]/75 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-champagne)]">
                            {preset.kind === "restaurant" ? "Dining" : "Bar"}
                          </span>
                          {(isLive || isSoon) && (
                            <span className="rounded-full bg-black/60 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-white/85">
                              {isLive ? "Live" : "Soon"}
                            </span>
                          )}
                        </div>
                        {!imageUrl && (
                          <div className="absolute bottom-4 left-4 right-4">
                            <p className="font-display text-2xl text-white leading-tight">{preset.name}</p>
                          </div>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <p className="font-display text-xl text-[var(--hotel-charcoal)] leading-tight">{destination?.venue.name || preset.name}</p>
                          <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">{venueType}</span>
                        </div>
                        <p className="text-sm text-[var(--hotel-stone)]">{preset.spotlight}</p>
                        <div className="rounded-lg border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-2">
                          <p className="text-sm text-[var(--hotel-charcoal)] font-medium">{specialTitle}</p>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--hotel-champagne)] mt-1">{specialNote}</p>
                        </div>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">{stateLabel}</p>
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">
                          <span className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-2 py-1">Reserve via desk</span>
                          <span className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-2 py-1">Open route</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div id="forth-amenities" className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Hotel Amenities</p>
              <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">On-Property Services</h2>
              <p className="text-sm text-[var(--hotel-stone)] mt-2">
                Amenity listings can connect to live destination data or remain as dedicated property services.
              </p>

              <div className="mt-5 space-y-3">
                {amenityEntries.map(({ amenity, destination }) => {
                  const amenityImageCandidates = [destination?.venue.image_url, amenity.photoUrl, ...FORTH_IMAGE_FALLBACKS];
                  return (
                    <div key={amenity.id} className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                      <div className="relative mb-3 aspect-[16/8] overflow-hidden rounded-lg bg-[var(--hotel-sand)]">
                        <ResilientImage
                          sources={amenityImageCandidates}
                          alt={amenity.name}
                          sizes="(max-width: 768px) 100vw, 460px"
                          className="absolute inset-0 h-full w-full object-cover forth-zoom-image"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                      </div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="font-display text-xl text-[var(--hotel-charcoal)] leading-tight">{amenity.name}</p>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">{amenity.serviceWindow}</span>
                      </div>
                      <p className="text-sm text-[var(--hotel-stone)] mt-1">{amenity.detail}</p>
                      <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--hotel-champagne)] mt-2">
                        {destination ? `Available now: ${destination.venue.name}` : amenity.mockNote}
                      </p>
                      <div className="mt-3">
                        <Link
                          href={destination
                            ? resolveDestinationHref(portal.slug, destination)
                            : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(amenity.name)}`}
                          className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-charcoal)] hover:text-[var(--hotel-champagne)] transition-colors"
                        >
                          View details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            </section>
          )}

          {showServiceLayer && (
          <section className={`mb-14 grid gap-5 ${showPlanBuilder ? "xl:grid-cols-[1fr_1.35fr]" : ""}`}>
            <div id="guest-service-layer" className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">In-Room Requests</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">In-Room Services</h2>
                </div>
                <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">{activeIntent.label}</span>
              </div>
              <p className="text-sm text-[var(--hotel-stone)] mt-2">
                Demo request cards for services guests can ask concierge to coordinate.
              </p>

              <div className="mt-5 space-y-3">
                {IN_ROOM_REQUESTS.map((request) => {
                  const requested = requestedServiceIds.includes(request.id);
                  const requestTicket = requestTicketsByService[request.id];
                  const isSubmitting = submittingRequestId === request.id;
                  return (
                    <div
                      key={request.id}
                      className={`rounded-xl border px-4 py-3 transition-colors ${
                        requested
                          ? "border-[var(--hotel-champagne)] bg-[var(--hotel-ivory)]"
                          : "border-[var(--hotel-sand)] bg-[var(--hotel-ivory)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-xl text-[var(--hotel-charcoal)] leading-tight">{request.title}</p>
                          <p className="text-sm text-[var(--hotel-stone)] mt-1">{request.detail}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">{request.etaLabel}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void submitServiceRequest(request.id);
                        }}
                        disabled={isSubmitting}
                        className={`mt-3 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors ${
                          requested
                            ? "bg-[var(--hotel-champagne)] text-[var(--hotel-ink)]"
                            : "border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)]"
                        }`}
                      >
                        {isSubmitting ? "Submitting..." : requested ? "Requested" : request.ctaLabel}
                      </button>
                      {requestTicket && (
                        <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">
                          Confirmation {requestTicket}
                        </p>
                      )}
                    </div>
                  );
                })}
                {requestError && (
                  <p className="text-sm text-[var(--hotel-terracotta)]">{requestError}</p>
                )}
              </div>
            </div>

            {showPlanBuilder && (
            <div id="itinerary-composer" className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Plan Builder</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Build Your Itinerary</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void copyBriefingLink();
                    }}
                    className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
                  >
                    {copiedBriefing ? "Copied" : "Copy brief"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlanIds([])}
                    className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--hotel-stone)] mt-2">
                Pick a few moments below and we will build a clean step-by-step itinerary.
              </p>

              <div className="mt-5 grid gap-2">
                {rankedPlanCandidates.map((candidate) => {
                  const selected = selectedPlanIds.includes(candidate.id);
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => togglePlanCandidate(candidate.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-[var(--hotel-champagne)] bg-[var(--hotel-ivory)]"
                          : "border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] hover:border-[var(--hotel-champagne)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--hotel-charcoal)]">{candidate.title}</p>
                          <p className="text-xs text-[var(--hotel-stone)]">{candidate.subtitle}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">
                          {candidate.kind === "event" ? "Event" : "Destination"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Your Plan</p>
                {selectedPlan.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {selectedPlan.map((item, index) => {
                      const stepTime = new Date(Date.now() + item.etaMinutes * 60 * 1000);
                      return (
                        <li key={item.id} className="rounded-lg border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-2">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <p className="text-sm font-medium text-[var(--hotel-charcoal)]">{item.title}</p>
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">
                              Stop {index + 1} · {formatClockTime(stepTime)}
                            </p>
                          </div>
                          <p className="text-xs text-[var(--hotel-stone)] mt-1">{item.subtitle}</p>
                          <div className="mt-2">
                            <Link
                              href={item.href}
                              className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:text-[var(--hotel-champagne)] transition-colors"
                            >
                              Open detail
                            </Link>
                            <a
                              href={mapsSearchHref(item.title)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-3 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:text-[var(--hotel-champagne)] transition-colors"
                            >
                              Directions
                            </a>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-[var(--hotel-stone)]">Select at least one event or destination to generate a plan.</p>
                )}
                <div className="mt-3">
                  <Link
                    href={briefingPath}
                    className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:text-[var(--hotel-champagne)] transition-colors"
                  >
                    Open share link
                  </Link>
                </div>
              </div>
            </div>
            )}
          </section>
          )}

          {showOperate && planAheadShowsEvents && featuredEvents.length > 0 && (
            <HotelSection
              id="concierge-events"
              title={effectiveDiscoveryMode === "future"
                ? planAheadEventSectionTitle
                : selectedDaypart === "all"
                  ? "Tonight's Selection"
                  : `${selectedDaypartLabel} Selection`}
              subtitle={effectiveDiscoveryMode === "future"
                ? planAheadEventSectionSubtitle
                : selectedDaypart === "all"
                  ? "Top events and standout picks, arranged for a polished evening."
                  : `Top ${selectedDaypartLabel.toLowerCase()} events and standout picks, arranged for a polished evening.`}
              className={`mb-12 p-5 md:p-6 ${FORTH_PANEL_CLASS}`}
              action={{
                label: "Open All Events",
                href: effectiveDiscoveryMode === "future"
                  ? planAheadCategory === "entertainment"
                    ? `/${portal.slug}?view=find&type=events&search=music`
                    : `/${portal.slug}?view=find&type=events`
                  : activeDiscoveryFocus.id === "any"
                    ? `/${portal.slug}?view=find&type=events`
                    : `/${portal.slug}?view=find&type=events&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`,
              }}
            >
              <div className="mb-4 flex flex-wrap gap-2">
                <TrustChip label="High confidence venues" value={`${highConfidenceDestinationCount}`} />
                <TrustChip label="Verified <24h" value={`${verifiedWithinDayCount}`} />
                <TrustChip label="Walkable options" value={`${walkableDestinationCount}`} />
              </div>
              <p className="mb-4 text-xs text-[var(--hotel-stone)]">
                {effectiveDiscoveryMode === "future"
                  ? "These picks are tuned to your selected date so you can reserve with confidence."
                  : "These picks are tuned to your choices, proximity, and live venue status."}
                {freshestSignalHours !== null ? ` Latest verification was ${freshestSignalHours}h ago.` : ""}
              </p>
              <HotelHeroCard event={featuredEvents[0]} portalSlug={portal.slug} contextLabel={eventContextLabel} />
              {topFeaturedEvent && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={resolveEventHref(portal.slug, topFeaturedEvent)}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    View Event
                  </Link>
                  <Link
                    href={`/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(topFeaturedEvent.venue_name || topFeaturedEvent.title)}`}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Route nearby
                  </Link>
                  <Link
                    href={activeDiscoveryFocus.id === "any"
                      ? `/${portal.slug}?view=find&type=events&date=today`
                      : `/${portal.slug}?view=find&type=events&date=today&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    {effectiveDiscoveryMode === "future" ? "More Upcoming" : "More Tonight"}
                  </Link>
                  <Link
                    href={briefingPath}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Save To Brief
                  </Link>
                </div>
              )}
              {featuredEvents.length > 1 && (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {featuredEvents.slice(1, 5).map((event) => (
                    <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" contextLabel={eventContextLabel} />
                  ))}
                </div>
              )}
            </HotelSection>
          )}

          {showOperate && planAheadShowsEvents && featuredEvents.length === 0 && effectiveDiscoveryMode === "future" && (
            <section className="mb-14 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">{planAheadEventSectionTitle}</p>
              <p className="mt-2 text-sm text-[var(--hotel-stone)]">
                No event matches for this filter yet. Try another date or switch your type above.
              </p>
            </section>
          )}

          {showOperate && showHappyHourRail && happyHourDestinations.length > 0 && (
            <HotelSection
              title={effectiveDiscoveryMode === "future" ? "Cocktail Hour To Bookmark" : "Cocktail Hour Right Now"}
              subtitle={effectiveDiscoveryMode === "future"
                ? "Save these specials for your selected stay date and nearby dinner plans."
                : "Specials running now or opening soon around FORTH."}
              className={`mb-12 p-5 md:p-6 ${FORTH_PANEL_SOFT_CLASS}`}
              action={{
                label: "Open All Cocktail Hour",
                href: `/${portal.slug}?view=find&type=destinations&search=happy hour`,
              }}
            >
              <HotelCarousel>
                {happyHourDestinations.map((destination) => (
                  <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[82vw] max-w-[304px] sm:w-[304px]">
                    <HotelDestinationCard
                      destination={destination}
                      portalSlug={portal.slug}
                      variant={effectiveDiscoveryMode === "future" ? "standard" : "live"}
                      daypartContext={selectedDaypart}
                    />
                  </div>
                ))}
              </HotelCarousel>
            </HotelSection>
          )}

          {showOperate && showOpenLateRail && openLateDestinations.length > 0 && (
            <HotelSection
              title={effectiveDiscoveryMode === "future" ? "Late-Night To Bookmark" : "Late-Night Near FORTH"}
              subtitle={effectiveDiscoveryMode === "future"
                ? "Late-night bars and food options worth saving before your stay."
                : "Spots that still make sense after 9 PM."}
              className={`mb-12 p-5 md:p-6 ${FORTH_PANEL_SOFT_CLASS}`}
              action={{
                label: "Open All Late-Night",
                href: `/${portal.slug}?view=find&type=destinations&search=open late`,
              }}
            >
              <HotelCarousel>
                {openLateDestinations.map((destination) => (
                  <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[82vw] max-w-[304px] sm:w-[304px]">
                    <HotelDestinationCard
                      destination={destination}
                      portalSlug={portal.slug}
                      variant={effectiveDiscoveryMode === "future" ? "standard" : "live"}
                      daypartContext="late_night"
                    />
                  </div>
                ))}
              </HotelCarousel>
            </HotelSection>
          )}

          {showOperate && !isStayMode && (weekEvents.length > 0 || weekendEvents.length > 0) && (
            <section id="concierge-calendar" className="mb-12 grid lg:grid-cols-2 gap-5">
              {weekEvents.length > 0 && (
                <HotelSection
                  title="Later This Week"
                  subtitle="Elevated options worth booking before your stay."
                  className={`mb-0 p-5 md:p-6 ${FORTH_PANEL_SOFT_CLASS}`}
                  action={{ label: "Open Week List", href: `/${portal.slug}?view=find&type=events&date=next_7_days` }}
                >
                  <div className="space-y-3">
                    {weekEvents.slice(0, 4).map((event) => (
                      <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" contextLabel="This week" />
                    ))}
                  </div>
                </HotelSection>
              )}

              {weekendEvents.length > 0 && (
                <HotelSection
                  title="This Weekend"
                  subtitle="Curated events aligned to FORTH's evening vibe."
                  className={`mb-0 p-5 md:p-6 ${FORTH_PANEL_SOFT_CLASS}`}
                  action={{ label: "Open Weekend List", href: `/${portal.slug}?view=find&type=events&date=this_weekend` }}
                >
                  <div className="space-y-3">
                    {weekendEvents.slice(0, 4).map((event) => (
                      <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" contextLabel="Weekend" />
                    ))}
                  </div>
                </HotelSection>
              )}
            </section>
          )}

          {showOperate && planAheadShowsDestinations && explorationDestinations.length > 0 && (
            <HotelSection
              id="concierge-destinations"
              title={effectiveDiscoveryMode === "future"
                ? `${planAheadDestinationSectionTitle}: ${activeVenueGuidanceLabel}`
                : `Near FORTH ${selectedDaypart === "all" ? "Right Now" : selectedDaypartLabel}: ${activeVenueGuidanceLabel}`}
              subtitle={effectiveDiscoveryMode === "future"
                ? planAheadDestinationSectionSubtitle
                : hasGuidedVenueFilter
                  ? "Live nearby picks guided by your mood and craving selections."
                  : "Live nearby picks around FORTH right now."}
              className={`mb-12 p-5 md:p-6 ${FORTH_PANEL_CLASS}`}
              action={{
                label: effectiveDiscoveryMode === "future" ? "Open All Venues" : "Open All Live Venues",
                href: effectiveDiscoveryMode === "future"
                  ? planAheadCategory === "food"
                    ? `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,food_hall,bar,rooftop`
                      : planAheadCategory === "entertainment"
                        ? `/${portal.slug}?view=find&type=destinations&search=live music`
                      : planAheadCategory === "destinations"
                        ? activeDestinationVibe.id === "any"
                          ? `/${portal.slug}?view=find&type=destinations&neighborhoods=Old Fourth Ward,Inman Park,Poncey-Highland,Midtown`
                          : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeDestinationVibe.searchQuery)}`
                        : `/${portal.slug}?view=find&type=destinations`
                  : activeFoodDrinkFocus.id !== "any"
                    ? `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeFoodDrinkFocus.searchQuery)}`
                    : activeDiscoveryFocus.id === "any"
                      ? `/${portal.slug}?view=find&type=destinations`
                      : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`,
              }}
            >
              <HotelCarousel>
                {explorationDestinations.slice(0, 18).map((destination) => (
                  <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[82vw] max-w-[304px] sm:w-[304px]">
                    <HotelDestinationCard
                      destination={destination}
                      portalSlug={portal.slug}
                      variant={effectiveDiscoveryMode === "future" ? "standard" : "live"}
                      daypartContext={selectedDaypart}
                    />
                  </div>
                ))}
              </HotelCarousel>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={briefingPath}
                  className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                >
                  Save To Brief
                </Link>
                <Link
                  href={`/${portal.slug}?view=find&type=destinations`}
                  className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                >
                  Browse Venue Index
                </Link>
              </div>
            </HotelSection>
          )}

          {showOperate && planAheadShowsDestinations && explorationDestinations.length === 0 && fallbackExplorationDestinations.length > 0 && (
            <HotelSection
              id="concierge-destinations"
              title={effectiveDiscoveryMode === "future" ? "Near FORTH For Your Stay" : "Near FORTH Right Now"}
              subtitle={effectiveDiscoveryMode === "future"
                ? "No direct matches yet. Showing broader options for upcoming stay planning."
                : "No direct matches yet. Showing broader nearby options around FORTH."}
              className={`mb-12 p-5 md:p-6 ${FORTH_PANEL_CLASS}`}
              action={{ label: effectiveDiscoveryMode === "future" ? "Open All Venues" : "Open All Live Venues", href: `/${portal.slug}?view=find&type=destinations` }}
            >
              <HotelCarousel>
                {fallbackExplorationDestinations.slice(0, 12).map((destination) => (
                  <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[82vw] max-w-[304px] sm:w-[304px]">
                    <HotelDestinationCard
                      destination={destination}
                      portalSlug={portal.slug}
                      variant={effectiveDiscoveryMode === "future" ? "standard" : "live"}
                      daypartContext={selectedDaypart}
                    />
                  </div>
                ))}
              </HotelCarousel>
            </HotelSection>
          )}

          {showOperate && planAheadShowsDestinations && explorationDestinations.length === 0 && fallbackExplorationDestinations.length === 0 && effectiveDiscoveryMode === "future" && (
            <section className="mb-14 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6">
              <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">{planAheadDestinationSectionTitle}</p>
              <p className="mt-2 text-sm text-[var(--hotel-stone)]">
                No venue matches for this filter yet. Try another type or date above.
              </p>
            </section>
          )}

          {showPlanBuilder && !showDetailedPlan && (
            <section className="mb-14 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Optional</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">Need A Detailed Schedule?</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2">
                    Most guests prefer a lightweight browse. Open this if you want a step-by-step itinerary.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetailedPlan(true)}
                  className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-charcoal)] px-4 py-2 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-cream)] hover:border-[var(--hotel-champagne)] transition-colors"
                >
                  Open Step-By-Step Plan
                </button>
              </div>
            </section>
          )}

          {showPlanBuilder && showDetailedPlan && (
            <section id="itinerary-composer" className="mb-14 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Step-By-Step Plan</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Build Your Itinerary</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowDetailedPlan(false)}
                    className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
                  >
                    Hide planner
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyBriefingLink();
                    }}
                    className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
                  >
                    {copiedBriefing ? "Copied" : "Copy plan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlanIds([])}
                    className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--hotel-stone)] mt-2">
                Pick up to a few stops and we will create a clean sequence for the evening.
              </p>

              <div className="mt-5 grid gap-2">
                {rankedPlanCandidates.map((candidate) => {
                  const selected = selectedPlanIds.includes(candidate.id);
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => togglePlanCandidate(candidate.id)}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                        selected
                          ? "border-[var(--hotel-champagne)] bg-[var(--hotel-ivory)]"
                          : "border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] hover:border-[var(--hotel-champagne)]"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-[var(--hotel-charcoal)]">{candidate.title}</p>
                          <p className="text-xs text-[var(--hotel-stone)]">{candidate.subtitle}</p>
                        </div>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">
                          {candidate.kind === "event" ? "Event" : "Destination"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">Selected Stops</p>
                {selectedPlan.length > 0 ? (
                  <ol className="mt-3 space-y-2">
                    {selectedPlan.map((item, index) => {
                      const stepTime = new Date(Date.now() + item.etaMinutes * 60 * 1000);
                      return (
                        <li key={item.id} className="rounded-lg border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-2">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <p className="text-sm font-medium text-[var(--hotel-charcoal)]">{item.title}</p>
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">
                              Stop {index + 1} · {formatClockTime(stepTime)}
                            </p>
                          </div>
                          <p className="text-xs text-[var(--hotel-stone)] mt-1">{item.subtitle}</p>
                          <div className="mt-2">
                            <Link
                              href={item.href}
                              className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:text-[var(--hotel-champagne)] transition-colors"
                            >
                              Open detail
                            </Link>
                            <a
                              href={mapsSearchHref(item.title)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-3 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:text-[var(--hotel-champagne)] transition-colors"
                            >
                              Directions
                            </a>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="mt-2 text-sm text-[var(--hotel-stone)]">Select at least one stop to generate your plan.</p>
                )}
                <div className="mt-3">
                  <Link
                    href={briefingPath}
                    className="text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:text-[var(--hotel-champagne)] transition-colors"
                  >
                    Open share link
                  </Link>
                </div>
              </div>
            </section>
          )}

          {showOperate && effectiveDiscoveryMode === "tonight" && showStudioControls && startingSoon.length > 0 && (
            <section className="mb-14 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Starting Soon</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Next Three Hours</h2>
                </div>
                <Link
                  href={activeFoodDrinkFocus.id !== "any"
                    ? `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeFoodDrinkFocus.searchQuery)}`
                    : activeDiscoveryFocus.id === "any"
                      ? `/${portal.slug}?view=find&type=destinations`
                      : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`}
                  className="text-xs uppercase tracking-[0.14em] text-[var(--hotel-champagne)]"
                >
                  All destinations
                </Link>
              </div>

              <div className="space-y-2">
                {startingSoon.map((destination) => (
                  <Link
                    key={destination.venue.id}
                    href={resolveDestinationHref(portal.slug, destination)}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3 hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--hotel-charcoal)]">{destination.venue.name}</p>
                      <p className="text-xs text-[var(--hotel-stone)]">
                        {destination.top_special?.title || "Special window opening"} · {destination.proximity_label}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.14em] text-[var(--hotel-stone)]">
                        {formatMinutes(destination.top_special?.starts_in_minutes ?? null)}
                      </span>
                      <span className={`px-2 py-1 text-[10px] uppercase tracking-[0.12em] border rounded-full ${getConfidenceTone(destination.top_special?.confidence || null)}`}>
                        {destination.top_special?.confidence || "status"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {showExplore && !isDiningRoute && !isPlanRoute && guidedTonightEvents.length > 0 && (
            <HotelSection
              title={agentNarrative?.briefingTitle || (selectedDaypart === "all" ? "Concierge Briefing" : `${selectedDaypartLabel} Briefing`)}
              subtitle={activeDiscoveryFocus.id === "any"
                ? "The top event plus a compact stack for a refined evening shortlist."
                : `Focused on ${activeDiscoveryFocus.label.toLowerCase()} so guests can choose with clarity.`}
              className="mb-14"
              action={{
                label: "All events",
                href: activeDiscoveryFocus.id === "any"
                  ? `/${portal.slug}?view=find&type=events`
                  : `/${portal.slug}?view=find&type=events&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`,
              }}
            >
              <HotelHeroCard event={guidedTonightEvents[0]} portalSlug={portal.slug} contextLabel={eventContextLabel} />
              {guidedTonightEvents[0] && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={resolveEventHref(portal.slug, guidedTonightEvents[0])}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Open event
                  </Link>
                  <Link
                    href={`/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(guidedTonightEvents[0].venue_name || guidedTonightEvents[0].title)}`}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Route nearby
                  </Link>
                  <Link
                    href={activeDiscoveryFocus.id === "any"
                      ? `/${portal.slug}?view=find&type=events&date=today`
                      : `/${portal.slug}?view=find&type=events&date=today&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    More right now
                  </Link>
                </div>
              )}
              {guidedTonightEvents.length > 1 && (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {guidedTonightEvents.slice(1, 7).map((event) => (
                    <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" contextLabel={eventContextLabel} />
                  ))}
                </div>
              )}
            </HotelSection>
          )}

          {showExtendedExploreSections && beltline.length > 0 && (
            <section className="mb-14 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Route Layer</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">BeltLine Walk</h2>
                </div>
                <Link
                  href={`/${portal.slug}?view=find&type=destinations&neighborhoods=Old Fourth Ward,Inman Park,Poncey-Highland`}
                  className="text-xs uppercase tracking-[0.14em] text-[var(--hotel-champagne)]"
                >
                  Full route
                </Link>
              </div>

              <ol className="space-y-3">
                {beltline.map((destination, index) => (
                  <li key={destination.venue.id} className="relative pl-7">
                    <span className="absolute left-1 top-3 h-full w-px bg-[var(--hotel-sand)]" aria-hidden="true" />
                    <span className="absolute left-0 top-2 inline-flex h-3 w-3 rounded-full bg-[var(--hotel-champagne)]" aria-hidden="true" />
                    <Link href={resolveDestinationHref(portal.slug, destination)} className="block rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3 hover:border-[var(--hotel-champagne)] transition-colors">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-sm font-medium text-[var(--hotel-charcoal)]">{destination.venue.name}</p>
                        <p className="text-xs uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Stop {index + 1}</p>
                      </div>
                      <p className="mt-1 text-xs text-[var(--hotel-stone)]">
                        {destination.venue.neighborhood || "BeltLine route"} · {destination.proximity_label}
                      </p>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {showExtendedExploreSections && ((showProperty && propertyDestinations.length > 0) || walkable.length > 0) && (
            <section className="mb-14 grid lg:grid-cols-2 gap-5">
              {showProperty && propertyDestinations.length > 0 && (
                <HotelSection title="Near FORTH" subtitle="Closest destinations adjacent to the hotel footprint." className="mb-0">
                  <HotelCarousel>
                    {propertyDestinations.map((destination) => (
                      <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[82vw] max-w-[286px] sm:w-[286px]">
                        <HotelDestinationCard destination={destination} portalSlug={portal.slug} daypartContext={selectedDaypart} />
                      </div>
                    ))}
                  </HotelCarousel>
                </HotelSection>
              )}

              {walkable.length > 0 && (
                <HotelSection title="Walkable" subtitle="Best options within a short walk from FORTH." className="mb-0">
                  <HotelCarousel>
                    {walkable.map((destination) => (
                      <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[82vw] max-w-[286px] sm:w-[286px]">
                        <HotelDestinationCard destination={destination} portalSlug={portal.slug} daypartContext={selectedDaypart} />
                      </div>
                    ))}
                  </HotelCarousel>
                </HotelSection>
              )}
            </section>
          )}

          {showExtendedExploreSections && (categorized.dine.length > 0 || categorized.drink.length > 0 || picksSection?.events.length) && (
            <section className="grid lg:grid-cols-3 gap-5 pb-8">
              {categorized.dine.length > 0 && (
                <HotelSection
                  title="Dinner"
                  subtitle="Destination-led dining picks"
                  className="mb-0"
                  action={{ label: "All", href: `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,food_hall` }}
                >
                  <div className="space-y-3">
                    {categorized.dine.slice(0, 4).map((destination) => (
                      <HotelDestinationCard key={destination.venue.id} destination={destination} portalSlug={portal.slug} />
                    ))}
                  </div>
                </HotelSection>
              )}

              {categorized.drink.length > 0 && (
                <HotelSection
                  title="Nightcap"
                  subtitle="Bars and rooftops"
                  className="mb-0"
                  action={{ label: "All", href: `/${portal.slug}?view=find&type=destinations&venue_type=bar,rooftop,brewery,nightclub` }}
                >
                  <div className="space-y-3">
                    {categorized.drink.slice(0, 4).map((destination) => (
                      <HotelDestinationCard key={destination.venue.id} destination={destination} portalSlug={portal.slug} />
                    ))}
                  </div>
                </HotelSection>
              )}

              {picksSection && picksSection.events.length > 0 && (
                <HotelSection
                  title="Concierge Picks"
                  subtitle="Curated by FORTH favorites and city activity"
                  className="mb-0"
                  action={{ label: "All", href: `/${portal.slug}?view=find&type=events` }}
                >
                  <div className="space-y-3">
                    {picksSection.events.slice(0, 4).map((event) => (
                      <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" contextLabel={eventContextLabel} />
                    ))}
                  </div>
                </HotelSection>
              )}
            </section>
          )}

          {sections.length === 0 && destinations.length === 0 && (
            <div className="text-center py-20">
              <p className="font-display text-3xl text-[var(--hotel-charcoal)] mb-3">FORTH concierge data is warming up</p>
              <p className="font-body text-[var(--hotel-stone)]">Refresh shortly to see live destination intelligence and current recommendations.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-1.5">
      <p className="text-[9px] uppercase tracking-[0.13em] text-[var(--hotel-stone)]">{label}</p>
      <p className="text-xs text-[var(--hotel-charcoal)] leading-tight">{value}</p>
    </div>
  );
}

function TrustChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-2.5 py-1.5 sm:px-3 sm:py-1">
      <p className="text-[9px] uppercase tracking-[0.12em] text-[var(--hotel-stone)]">{label}</p>
      <p className="text-[11px] text-[var(--hotel-charcoal)] leading-tight">{value}</p>
    </div>
  );
}

function ChoiceCard({
  label,
  hint,
  eyebrow,
  selected,
  sources,
  onClick,
}: {
  label: string;
  hint: string;
  eyebrow: string;
  selected: boolean;
  sources: Array<string | null | undefined>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border text-left transition-all forth-hover-lift ${
        selected
          ? "border-[var(--hotel-champagne)] shadow-[var(--hotel-shadow-medium)]"
          : "border-[var(--hotel-sand)] hover:border-[var(--hotel-champagne)] shadow-[var(--hotel-shadow-soft)]"
      }`}
    >
      <div className="relative aspect-[16/10]">
        <ResilientImage
          sources={sources}
          alt={label}
          sizes="(max-width: 1024px) 100vw, 420px"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 forth-zoom-image"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/15" />
        <div className="absolute top-3 left-3">
          <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-champagne)]">
            {eyebrow}
          </span>
        </div>
        {selected && (
          <div className="absolute top-3 right-3">
            <span className="rounded-full bg-[var(--hotel-champagne)] px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--hotel-ink)]">
              Selected
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="font-display text-xl md:text-2xl leading-tight text-white">{label}</p>
          <p className="mt-1 text-[11px] md:text-xs text-white/80 line-clamp-2">{hint}</p>
        </div>
      </div>
    </button>
  );
}

function OptionRail({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative w-full max-w-full min-w-0 overflow-x-clip ${className}`}>
      <div className="flex w-full max-w-full min-w-0 gap-2 overflow-x-auto overflow-y-hidden scroll-touch scrollbar-hide pb-1 pr-4 sm:pr-8">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-8 sm:w-10 bg-gradient-to-l from-[var(--hotel-cream)] to-transparent" />
    </div>
  );
}

function ResilientImage({
  sources,
  alt,
  sizes,
  className,
  priority = false,
}: {
  sources: Array<string | null | undefined>;
  alt: string;
  sizes: string;
  className: string;
  priority?: boolean;
}) {
  const candidates = useMemo(() => buildImageCandidates(sources), [sources]);
  const [index, setIndex] = useState(0);

  if (candidates.length === 0) {
    return <div className={`absolute inset-0 bg-[var(--hotel-sand)] ${className}`} />;
  }

  const src = candidates[Math.min(index, candidates.length - 1)];
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className}
      onError={() => {
        setIndex((current) => (current < candidates.length - 1 ? current + 1 : current));
      }}
    />
  );
}

function ForthLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--hotel-ivory)]">
      <div className="sticky top-0 z-50 bg-[var(--hotel-ivory)]/95 backdrop-blur-md border-b border-[var(--hotel-sand)]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="h-8 w-40 bg-[var(--hotel-sand)] rounded animate-pulse" />
          <div className="h-5 w-5 bg-[var(--hotel-sand)] rounded animate-pulse" />
        </div>
      </div>
      <main className="max-w-7xl mx-auto px-6 py-10 space-y-6">
        <div className="h-52 bg-[var(--hotel-cream)] rounded-2xl animate-pulse" />
        <div className="h-40 bg-[var(--hotel-cream)] rounded-2xl animate-pulse" />
        <div className="h-72 bg-[var(--hotel-cream)] rounded-2xl animate-pulse" />
      </main>
    </div>
  );
}
