import {
  Ticket,
  FilmSlate,
  Trophy,
  ArrowsClockwise,
  MapPin,
  GraduationCap,
  CalendarBlank,
  MapTrifold,
} from "@phosphor-icons/react/dist/ssr";
import type { LaneSlug } from "@/lib/types/explore-home";

export type LegacyLaneSlug = LaneSlug | "calendar" | "map";

export interface LaneMeta {
  label: string;
  mobileLabel: string;
  accent: string;
  href: string;
  zeroCta: string;
  badgePrefix?: string;
}

export const LANE_META: Record<LegacyLaneSlug, LaneMeta> = {
  events:        { label: "EVENTS",             mobileLabel: "Events",   accent: "var(--coral)",        href: "?lane=events",    zeroCta: "" },
  shows:         { label: "SHOWS",              mobileLabel: "Shows",    accent: "var(--vibe)",         href: "?lane=shows",     zeroCta: "" },
  "game-day":    { label: "GAME DAY",           mobileLabel: "Game Day", accent: "var(--neon-cyan)",    href: "?lane=game-day",  zeroCta: "" },
  regulars:      { label: "REGULARS",           mobileLabel: "Regulars", accent: "var(--gold)",         href: "?lane=regulars",  zeroCta: "", badgePrefix: "TODAY" },
  places:        { label: "PLACES",             mobileLabel: "Places",   accent: "var(--neon-green)",   href: "?lane=places",    zeroCta: "" },
  classes:       { label: "CLASSES & WORKSHOPS", mobileLabel: "Classes", accent: "var(--copper)",       href: "?lane=classes",   zeroCta: "Coming soon — know a great class?" },
  calendar:      { label: "CALENDAR",           mobileLabel: "Calendar", accent: "var(--neon-amber)",   href: "?lane=events&display=calendar",  zeroCta: "" },
  map:           { label: "MAP",                mobileLabel: "Map",      accent: "var(--neon-magenta)", href: "?lane=events&display=map",       zeroCta: "" },
};

export type { LaneSlug };

export const LANE_SLUGS = Object.keys(LANE_META) as LegacyLaneSlug[];
export const SHELL_LANE_SET: Set<string> = new Set(LANE_SLUGS);

export const BROWSE_LANES: LaneSlug[] = [
  "events", "shows", "game-day", "regulars", "places", "classes",
];
export const VIEW_LANES: LegacyLaneSlug[] = ["calendar", "map"];

export const LANE_ICONS: Record<LegacyLaneSlug, typeof Ticket> = {
  events: Ticket,
  shows: FilmSlate,
  "game-day": Trophy,
  regulars: ArrowsClockwise,
  places: MapPin,
  classes: GraduationCap,
  calendar: CalendarBlank,
  map: MapTrifold,
};
