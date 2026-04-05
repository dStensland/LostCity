import {
  CalendarBlank,
  FilmSlate,
  GraduationCap,
  MapPin,
  Ticket,
  Trophy,
  ArrowsClockwise,
} from "@phosphor-icons/react/dist/ssr";
import type { Portal } from "@/lib/portal-context";
import type { ExploreLaneDefinition, ExploreLaneId } from "./types";

const loadEventsLane = () =>
  import("@/components/explore-platform/lanes/ExploreEventsLane").then(
    (mod) => mod.ExploreEventsLane,
  );
const loadShowsLane = () =>
  import("@/components/explore-platform/lanes/ExploreShowsLane").then(
    (mod) => mod.ExploreShowsLane,
  );
const loadGameDayLane = () =>
  import("@/components/explore-platform/lanes/ExploreGameDayLane").then(
    (mod) => mod.ExploreGameDayLane,
  );
const loadRegularsLane = () =>
  import("@/components/explore-platform/lanes/ExploreRegularsLane").then(
    (mod) => mod.ExploreRegularsLane,
  );
const loadPlacesLane = () =>
  import("@/components/explore-platform/lanes/ExplorePlacesLane").then(
    (mod) => mod.ExplorePlacesLane,
  );
const loadClassesLane = () =>
  import("@/components/explore-platform/lanes/ExploreClassesLane").then(
    (mod) => mod.ExploreClassesLane,
  );

function isConsumerPortal(portal: Portal): boolean {
  return !["hotel", "dog", "marketplace"].includes(
    String(portal.settings?.vertical ?? "city"),
  );
}

const ALL_LANES: Record<ExploreLaneId, ExploreLaneDefinition> = {
  events: {
    id: "events",
    label: "Events",
    icon: Ticket,
    accentToken: "var(--coral)",
    description: "What's happening now and next.",
    enabled: isConsumerPortal,
    preload: loadEventsLane,
    loadComponent: loadEventsLane,
    clientHydrationKey: "events-v1",
    analyticsKey: "explore_events_lane",
    searchPrompts: ["tonight", "free", "live music", "this weekend"],
    supportsSearch: true,
    supportsMap: true,
    supportsCalendar: true,
  },
  shows: {
    id: "shows",
    label: "Shows",
    icon: FilmSlate,
    accentToken: "var(--vibe)",
    description: "Film, music, theater, and comedy.",
    enabled: isConsumerPortal,
    preload: loadShowsLane,
    loadComponent: loadShowsLane,
    clientHydrationKey: "shows-v1",
    analyticsKey: "explore_shows_lane",
    searchPrompts: ["movies", "standup", "live music", "stage"],
    supportsSearch: true,
    supportsMap: false,
    supportsCalendar: false,
  },
  "game-day": {
    id: "game-day",
    label: "Game Day",
    icon: Trophy,
    accentToken: "var(--neon-cyan)",
    description: "Atlanta teams and schedules.",
    enabled: isConsumerPortal,
    preload: loadGameDayLane,
    loadComponent: loadGameDayLane,
    clientHydrationKey: "game-day-v1",
    analyticsKey: "explore_game_day_lane",
    searchPrompts: ["Falcons", "Hawks", "Atlanta United", "Braves"],
    supportsSearch: false,
    supportsMap: false,
    supportsCalendar: false,
  },
  regulars: {
    id: "regulars",
    label: "Regulars",
    icon: ArrowsClockwise,
    accentToken: "var(--gold)",
    description: "Trivia, karaoke, open mic, and other regulars.",
    enabled: isConsumerPortal,
    preload: loadRegularsLane,
    loadComponent: loadRegularsLane,
    clientHydrationKey: "regulars-v1",
    analyticsKey: "explore_regulars_lane",
    searchPrompts: ["trivia", "karaoke", "run club", "open mic"],
    supportsSearch: true,
    supportsMap: false,
    supportsCalendar: false,
  },
  places: {
    id: "places",
    label: "Places",
    icon: MapPin,
    accentToken: "var(--neon-green)",
    description: "Restaurants, bars, parks, museums, and more.",
    enabled: isConsumerPortal,
    preload: loadPlacesLane,
    loadComponent: loadPlacesLane,
    clientHydrationKey: "places-v1",
    analyticsKey: "explore_places_lane",
    searchPrompts: ["brunch", "cocktails", "parks", "coffee"],
    supportsSearch: true,
    supportsMap: false,
    supportsCalendar: false,
  },
  classes: {
    id: "classes",
    label: "Classes",
    icon: GraduationCap,
    accentToken: "var(--copper)",
    description: "Classes, workshops, and programs.",
    enabled: isConsumerPortal,
    preload: loadClassesLane,
    loadComponent: loadClassesLane,
    clientHydrationKey: "classes-v1",
    analyticsKey: "explore_classes_lane",
    searchPrompts: ["pottery", "dance class", "swim lessons", "workshop"],
    supportsSearch: true,
    supportsMap: false,
    supportsCalendar: false,
  },
};

export const EXPLORE_LANE_ORDER: ExploreLaneId[] = [
  "events",
  "shows",
  "game-day",
  "regulars",
  "places",
  "classes",
];

export function getExploreLaneRegistry(): Record<
  ExploreLaneId,
  ExploreLaneDefinition
> {
  return ALL_LANES;
}

export function getEnabledExploreLanes(portal: Portal): ExploreLaneDefinition[] {
  return EXPLORE_LANE_ORDER.map((laneId) => ALL_LANES[laneId]).filter((lane) =>
    lane.enabled(portal),
  );
}

export const EXPLORE_EVENTS_UTILITY_VIEWS = [
  {
    id: "list",
    label: "List",
    icon: Ticket,
    accentToken: "var(--coral)",
  },
  {
    id: "map",
    label: "Map",
    icon: MapPin,
    accentToken: "var(--neon-magenta)",
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: CalendarBlank,
    accentToken: "var(--neon-amber)",
  },
] as const;
