import type { SectionId } from "@/lib/detail/types";

const filmSeriesManifest: SectionId[] = [
  "showtimes",
  "about",
  "connections",
  "gettingThere",
];

const recurringSeriesManifest: SectionId[] = [
  "upcomingDates",
  "about",
  "connections",
  "gettingThere",
];

export function getSeriesManifest(isFilm: boolean): SectionId[] {
  return isFilm ? filmSeriesManifest : recurringSeriesManifest;
}
