import type { LaneSlug } from "@/lib/types/explore-home";

export interface LaneMeta {
  label: string;
  mobileLabel: string;
  accent: string;
  href: string;
  zeroCta: string;
  badgePrefix?: string;
}

export const LANE_META: Record<LaneSlug, LaneMeta> = {
  events:        { label: "EVENTS",             mobileLabel: "Events",   accent: "var(--coral)",        href: "?view=find&lane=events",    zeroCta: "" },
  shows:         { label: "SHOWS",              mobileLabel: "Shows",    accent: "var(--coral)",        href: "?view=find&lane=shows",     zeroCta: "" },
  regulars:      { label: "REGULARS",            mobileLabel: "Regulars", accent: "var(--gold)",         href: "?view=find&lane=regulars",  zeroCta: "", badgePrefix: "TODAY" },
  places:        { label: "PLACES",              mobileLabel: "Places",   accent: "var(--neon-green)",   href: "?view=find&lane=places",    zeroCta: "" },
  classes:       { label: "CLASSES & WORKSHOPS", mobileLabel: "Classes",  accent: "#C9874F",             href: "?view=find&lane=classes",   zeroCta: "Coming soon — know a great class?" },
  calendar:      { label: "CALENDAR",            mobileLabel: "Calendar", accent: "var(--neon-green)",   href: "?view=find&lane=calendar",  zeroCta: "" },
  map:           { label: "MAP",                 mobileLabel: "Map",      accent: "var(--neon-cyan)",    href: "?view=find&lane=map",       zeroCta: "" },
};
