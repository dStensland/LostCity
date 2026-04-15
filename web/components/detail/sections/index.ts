import type { SectionId, SectionModule } from "@/lib/detail/types";
import {
  hasDescription,
  hasConnections,
  hasProducer,
  hasShowSignals,
  hasOccasions,
  hasArtists,
  hasSocialData,
  hasLocation,
  hasEditorialMentions,
  hasSpecials,
  hasScreenings,
  hasDiningProfile,
  hasExhibitions,
  hasFeatures,
  hasCoordinates,
  hasPrograms,
  hasUpcomingEvents,
  hasVolunteerOpportunities,
  hasAdmission,
  hasAccessibility,
} from "@/lib/detail/traits";
import { AboutSection } from "./AboutSection";
import { ConnectionsSection } from "./ConnectionsSection";
import { ProducerSection } from "./ProducerSection";
import { ShowSignalsSection } from "./ShowSignalsSection";
import { OccasionsSection } from "./OccasionsSection";
import { LineupSection } from "./LineupSection";
import { SocialProofSection } from "./SocialProofSection";
import { GettingThereSection } from "./GettingThereSection";
import { AccoladesSection } from "./AccoladesSection";
import { SpecialsSection } from "./SpecialsSection";
import { ShowtimesSection } from "./ShowtimesSection";
import { DiningSection } from "./DiningSection";
import { ExhibitionsSection } from "./ExhibitionsSection";
import { FeaturesSection } from "./FeaturesSection";
import { NearbySection } from "./NearbySection";
import { ScheduleSection } from "./ScheduleSection";
import { UpcomingDatesSection } from "./UpcomingDatesSection";
import { EventsAtVenueSection } from "./EventsAtVenueSection";
import { VolunteerSection } from "./VolunteerSection";
import { PlanYourVisitSection } from "./PlanYourVisitSection";
import {
  Article,
  Graph,
  Buildings,
  SpeakerSimpleHigh,
  Heart,
  Microphone,
  Users,
  MapPin,
  Star,
  BeerBottle,
  FilmSlate,
  ForkKnife,
  FrameCorners,
  Sparkle,
  ArrowsOutCardinal,
  CalendarBlank,
  RepeatOnce,
  CalendarDots,
  HandHeart,
  Ticket,
} from "@phosphor-icons/react";

// ─── Batch 1: Simple sections ────────────────────────────────────────────────

const about: SectionModule = {
  id: "about",
  component: AboutSection,
  trait: hasDescription,
  label: "About",
  icon: Article,
  allowedEntityTypes: ["event", "place", "series", "festival", "org"],
};

const connections: SectionModule = {
  id: "connections",
  component: ConnectionsSection,
  trait: hasConnections,
  label: "Connections",
  icon: Graph,
  allowedEntityTypes: ["event", "place", "series", "festival", "org"],
};

const producer: SectionModule = {
  id: "producer",
  component: ProducerSection,
  trait: hasProducer,
  label: "Presented By",
  icon: Buildings,
  allowedEntityTypes: ["event", "festival"],
};

const showSignals: SectionModule = {
  id: "showSignals",
  component: ShowSignalsSection,
  trait: hasShowSignals,
  label: "Show Info",
  icon: SpeakerSimpleHigh,
  allowedEntityTypes: ["event"],
};

const occasions: SectionModule = {
  id: "occasions",
  component: OccasionsSection,
  trait: hasOccasions,
  label: "Good For",
  icon: Heart,
  allowedEntityTypes: ["place"],
};

// ─── Batch 2: Social, transit, editorial ────────────────────────────────────

const lineup: SectionModule = {
  id: "lineup",
  component: LineupSection,
  trait: hasArtists,
  label: "Lineup",
  icon: Microphone,
  allowedEntityTypes: ["event"],
  getCount: (data) =>
    data.entityType === "event" ? (data.payload.eventArtists?.length ?? null) : null,
};

const socialProof: SectionModule = {
  id: "socialProof",
  component: SocialProofSection,
  trait: hasSocialData,
  label: "Who's Going",
  icon: Users,
  allowedEntityTypes: ["event", "place"],
};

const gettingThere: SectionModule = {
  id: "gettingThere",
  component: GettingThereSection,
  trait: hasLocation,
  label: "Getting There",
  icon: MapPin,
  allowedEntityTypes: ["event", "place", "series", "festival"],
};

