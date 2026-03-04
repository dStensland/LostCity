export type FestivalLayout = {
  typeLabel: string;
  scheduleTitle: string;
  showLineup: boolean;
  showTracks: boolean;
  showCategoryFilters: boolean;
  showProgramFilters: boolean;
};

const FESTIVAL_LAYOUTS: Record<string, FestivalLayout> = {
  festival:   { typeLabel: "Festival",   scheduleTitle: "Schedule",       showLineup: true,  showTracks: true,  showCategoryFilters: true,  showProgramFilters: true },
  conference: { typeLabel: "Conference", scheduleTitle: "Schedule",       showLineup: false, showTracks: true,  showCategoryFilters: true,  showProgramFilters: true },
  convention: { typeLabel: "Convention", scheduleTitle: "Schedule",       showLineup: false, showTracks: true,  showCategoryFilters: true,  showProgramFilters: true },
  expo:       { typeLabel: "Expo",       scheduleTitle: "Schedule",       showLineup: false, showTracks: true,  showCategoryFilters: true,  showProgramFilters: true },
  market:     { typeLabel: "Market",     scheduleTitle: "Hours & Events", showLineup: false, showTracks: false, showCategoryFilters: false, showProgramFilters: false },
  fair:       { typeLabel: "Fair",       scheduleTitle: "Hours & Events", showLineup: false, showTracks: false, showCategoryFilters: false, showProgramFilters: false },
  tournament: { typeLabel: "Tournament", scheduleTitle: "Schedule",       showLineup: false, showTracks: false, showCategoryFilters: true,  showProgramFilters: false },
};

const DEFAULT_LAYOUT: FestivalLayout = FESTIVAL_LAYOUTS.festival;

export function getFestivalLayout(festivalType?: string | null): FestivalLayout {
  return FESTIVAL_LAYOUTS[festivalType || "festival"] || DEFAULT_LAYOUT;
}
