import type { FindType } from "@/lib/find-filter-schema";

const FIND_TYPE_LABELS: Record<FindType, string> = {
  events: "Events",
  classes: "Classes",
  destinations: "Places",
  showtimes: "Now Playing",
  regulars: "Regulars",
};

export function getFindTypeLabel(findType: FindType): string {
  return FIND_TYPE_LABELS[findType];
}

export function getFindSearchSubtitle(resultType: "event" | "venue"): string {
  return resultType === "venue" ? "Search places" : "Search events";
}
