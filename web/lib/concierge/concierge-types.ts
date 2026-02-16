/**
 * Concierge Framework Types
 *
 * Shared types for the pillar-based concierge experience.
 * Re-exports FORTH types for backward compatibility.
 */

// Re-export all existing FORTH types for backward compat
export type {
  DayPart,
  FeedSection,
  FeedEvent,
  Destination,
  SpecialsMeta,
  AgentNarrative,
  SignatureVenue,
  ForthAmenity,
  InRoomRequest,
  QuickAction,
  ForthFeedData,
  ForthPropertyData,
} from "@/lib/forth-types";

export { phoneHref } from "@/lib/forth-types";

// Re-export weather types
export type { WeatherData, WeatherSignal } from "@/lib/weather-utils";

// ---------------------------------------------------------------------------
// Concierge Framework Types
// ---------------------------------------------------------------------------

export type Pillar = "services" | "around" | "planner";

export type GuestPhase = "pre_arrival" | "in_stay" | "post_stay";

export interface PillarConfig {
  id: Pillar;
  label: string;
  icon: string;
  /** Dynamic badge text (e.g. "3 live") */
  badge?: string;
}

export interface ConciergeConfig {
  portalSlug: string;
  portalName: string;
  experienceVariant: string;
  defaultPillar: Pillar;
  pillars: PillarConfig[];
  guestPhase: GuestPhase;
  skipOnboarding?: boolean;
  conciergePhone: string;
}

export interface ServicesPillarData {
  signatureVenues: import("@/lib/forth-types").SignatureVenue[];
  amenities: import("@/lib/forth-types").ForthAmenity[];
  inRoomServices: import("@/lib/forth-types").InRoomRequest[];
  conciergePhone: string;
}

export interface AroundYouPillarData {
  destinations: import("@/lib/forth-types").Destination[];
  liveDestinations: import("@/lib/forth-types").Destination[];
  tonightEvents: import("@/lib/forth-types").FeedEvent[];
  specialsMeta: import("@/lib/forth-types").SpecialsMeta | null;
  sections: import("@/lib/forth-types").FeedSection[];
  dayOfWeek: number;
}

export interface PlannerPillarData {
  sections: import("@/lib/forth-types").FeedSection[];
}

export interface ConciergePillarData {
  services: ServicesPillarData;
  around: AroundYouPillarData;
  planner: PlannerPillarData;
}

export interface AmbientContext {
  dayPart: import("@/lib/forth-types").DayPart;
  greeting: { title: string; subtitle: string };
  quickActions: import("@/lib/forth-types").QuickAction[];
  heroPhoto: string;
  hasWeather: boolean;
  weatherSignal: import("@/lib/weather-utils").WeatherSignal;
  weatherModifiers: { indoor: number; outdoor: number; rooftop: number; cozy: number };
  weatherBadge: string | null;
}

export interface ConciergeExperienceData {
  config: ConciergeConfig;
  pillarData: ConciergePillarData;
  ambient: AmbientContext;
  agentNarrative: import("@/lib/forth-types").AgentNarrative | null;
}
