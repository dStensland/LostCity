// web/lib/film/schedule-loader.ts
import 'server-only';
import { loadTodayPlaybill } from './today-playbill-loader';
import type { SchedulePayload } from './types';

// Atlanta coordinates — reserved for Plan 4 when suncalc is wired in.
// For v1 this loader returns null sunrise/sunset and the Schedule view
// UI (Plan 4) either installs suncalc or swaps in a server helper.
const ATLANTA_LAT = 33.749;
const ATLANTA_LNG = -84.388;

async function computeSun(date: string): Promise<{
  sunrise: string | null;
  sunset: string | null;
}> {
  void ATLANTA_LAT;
  void ATLANTA_LNG;
  void date;
  return { sunrise: null, sunset: null };
}

export async function loadSchedule(args: {
  portalSlug: string;
  date: string;
  includeAdditional?: boolean;
  additionalVenueIds?: number[];
}): Promise<SchedulePayload> {
  const playbill = await loadTodayPlaybill(args);
  const sun = await computeSun(args.date);
  return {
    portal_slug: playbill.portal_slug,
    date: playbill.date,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    venues: playbill.venues,
  };
}