const accolades: SectionModule = {
  id: "accolades",
  component: AccoladesSection,
  trait: hasEditorialMentions,
  label: "Featured In",
  icon: Star,
  allowedEntityTypes: ["place"],
  getCount: (data) =>
    data.entityType === "place"
      ? ((data.payload.editorialMentions as unknown[])?.length ?? null)
      : null,
};

const specials: SectionModule = {
  id: "specials",
  component: SpecialsSection,
  trait: hasSpecials,
  label: "Deals & Specials",
  icon: BeerBottle,
  allowedEntityTypes: ["place"],
  getCount: (data) =>
    data.entityType === "place"
      ? ((data.payload.specials as unknown[])?.length ?? null)
      : null,
};

// ─── Registry ─────────────────────────────────────────────────────────────────

// ─── Batch 3: Content-heavy sections ────────────────────────────────────────

const showtimes: SectionModule = {
  id: "showtimes",
  component: ShowtimesSection,
  trait: hasScreenings,
  label: "Showtimes",
  icon: FilmSlate,
  allowedEntityTypes: ["place", "series", "festival"],
};

const dining: SectionModule = {
  id: "dining",
  component: DiningSection,
  trait: hasDiningProfile,
  label: "Dining Details",
  icon: ForkKnife,
  allowedEntityTypes: ["place"],
};

const exhibitions: SectionModule = {
  id: "exhibitions",
  component: ExhibitionsSection,
  trait: hasExhibitions,
  label: "On View",
  icon: FrameCorners,
  allowedEntityTypes: ["place", "festival"],
  getCount: (data) =>
    data.entityType === "place"
      ? ((data.payload.exhibitions as unknown[])?.length ?? null)
      : null,
};

const features: SectionModule = {
  id: "features",
  component: FeaturesSection,
  trait: hasFeatures,
  label: "Features & Attractions",
  icon: Sparkle,
  allowedEntityTypes: ["place"],
  getCount: (data) =>
    data.entityType === "place"
      ? ((data.payload.features as unknown[])?.length ?? null)
      : null,
};

const nearby: SectionModule = {
  id: "nearby",
  component: NearbySection,
  trait: hasCoordinates,
  label: "Nearby",
  icon: ArrowsOutCardinal,
  allowedEntityTypes: ["event", "place"],
};

// ─── Batch 4: Schedule, events, admin sections ──────────────────────────────

const schedule: SectionModule = {
  id: "schedule",
  component: ScheduleSection,
  trait: hasPrograms,
  label: "Schedule",
  icon: CalendarBlank,
  allowedEntityTypes: ["festival"],
  getCount: (data) =>
    data.entityType === "festival" ? (data.payload.programs?.length ?? null) : null,
};

const upcomingDates: SectionModule = {
  id: "upcomingDates",
  component: UpcomingDatesSection,
  trait: (data) =>
    data.entityType === "series" &&
    data.payload.series.series_type !== "film" &&
    data.payload.venueShowtimes?.length > 0,
  label: "Upcoming Dates",
  icon: RepeatOnce,
  allowedEntityTypes: ["series"],
};

const eventsAtVenue: SectionModule = {
  id: "eventsAtVenue",
  component: EventsAtVenueSection,
  trait: hasUpcomingEvents,
  label: "Upcoming Events",
  icon: CalendarDots,
  allowedEntityTypes: ["place", "org"],
};

const volunteer: SectionModule = {
  id: "volunteer",
  component: VolunteerSection,
  trait: hasVolunteerOpportunities,
  label: "Volunteer",
  icon: HandHeart,
  allowedEntityTypes: ["org"],
  getCount: (data) =>
    data.entityType === "org"
      ? (data.payload.volunteer_opportunities?.length ?? null)
      : null,
};

const planYourVisit: SectionModule = {
  id: "planYourVisit",
  component: PlanYourVisitSection,
  trait: (data) => hasAdmission(data) || hasAccessibility(data),
  label: "Plan Your Visit",
  icon: Ticket,
  allowedEntityTypes: ["place"],
};

const modules: SectionModule[] = [
  about,
  connections,
  producer,
  showSignals,
  occasions,
  lineup,
  socialProof,
  gettingThere,
  accolades,
  specials,
  showtimes,
  dining,
  exhibitions,
  features,
  nearby,
  schedule,
  upcomingDates,
  eventsAtVenue,
  volunteer,
  planYourVisit,
];

export const sectionRegistry = new Map<SectionId, SectionModule>(
  modules.map((m) => [m.id, m]),
);
