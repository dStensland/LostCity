"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Portal } from "@/lib/portal-context";
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
type GuestIntent = "business" | "romance" | "night_out" | "wellness";
type ExperienceView = "operate" | "property" | "explore";
type VisitorPersona = "first_time" | "business_traveler" | "weekend_couple" | "wellness_guest" | "club_member";
type DiscoveryFocusId = "any" | "live_music" | "comedy" | "sports" | "arts";
type FoodDrinkFocusId = "any" | "cocktails" | "sports_bar" | "mexican" | "coffee" | "rooftop";
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

type CuratorMode = {
  id: CuratorModeId;
  label: string;
  hint: string;
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
    label: "Tonight's Plan",
    hint: "Best when you need a clear decision stack for this evening.",
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
    label: "Open To Anything",
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
    label: "Open To Anything",
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
  guestIntent?: GuestIntent;
  discoveryFocusId?: DiscoveryFocusId;
  foodDrinkFocusId?: FoodDrinkFocusId;
  curatorModeId?: CuratorModeId;
  requestedServiceIds?: string[];
  selectedPlanIds?: string[];
  requestTicketsByService?: Record<string, string>;
  activeBundleId?: string | null;
  isBriefMode?: boolean;
};

type EditorialMoment = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  badge: string;
  imageSrc: string;
};

const DINE_TYPES = new Set(["restaurant", "food_hall"]);
const DRINK_TYPES = new Set(["bar", "brewery", "rooftop", "sports_bar", "distillery", "nightclub"]);
const HOTEL_AMENITY_TYPES = new Set(["hotel", "spa", "fitness_center", "restaurant", "bar", "rooftop"]);

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

function isWorldCupWindow(now: Date): boolean {
  const current = now.toISOString().slice(0, 10);
  return current >= "2026-06-11" && current <= "2026-07-19";
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

function getFreshnessHours(lastVerifiedAt: string | null): number | null {
  if (!lastVerifiedAt) return null;
  const ts = Date.parse(lastVerifiedAt);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / (1000 * 60 * 60)));
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
}

