import type { EventWithLocation } from "@/lib/search";
import type { Festival } from "@/lib/festivals";
import type {
  ClassesResponse,
  StudiosResponse,
} from "@/lib/hooks/useClassesData";
import type { MusicShow } from "@/components/find/MusicShowCard";
import type { StageShow } from "@/components/find/StageShowCard";
import type { TeamSchedule } from "@/lib/teams-config";

export interface TimelineResponse {
  events: EventWithLocation[];
  festivals: Festival[];
  cursor: string | null;
  hasMore: boolean;
}

export interface EventsLaneInitialData {
  initialPage: TimelineResponse;
  effectiveDate: string | null;
  filterSnapshot: string;
}

export interface PlacesLaneInitialData {
  spots: PlaceSeedSpot[];
  meta: { openCount: number; neighborhoods: string[] };
  requestKey: string;
}

export interface PlaceSeedSpot {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  place_type: string | null;
  location_designator?: "standard" | "private_after_signup" | "virtual" | "recovery_meeting" | null;
  image_url: string | null;
  event_count?: number;
  price_level: number | null;
  lat?: number | null;
  lng?: number | null;
  short_description: string | null;
  is_open?: boolean;
  closes_at?: string;
  is_24_hours?: boolean | null;
  distance_km?: number | null;
  upcoming_events?: Array<{
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
  }>;
}

export interface ClassesLaneInitialData {
  studios?: StudiosResponse | null;
  schedule?: ClassesResponse | null;
  studioSlug?: string | null;
  requestKey: string;
}

export type ShowsTab = "film" | "music" | "theater" | "comedy";

export interface ShowtimesMeta {
  available_dates: string[];
  available_theaters: Array<{
    venue_id: number;
    venue_name: string;
    venue_slug: string;
    neighborhood: string | null;
  }>;
  available_films: Array<{
    title: string;
    series_id: string | null;
    series_slug: string | null;
    image_url: string | null;
  }>;
}

export interface ShowtimeEntry {
  time: string;
  event_id: number;
}

export interface ShowtimesFilm {
  title: string;
  series_id: string | null;
  series_slug: string | null;
  image_url: string | null;
  theaters: Array<{
    venue_id: number;
    venue_name: string;
    venue_slug: string;
    neighborhood: string | null;
    times: ShowtimeEntry[];
  }>;
}

export interface ShowtimesTheaterGroup {
  venue_id: number;
  venue_name: string;
  venue_slug: string;
  neighborhood: string | null;
  films: Array<{
    title: string;
    series_id: string | null;
    series_slug: string | null;
    image_url: string | null;
    genres?: string[];
    director?: string | null;
    runtime_minutes?: number | null;
    rating?: string | null;
    year?: number | null;
    screen_name?: string | null;
    times: ShowtimeEntry[];
  }>;
}

export interface ShowsFilmInitialData {
  tab: "film";
  date: string;
  viewMode: "by-theater" | "by-movie";
  meta: ShowtimesMeta;
  theaters: ShowtimesTheaterGroup[];
  films?: ShowtimesFilm[];
  requestKey: string;
}

export interface ShowsListingsInitialData<TTab extends "music" | "theater" | "comedy"> {
  tab: TTab;
  date: string;
  meta: { available_dates: string[] };
  shows: TTab extends "music" ? MusicShow[] : StageShow[];
  requestKey: string;
}

export type ShowsLaneInitialData =
  | ShowsFilmInitialData
  | ShowsListingsInitialData<"music">
  | ShowsListingsInitialData<"theater">
  | ShowsListingsInitialData<"comedy">;

export interface RegularsLaneEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean | null;
  venue: { name: string | null };
  activity_type: string | null;
  recurrence_label: string | null;
}

export interface RegularsLaneInitialData {
  events: RegularsLaneEvent[];
  requestKey: string;
}

export interface GameDayLaneInitialData {
  teams: TeamSchedule[];
  requestKey: string;
}

export type ExploreLaneInitialDataMap = {
  events: EventsLaneInitialData;
  places: PlacesLaneInitialData;
  classes: ClassesLaneInitialData;
  shows: ShowsLaneInitialData;
  regulars: RegularsLaneInitialData;
  "game-day": GameDayLaneInitialData;
  neighborhoods: null;
};
