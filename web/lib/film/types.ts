// web/lib/film/types.ts
// Shared payload types for /api/film/* routes.

export type VenueClassification =
  | 'editorial_program'
  | 'premium_format'
  | 'additional';

export type ProgrammingStyle =
  | 'repertory'
  | 'indie'
  | 'arthouse'
  | 'drive_in'
  | 'festival';

export type FormatToken =
  | 'true_imax'
  | 'imax'
  | 'dolby_cinema'
  | '4dx'
  | 'screenx'
  | 'rpx'
  | '70mm'
  | '35mm'
  | 'atmos';

export type FilmVenue = {
  id: number;
  slug: string;
  name: string;
  neighborhood: string | null;
  classification: VenueClassification;
  programming_style: ProgrammingStyle | null;
  venue_formats: FormatToken[];
  founding_year: number | null;
  google_rating: number | null;
};

export type FilmScreening = {
  run_id: string;
  screening_title_id: string;
  title: string;
  slug: string;
  director: string | null;
  year: number | null;
  runtime_minutes: number | null;
  rating: string | null;
  image_url: string | null;
  editorial_blurb: string | null;
  film_press_quote: string | null;
  film_press_source: string | null;
  is_premiere: boolean;
  premiere_scope: 'atl' | 'us' | 'world' | null;
  is_curator_pick: boolean;
  festival_id: string | null;
  festival_name: string | null;
  venue: FilmVenue;
  times: Array<{
    id: string;
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    format_labels: FormatToken[];
    status: 'scheduled' | 'cancelled' | 'sold_out';
    ticket_url: string | null;
    event_id: number | null;
  }>;
};

export type HeroReason =
  | 'curator_pick'
  | 'opens_this_week'
  | 'festival'
  | 'special_format'
  | 'closes_this_week';

export type ThisWeekPayload = {
  portal_slug: string;
  iso_week_start: string;
  iso_week_end: string;
  heroes: Array<FilmScreening & { hero_reason: HeroReason }>;
};

export type TodayPlaybillPayload = {
  portal_slug: string;
  date: string;
  venues: Array<{
    venue: FilmVenue;
    screenings: FilmScreening[];
  }>;
  total_screenings: number;
};

export type SchedulePayload = {
  portal_slug: string;
  date: string;
  sunrise: string | null;
  sunset: string | null;
  venues: Array<{
    venue: FilmVenue;
    screenings: FilmScreening[];
  }>;
};

// --- By Film view (Plan 5) -------------------------------------------------

export type EditorialGroup = 'opens' | 'now' | 'closes';

export type FilmByFilmEntry = {
  film: {
    screening_title_id: string;
    slug: string;
    title: string;
    director: string | null;
    year: number | null;
    runtime_minutes: number | null;
    rating: string | null;
    image_url: string | null;
    editorial_blurb: string | null;
    film_press_quote: string | null;
    film_press_source: string | null;
    is_premiere: boolean;
    premiere_scope: 'atl' | 'us' | 'world' | null;
    genres: string[] | null;
  };
  editorial_group: EditorialGroup;
  run_first_date: string;
  run_last_date: string;
  venues: Array<{
    venue: FilmVenue;
    times: Array<{
      id: string;
      start_date: string;
      start_time: string | null;
      format_labels: FormatToken[];
      status: 'scheduled' | 'cancelled' | 'sold_out';
    }>;
  }>;
};

export type ByFilmPayload = {
  portal_slug: string;
  date: string;
  iso_week_start: string;
  iso_week_end: string;
  films: FilmByFilmEntry[];
  total_screenings: number;
};