export default function ForthConciergeExperience({ portal }: ForthConciergeExperienceProps) {
  const [sections, setSections] = useState<FeedSection[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [liveDestinations, setLiveDestinations] = useState<Destination[]>([]);
  const [specialsMeta, setSpecialsMeta] = useState<SpecialsMeta | null>(null);
  const [visitorPersona, setVisitorPersona] = useState<VisitorPersona>("first_time");
  const [guestIntent, setGuestIntent] = useState<GuestIntent>("night_out");
  const [discoveryFocusId, setDiscoveryFocusId] = useState<DiscoveryFocusId>("any");
  const [foodDrinkFocusId, setFoodDrinkFocusId] = useState<FoodDrinkFocusId>("any");
  const [curatorModeId, setCuratorModeId] = useState<CuratorModeId>("safe");
  const [requestedServiceIds, setRequestedServiceIds] = useState<string[]>([]);
  const [requestTicketsByService, setRequestTicketsByService] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submittingRequestId, setSubmittingRequestId] = useState<string | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [planInitialized, setPlanInitialized] = useState(false);
  const [experienceView, setExperienceView] = useState<ExperienceView>("operate");
  const [activeBundleId, setActiveBundleId] = useState<string | null>(null);
  const [isBriefMode, setIsBriefMode] = useState(false);
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [loading, setLoading] = useState(true);

  const logoUrl = portal.branding?.logo_url as string | null | undefined;
  const conciergePhoneDisplay = typeof portal.settings?.concierge_phone === "string"
    ? portal.settings.concierge_phone
    : "+1 (404) 555-0144";
  const conciergePhoneLink = phoneHref(conciergePhoneDisplay);
  const knownServiceIds = useMemo(() => IN_ROOM_REQUESTS.map((request) => request.id), []);

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

        const [feedRes, allDestRes, liveDestRes] = await Promise.all([
          fetch(`/api/portals/${portal.slug}/feed`),
          fetch(`/api/portals/${portal.slug}/destinations/specials?${allQuery}`),
          fetch(`/api/portals/${portal.slug}/destinations/specials?${activeQuery}`),
        ]);

        const feedData = await feedRes.json();
        const allDestData = await allDestRes.json();
        const liveDestData = await liveDestRes.json();

        if (feedData.sections) {
          const normalized: FeedSection[] = feedData.sections
            .filter((s: { events?: unknown[] }) => (s.events || []).length > 0)
            .map((section: {
              title: string;
              slug?: string;
              description?: string;
              events: Array<Record<string, unknown>>;
            }) => ({
              title: section.title,
              slug: section.slug,
              description: section.description,
              events: section.events.map((event) => ({
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
            }));
          setSections(normalized);
        }

        setDestinations((allDestData.destinations || []) as Destination[]);
        setLiveDestinations((liveDestData.destinations || []) as Destination[]);
        setSpecialsMeta((allDestData.meta || null) as SpecialsMeta | null);
      } catch (error) {
        console.error("Failed to fetch FORTH concierge data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [portal.slug, portal.filters?.geo_center, portal.filters?.geo_radius_km]);

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
    const modeFromUrl = params.get("concierge_mode");
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
        setExperienceView(value as ExperienceView);
      }
    };

    const applyBundle = (value: string | null | undefined) => {
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

    const applyCuratorMode = (value: string | null | undefined) => {
      if (!value) return;
      if (CURATOR_MODES.some((mode) => mode.id === value)) {
        setCuratorModeId(value as CuratorModeId);
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
      modeFromUrl ||
      briefFromUrl
    ) {
      applyPersona(personaFromUrl);
      applyView(viewFromUrl);
      applyBundle(bundleFromUrl);
      applyFocus(focusFromUrl);
      applyFoodFocus(foodFocusFromUrl);
      applyCuratorMode(modeFromUrl);
      applyIntent(intentFromUrl);
      applyRequested(requestedFromUrl?.split(",").filter(Boolean));
      applyPlan(planFromUrl?.split(",").filter(Boolean));
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
      applyCuratorMode(parsed.curatorModeId);
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
    } catch {
      // Ignore malformed local state snapshots.
    }
  }, [knownServiceIds, portal.slug]);

  const now = useMemo(() => new Date(), []);
  const dayPart = useMemo(() => getDayPart(now), [now]);
  const greeting = useMemo(() => getDayPartCopy(dayPart), [dayPart]);
  const worldCupActive = useMemo(() => isWorldCupWindow(now), [now]);

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
  const activeCuratorMode = useMemo(
    () => CURATOR_MODES.find((mode) => mode.id === curatorModeId) || CURATOR_MODES[0],
    [curatorModeId]
  );
  const activeIntent = useMemo(
    () => GUEST_INTENT_OPTIONS.find((option) => option.id === guestIntent) || GUEST_INTENT_OPTIONS[0],
    [guestIntent]
  );
  const hasGuidedVenueFilter = activeDiscoveryFocus.id !== "any" || activeFoodDrinkFocus.id !== "any";
  const activeVenueGuidanceLabel = useMemo(() => {
    if (activeFoodDrinkFocus.id !== "any") return activeFoodDrinkFocus.label;
    if (activeDiscoveryFocus.id !== "any") return activeDiscoveryFocus.label;
    return activeIntent.label;
  }, [activeDiscoveryFocus.id, activeDiscoveryFocus.label, activeFoodDrinkFocus.id, activeFoodDrinkFocus.label, activeIntent.label]);
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

  const allEventPool = useMemo(() => sections.flatMap((section) => section.events), [sections]);
  const discoveryFocusCounts = useMemo(() => {
    const entries = DISCOVERY_FOCUS_OPTIONS.map((focus) => {
      if (focus.id === "any") {
        return [focus.id, { events: allEventPool.length, venues: rankedDestinations.length }] as const;
      }

      const eventCount = allEventPool.filter((event) => matchesEventFocus(event, focus)).length;
      const venueCount = rankedDestinations.filter((destination) => matchesDestinationFocus(destination, focus)).length;
      return [focus.id, { events: eventCount, venues: venueCount }] as const;
    });

    return Object.fromEntries(entries) as Record<DiscoveryFocusId, { events: number; venues: number }>;
  }, [allEventPool, rankedDestinations]);

  const foodDrinkFocusCounts = useMemo(() => {
    const entries = FOOD_DRINK_FOCUS_OPTIONS.map((focus) => {
      if (focus.id === "any") {
        return [focus.id, { venues: focusedDestinations.length }] as const;
      }
      const venueCount = focusedDestinations.filter((destination) => matchesFoodDrinkFocus(destination, focus)).length;
      return [focus.id, { venues: venueCount }] as const;
    });

    return Object.fromEntries(entries) as Record<FoodDrinkFocusId, { venues: number }>;
  }, [focusedDestinations]);

  const guidedTonightEvents = useMemo(() => {
    const events = tonightSection?.events || [];
    if (activeDiscoveryFocus.id === "any") return events;
    const matches = events.filter((event) => matchesEventFocus(event, activeDiscoveryFocus));
    return matches.length > 0 ? matches : events;
  }, [activeDiscoveryFocus, tonightSection]);

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

  const propertyDestinations = useMemo(
    () => foodFocusedDestinations
      .filter((d) => isLikelyHotelAmenity(d, portal.name) && !signatureVenueIds.has(d.venue.id))
      .slice(0, 8),
    [foodFocusedDestinations, portal.name, signatureVenueIds]
  );

  const beltline = useMemo(() => foodFocusedDestinations.filter(isBeltlineDestination).slice(0, 8), [foodFocusedDestinations]);

  const highConfidence = useMemo(
    () => foodFocusedDestinations.filter((d) => d.top_special?.confidence === "high").length,
    [foodFocusedDestinations]
  );

  const refreshedToday = useMemo(
    () => foodFocusedDestinations.filter((d) => {
      const ageHours = getFreshnessHours(d.top_special?.last_verified_at || null);
      return ageHours !== null && ageHours <= 24;
    }).length,
    [foodFocusedDestinations]
  );

  const quickActions = useMemo(() => {
    if (activePersona.id === "club_member") {
      return [
        {
          label: "Club Dining + Bar",
          href: `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,bar,rooftop`,
        },
        {
          label: "Wellness + Pool",
          href: `/${portal.slug}?view=find&type=destinations&venue_type=spa,fitness_center`,
        },
        {
          label: "Member Events",
          href: `/${portal.slug}?view=find&type=events&search=club`,
        },
        {
          label: "Priority Dinner",
          href: `/${portal.slug}?view=find&type=destinations&search=premio`,
        },
      ];
    }

    return [
      {
        label: "Happy Hour",
        href: `/${portal.slug}?view=find&type=destinations&venue_type=bar,rooftop,brewery,sports_bar`,
      },
      {
        label: "Dinner Nearby",
        href: `/${portal.slug}?view=find&type=destinations&venue_type=restaurant,food_hall`,
      },
      {
        label: "Tonight's Events",
        href: `/${portal.slug}?view=find&type=events&date=today`,
      },
      {
        label: "Walk The BeltLine",
        href: `/${portal.slug}?view=find&type=destinations&neighborhoods=Old Fourth Ward,Inman Park,Poncey-Highland`,
      },
    ];
  }, [activePersona.id, portal.slug]);
  const topTonightEvent = guidedTonightEvents[0];
  const editorialMoments = useMemo(() => {
    const items: EditorialMoment[] = [];

    if (topTonightEvent) {
      items.push({
        id: `moment-event-${topTonightEvent.id}`,
        title: topTonightEvent.title,
        subtitle: topTonightEvent.venue_name || "Tonight's featured event",
        href: `/${portal.slug}/events/${topTonightEvent.id}`,
        badge: "Tonight's Lead",
        imageSrc: getProxiedImageSrc(topTonightEvent.image_url || HERO_PHOTOS_BY_DAYPART[dayPart]) as string,
      });
    }

    const signatureLead = signatureVenueEntries.find((entry) => entry.destination || entry.preset.photoUrl);
    if (signatureLead) {
      items.push({
        id: `moment-signature-${signatureLead.preset.id}`,
        title: signatureLead.destination?.venue.name || signatureLead.preset.name,
        subtitle: signatureLead.preset.spotlight,
        href: signatureLead.destination
          ? `/${portal.slug}?spot=${signatureLead.destination.venue.slug}`
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
          ? `/${portal.slug}?spot=${amenityLead.destination.venue.slug}`
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
  }, [amenityEntries, dayPart, portal.slug, signatureVenueEntries, topTonightEvent]);

  const planCandidates = useMemo(() => {
    const items: PlanCandidate[] = [];
    const seen = new Set<string>();

    if (topTonightEvent) {
      const id = `event-${topTonightEvent.id}`;
      seen.add(id);
      items.push({
        id,
        title: topTonightEvent.title,
        subtitle: topTonightEvent.venue_name || "Tonight's lead event",
        kind: "event",
        venueType: null,
        href: `/${portal.slug}/events/${topTonightEvent.id}`,
        etaMinutes: 0,
        confidence: null,
        proximityTier: null,
        isSignature: false,
        isFromLive: true,
      });
    }

    for (const [index, destination] of foodFocusedLiveDestinations.slice(0, 5).entries()) {
      const id = `dest-${destination.venue.id}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const liveBias = destination.special_state === "active_now"
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
        href: `/${portal.slug}?spot=${destination.venue.slug}`,
        etaMinutes: liveBias,
        confidence: destination.top_special?.confidence || null,
        proximityTier: destination.proximity_tier,
        isSignature: false,
        isFromLive: true,
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
        href: `/${portal.slug}?spot=${entry.destination.venue.slug}`,
        etaMinutes: 120 + index * 30,
        confidence: entry.destination.top_special?.confidence || null,
        proximityTier: entry.destination.proximity_tier,
        isSignature: true,
        isFromLive: false,
      });
    }

    return items.slice(0, 8);
  }, [foodFocusedLiveDestinations, portal.slug, signatureVenueEntries, topTonightEvent]);

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
      guestIntent,
      discoveryFocusId,
      foodDrinkFocusId,
      curatorModeId,
      requestedServiceIds,
      selectedPlanIds,
      requestTicketsByService,
      activeBundleId,
      isBriefMode,
    };
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  }, [activeBundleId, curatorModeId, discoveryFocusId, experienceView, foodDrinkFocusId, guestIntent, isBriefMode, portal.slug, requestedServiceIds, requestTicketsByService, selectedPlanIds, visitorPersona]);

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
    setCuratorModeId(modeId);
    const ranked = rankPlanCandidatesForMode(planCandidates, modeId);
    if (ranked.length > 0) {
      setSelectedPlanIds(ranked.slice(0, 3).map((candidate) => candidate.id));
      setPlanInitialized(true);
    }
  };

  const applyCommandBundle = (bundle: ConciergeBundle) => {
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
    setExperienceView(persona.defaultView);
    const preferredBundle = COMMAND_BUNDLES.find((bundle) => bundle.id === persona.preferredBundleId);
    if (preferredBundle) {
      applyCommandBundle(preferredBundle);
    } else {
      setActiveBundleId(null);
    }
  };

  const briefingPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("guest_persona", visitorPersona);
    params.set("concierge_view", experienceView);
    params.set("concierge_intent", guestIntent);
    params.set("concierge_focus", discoveryFocusId);
    params.set("concierge_food_focus", foodDrinkFocusId);
    params.set("concierge_mode", curatorModeId);
    if (activeBundleId) {
      params.set("concierge_bundle", activeBundleId);
    }
    if (selectedPlanIds.length > 0) {
      params.set("concierge_plan", selectedPlanIds.join(","));
    }
    if (requestedServiceIds.length > 0) {
      params.set("concierge_services", requestedServiceIds.join(","));
    }
    params.set("concierge_brief", "1");
    return `/${portal.slug}?${params.toString()}`;
  }, [activeBundleId, curatorModeId, discoveryFocusId, experienceView, foodDrinkFocusId, guestIntent, portal.slug, requestedServiceIds, selectedPlanIds, visitorPersona]);

  const fullExperiencePath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("guest_persona", visitorPersona);
    params.set("concierge_view", experienceView);
    params.set("concierge_intent", guestIntent);
    params.set("concierge_focus", discoveryFocusId);
    params.set("concierge_food_focus", foodDrinkFocusId);
    params.set("concierge_mode", curatorModeId);
    if (activeBundleId) {
      params.set("concierge_bundle", activeBundleId);
    }
    if (selectedPlanIds.length > 0) {
      params.set("concierge_plan", selectedPlanIds.join(","));
    }
    if (requestedServiceIds.length > 0) {
      params.set("concierge_services", requestedServiceIds.join(","));
    }
    return `/${portal.slug}?${params.toString()}`;
  }, [activeBundleId, curatorModeId, discoveryFocusId, experienceView, foodDrinkFocusId, guestIntent, portal.slug, requestedServiceIds, selectedPlanIds, visitorPersona]);

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

  const showFullExperience = !isBriefMode;
  const showOperate = showFullExperience && experienceView === "operate";
  const showProperty = showFullExperience && experienceView === "property";
  const showExplore = showFullExperience && experienceView === "explore";
  const activeView = EXPERIENCE_VIEW_OPTIONS.find((option) => option.id === experienceView) || EXPERIENCE_VIEW_OPTIONS[0];

  if (loading) {
    return <ForthLoadingSkeleton />;
  }

  return (
    <div data-forth-experience="true" className="relative min-h-screen bg-[var(--hotel-ivory)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(212,175,122,0.11),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(201,168,138,0.08),transparent_32%),linear-gradient(180deg,rgba(253,251,247,1)_0%,rgba(253,251,247,0.985)_36%,rgba(247,245,240,0.95)_100%)]" />

      <div className="relative">
        <HotelHeader portalSlug={portal.slug} portalName={portal.name} logoUrl={logoUrl} />

        <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-12">
          <section className="mb-12 grid lg:grid-cols-[1.4fr_1fr] gap-5 md:gap-6">
            <div className="relative overflow-hidden rounded-2xl border border-[var(--hotel-sand)] text-white p-6 md:p-8 shadow-[var(--hotel-shadow-strong)]">
              <ResilientImage
                sources={[HERO_PHOTOS_BY_DAYPART[dayPart], ...FORTH_IMAGE_FALLBACKS]}
                alt="FORTH guest experience backdrop"
                sizes="(max-width: 1024px) 100vw, 920px"
                className="absolute inset-0 h-full w-full object-cover forth-zoom-image"
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(12,11,11,0.78),rgba(20,18,16,0.86),rgba(14,13,12,0.92))]" />

              <div className="relative z-10">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--hotel-champagne)] mb-2">Your FORTH Guide</p>
                <h1 className="font-display text-3xl md:text-5xl leading-tight mb-3">{greeting.title}</h1>
                <p className="text-sm md:text-base text-white/75 max-w-[56ch] leading-relaxed">{greeting.subtitle}</p>

                <div className="mt-6 grid sm:grid-cols-2 gap-3">
                  {quickActions.map((action) => (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="rounded-xl border border-white/18 bg-white/5 px-4 py-3 text-sm tracking-wide hover:bg-white/12 transition-colors forth-hover-lift"
                    >
                      {action.label}
                    </Link>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={conciergePhoneLink}
                    className="rounded-full border border-white/18 bg-white/8 px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-white/88 hover:bg-white/14 transition-colors"
                  >
                    Call Concierge
                  </a>
                  <a
                    href={`sms:${conciergePhoneLink.replace("tel:", "")}`}
                    className="rounded-full border border-white/18 bg-white/8 px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-white/88 hover:bg-white/14 transition-colors"
                  >
                    Text Desk
                  </a>
                  <a
                    href="#guest-service-layer"
                    onClick={() => setExperienceView("operate")}
                    className="rounded-full border border-white/18 bg-white/8 px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-white/88 hover:bg-white/14 transition-colors"
                  >
                    In-Room Requests
                  </a>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--hotel-stone)] mb-4">Now / Next / Later</p>
              <div className="grid grid-cols-3 gap-2">
                <MetricCard
                  label="Live"
                  value={hasGuidedVenueFilter ? foodFocusedLiveDestinations.length : (specialsMeta?.active_now ?? liveDestinations.length)}
                />
                <MetricCard
                  label="Soon"
                  value={hasGuidedVenueFilter ? startingSoon.length : (specialsMeta?.starting_soon ?? startingSoon.length)}
                />
                <MetricCard
                  label="Walkable"
                  value={hasGuidedVenueFilter ? walkable.length : (specialsMeta?.tiers.walkable ?? walkable.length)}
                />
              </div>

              <div className="mt-5 space-y-2 text-xs text-[var(--hotel-stone)]">
                <div className="flex items-center justify-between border-b border-[var(--hotel-sand)] pb-2">
                  <span>Most reliable picks</span>
                  <span className="text-[var(--hotel-charcoal)]">{highConfidence}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Updated in last 24h</span>
                  <span className="text-[var(--hotel-charcoal)]">{refreshedToday}</span>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Active Profile</p>
                <p className="text-sm text-[var(--hotel-charcoal)] mt-1">{activePersona.label}</p>
                <p className="text-xs text-[var(--hotel-stone)] mt-1">Desk line: {conciergePhoneDisplay}</p>
              </div>

              <div className="mt-4 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Concierge Actions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href="#itinerary-composer"
                    onClick={() => setExperienceView("operate")}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Build Itinerary
                  </a>
                  <Link
                    href={isBriefMode ? fullExperiencePath : briefingPath}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                    onClick={() => setIsBriefMode((current) => !current)}
                  >
                    {isBriefMode ? "Full Experience" : "Share Summary"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      void copyBriefingLink();
                    }}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    {copiedBriefing ? "Copied" : "Copy Link"}
                  </button>
                </div>
              </div>

              {worldCupActive && (
                <div className="mt-5 rounded-xl border border-[var(--hotel-champagne)]/45 bg-[var(--hotel-ivory)] px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-champagne)]">World Cup Mode</p>
                  <p className="text-sm text-[var(--hotel-charcoal)] mt-1">Match-day watch parties and pre/post-match picks are prioritized.</p>
                </div>
              )}
            </div>
          </section>

          {showFullExperience && (
            <section className="mb-10 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Planning Console</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">Plan The Stay With Guided Preferences</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2 max-w-2xl">
                    Choose the guest profile, choose trip style, then set event and food/bar preferences.
                  </p>
                </div>
                <div className="w-full md:w-auto md:max-w-[430px]">
                  <OptionRail>
                    {EXPERIENCE_VIEW_OPTIONS.map((option) => (
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
              </div>
              <p className="mt-3 text-xs text-[var(--hotel-stone)]">{activeView.hint}</p>

              <div className="mt-5 grid lg:grid-cols-2 gap-5">
                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">1. Guest Profile</p>
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

                <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">2. Trip Style</p>
                  <OptionRail className="mt-2">
                    {GUEST_INTENT_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setGuestIntent(option.id)}
                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors whitespace-nowrap ${
                          guestIntent === option.id
                            ? "bg-[var(--hotel-champagne)] text-[var(--hotel-ink)]"
                            : "border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </OptionRail>
                  <p className="mt-2 text-xs text-[var(--hotel-stone)]">{activeIntent.hint}</p>
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">3. What Are You Looking For Tonight?</p>
                <p className="mt-2 text-sm text-[var(--hotel-stone)] max-w-3xl">
                  Pick a mode if you already know the vibe. If you do not, keep it open and we will balance all categories.
                </p>
                <OptionRail className="mt-3">
                  {DISCOVERY_FOCUS_OPTIONS.map((focus) => {
                    const counts = discoveryFocusCounts[focus.id] || { events: 0, venues: 0 };
                    return (
                      <button
                        key={focus.id}
                        type="button"
                        onClick={() => setDiscoveryFocusId(focus.id)}
                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors whitespace-nowrap ${
                          discoveryFocusId === focus.id
                            ? "bg-[var(--hotel-charcoal)] text-[var(--hotel-cream)]"
                            : "border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                        }`}
                      >
                        {focus.label} · {counts.events}/{counts.venues}
                      </button>
                    );
                  })}
                </OptionRail>
                <p className="mt-2 text-xs text-[var(--hotel-stone)]">{activeDiscoveryFocus.hint}</p>
                {activeDiscoveryFocus.id !== "any" && (
                  <div className="mt-3">
                    <Link
                      href={`/${portal.slug}?view=find&type=events&date=today&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`}
                      className="inline-flex rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-charcoal)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-cream)] hover:border-[var(--hotel-champagne)] transition-colors"
                    >
                      Matching Events
                    </Link>
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">4. Food + Drink Preferences</p>
                <p className="mt-2 text-sm text-[var(--hotel-stone)] max-w-3xl">
                  Tell the concierge what kind of venue you want right now and we will bias the destination stack.
                </p>
                <OptionRail className="mt-3">
                  {FOOD_DRINK_FOCUS_OPTIONS.map((focus) => {
                    const counts = foodDrinkFocusCounts[focus.id] || { venues: 0 };
                    return (
                      <button
                        key={focus.id}
                        type="button"
                        onClick={() => setFoodDrinkFocusId(focus.id)}
                        className={`rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] transition-colors whitespace-nowrap ${
                          foodDrinkFocusId === focus.id
                            ? "bg-[var(--hotel-charcoal)] text-[var(--hotel-cream)]"
                            : "border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] text-[var(--hotel-stone)] hover:border-[var(--hotel-champagne)]"
                        }`}
                      >
                        {focus.label} · {counts.venues}
                      </button>
                    );
                  })}
                </OptionRail>
                <p className="mt-2 text-xs text-[var(--hotel-stone)]">{activeFoodDrinkFocus.hint}</p>
                {activeFoodDrinkFocus.id !== "any" && (
                  <div className="mt-3">
                    <Link
                      href={`/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeFoodDrinkFocus.searchQuery)}`}
                      className="inline-flex rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-charcoal)] px-3 py-1.5 text-[10px] uppercase tracking-[0.13em] text-[var(--hotel-cream)] hover:border-[var(--hotel-champagne)] transition-colors"
                    >
                      Matching Venues
                    </Link>
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">5. Build My Tonight</p>
                <p className="mt-2 text-sm text-[var(--hotel-stone)] max-w-3xl">
                  Choose how bold tonight should feel. We will reorder itinerary candidates instantly.
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

              <div className="mt-5 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">6. Quick Plans</p>
                <div className="mt-3 flex gap-3 overflow-x-auto scroll-touch scrollbar-hide pb-1 pr-8">
                  {COMMAND_BUNDLES.map((bundle) => (
                    <button
                      key={bundle.id}
                      type="button"
                      onClick={() => applyCommandBundle(bundle)}
                      className={`rounded-xl border px-4 py-3 text-left transition-colors forth-hover-lift min-w-[220px] md:min-w-[240px] flex-shrink-0 ${
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
                <p className="mt-2 text-xs text-[var(--hotel-stone)]">Swipe to compare bundles and pick one primary path.</p>
              </div>
            </section>
          )}

          {showFullExperience && visitorPersona === "club_member" && (
            <section className="mb-12 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">FORTH Club</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">Member Opportunities Tonight</h2>
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

          {showFullExperience && visitorPersona !== "club_member" && (
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

          {showFullExperience && editorialMoments.length > 0 && (
            <section className="mb-14">
              <div className="flex items-start justify-between gap-4 mb-4">
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Shareable Summary</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)] mt-1">Tonight&apos;s Snapshot</h2>
                  <p className="text-sm text-[var(--hotel-stone)] mt-2">
                    A clean view you can share with your guest or travel companion.
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
            <section className="mb-14 grid xl:grid-cols-[1.45fr_1fr] gap-5">
            <div className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <div className="flex items-start justify-between gap-3 mb-4">
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
                    ? `/${portal.slug}?spot=${destination.venue.slug}`
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
                        <div className="flex items-start justify-between gap-3">
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

            <div className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
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
                      <div className="flex items-center justify-between gap-3">
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
                            ? `/${portal.slug}?spot=${destination.venue.slug}`
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

          {showOperate && (
          <section className="mb-14 grid xl:grid-cols-[1fr_1.35fr] gap-5">
            <div id="guest-service-layer" className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <div className="flex items-start justify-between gap-3">
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
                      <div className="flex items-start justify-between gap-3">
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

            <div id="itinerary-composer" className="rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6 shadow-[var(--hotel-shadow-medium)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">Plan Builder</p>
                  <h2 className="font-display text-2xl text-[var(--hotel-charcoal)]">Build Tonight&apos;s Plan</h2>
                </div>
                <div className="flex items-center gap-3">
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
                Pick a few moments below and we will build a clean step-by-step night plan.
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
                      <div className="flex items-start justify-between gap-3">
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
                          <div className="flex items-center justify-between gap-3">
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
          </section>
          )}

          {showOperate && foodFocusedLiveDestinations.length > 0 && (
            <HotelSection
              title={`Right Now: ${activeVenueGuidanceLabel}`}
              subtitle={hasGuidedVenueFilter
                ? "Live specials guided by your selected preferences with proximity and reliability indicators."
                : "Live specials with proximity and reliability indicators."}
              className="mb-14"
              action={{
                label: "All live destinations",
                href: activeFoodDrinkFocus.id !== "any"
                  ? `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeFoodDrinkFocus.searchQuery)}`
                  : activeDiscoveryFocus.id === "any"
                    ? `/${portal.slug}?view=find&type=destinations`
                    : `/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`,
              }}
            >
              <HotelCarousel>
                {foodFocusedLiveDestinations.slice(0, 18).map((destination) => (
                  <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[304px]">
                    <HotelDestinationCard destination={destination} portalSlug={portal.slug} variant="live" />
                  </div>
                ))}
              </HotelCarousel>
            </HotelSection>
          )}

          {showOperate && foodFocusedLiveDestinations.length === 0 && focusedLiveDestinations.length > 0 && (
            <HotelSection
              title="Right Now"
              subtitle="No direct matches for current food/drink filters yet. Showing broader nearby options."
              className="mb-14"
              action={{ label: "All live destinations", href: `/${portal.slug}?view=find&type=destinations` }}
            >
              <HotelCarousel>
                {focusedLiveDestinations.slice(0, 12).map((destination) => (
                  <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[304px]">
                    <HotelDestinationCard destination={destination} portalSlug={portal.slug} variant="live" />
                  </div>
                ))}
              </HotelCarousel>
            </HotelSection>
          )}

          {showOperate && startingSoon.length > 0 && (
            <section className="mb-14 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
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
                    href={`/${portal.slug}?spot=${destination.venue.slug}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3 hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--hotel-charcoal)]">{destination.venue.name}</p>
                      <p className="text-xs text-[var(--hotel-stone)]">
                        {destination.top_special?.title || "Special window opening"} · {destination.proximity_label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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

          {showOperate && guidedTonightEvents.length > 0 && (
            <HotelSection
              title="Tonight's Briefing"
              subtitle={activeDiscoveryFocus.id === "any"
                ? "The top event plus a compact stack for immediate decision-making."
                : `Focused on ${activeDiscoveryFocus.label.toLowerCase()} so guests can choose faster.`}
              className="mb-14"
              action={{
                label: "All events",
                href: activeDiscoveryFocus.id === "any"
                  ? `/${portal.slug}?view=find&type=events`
                  : `/${portal.slug}?view=find&type=events&search=${encodeURIComponent(activeDiscoveryFocus.searchQuery)}`,
              }}
            >
              <HotelHeroCard event={guidedTonightEvents[0]} portalSlug={portal.slug} />
              {topTonightEvent && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/${portal.slug}/events/${topTonightEvent.id}`}
                    className="rounded-full border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] px-3 py-1.5 text-[11px] uppercase tracking-[0.13em] text-[var(--hotel-charcoal)] hover:border-[var(--hotel-champagne)] transition-colors"
                  >
                    Open event
                  </Link>
                  <Link
                    href={`/${portal.slug}?view=find&type=destinations&search=${encodeURIComponent(topTonightEvent.venue_name || topTonightEvent.title)}`}
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
                    More tonight
                  </Link>
                </div>
              )}
              {guidedTonightEvents.length > 1 && (
                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {guidedTonightEvents.slice(1, 7).map((event) => (
                    <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" />
                  ))}
                </div>
              )}
            </HotelSection>
          )}

          {showExplore && beltline.length > 0 && (
            <section className="mb-14 rounded-2xl border border-[var(--hotel-sand)] bg-[var(--hotel-cream)] p-5 md:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
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
                    <Link href={`/${portal.slug}?spot=${destination.venue.slug}`} className="block rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-4 py-3 hover:border-[var(--hotel-champagne)] transition-colors">
                      <div className="flex items-center justify-between gap-3">
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

          {showFullExperience && ((showProperty && propertyDestinations.length > 0) || (showExplore && walkable.length > 0)) && (
            <section className="mb-14 grid lg:grid-cols-2 gap-5">
              {showProperty && propertyDestinations.length > 0 && (
                <HotelSection title="Near FORTH" subtitle="Closest destinations adjacent to the hotel footprint." className="mb-0">
                  <HotelCarousel>
                    {propertyDestinations.map((destination) => (
                      <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[286px]">
                        <HotelDestinationCard destination={destination} portalSlug={portal.slug} />
                      </div>
                    ))}
                  </HotelCarousel>
                </HotelSection>
              )}

              {showExplore && walkable.length > 0 && (
                <HotelSection title="Walkable" subtitle="Best options within a short walk from FORTH." className="mb-0">
                  <HotelCarousel>
                    {walkable.map((destination) => (
                      <div key={destination.venue.id} className="flex-shrink-0 snap-start w-[286px]">
                        <HotelDestinationCard destination={destination} portalSlug={portal.slug} />
                      </div>
                    ))}
                  </HotelCarousel>
                </HotelSection>
              )}
            </section>
          )}

          {showExplore && (categorized.dine.length > 0 || categorized.drink.length > 0 || picksSection?.events.length) && (
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
                      <HotelEventCard key={event.id} event={event} portalSlug={portal.slug} variant="compact" />
                    ))}
                  </div>
                </HotelSection>
              )}
            </section>
          )}

          {sections.length === 0 && destinations.length === 0 && (
            <div className="text-center py-20">
              <p className="font-display text-3xl text-[var(--hotel-charcoal)] mb-3">FORTH concierge data is warming up</p>
              <p className="font-body text-[var(--hotel-stone)]">Refresh shortly to see live destination intelligence and tonight&apos;s recommendations.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--hotel-sand)] bg-[var(--hotel-ivory)] px-3 py-3 text-center">
      <p className="font-display text-2xl text-[var(--hotel-charcoal)] leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-[var(--hotel-stone)]">{label}</p>
    </div>
  );
}

function OptionRail({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-2 overflow-x-auto scroll-touch scrollbar-hide pb-1 pr-8">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--hotel-cream)] to-transparent" />
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
