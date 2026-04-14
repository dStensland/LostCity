export type ScreeningTitleKind =
  | "film"
  | "screening_program"
  | "festival_screening_block";

export type ScreeningTime = {
  id: string;
  screening_run_id: string;
  event_id: number;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  ticket_url: string | null;
  source_url: string | null;
  format_labels: string[];
  status: "scheduled" | "cancelled" | "sold_out";
};

export type ScreeningRun = {
  id: string;
  screening_title_id: string;
  place_id: number | null;
  festival_id: string | null;
  label: string;
  start_date: string;
  end_date: string;
  source_id: number | null;
  buy_url: string | null;
  info_url: string | null;
  is_special_event: boolean;
};

export type ScreeningTitle = {
  id: string;
  canonical_title: string;
  slug: string;
  kind: ScreeningTitleKind;
  poster_image_url: string | null;
  synopsis: string | null;
  genres: string[];
  tmdb_id: number | null;
  imdb_id: string | null;
  festival_work_key: string | null;
  director: string | null;
  runtime_minutes: number | null;
  year: number | null;
  rating: string | null;
};

export type ScreeningBundle = {
  titles: ScreeningTitle[];
  runs: ScreeningRun[];
  times: ScreeningTime[];
};

type ScreeningSupabaseClient = {
  from: (table: string) => {
    select: (columns: string) => unknown;
  };
};

export type ScreeningEventLike = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  image_url: string | null;
  description?: string | null;
  source_url: string | null;
  ticket_url: string | null;
  source_id?: number | null;
  tags?: string[] | null;
  category_id?: string | null;
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
    genres?: string[] | null;
    festival?: {
      id?: string | null;
      name?: string | null;
    } | null;
  } | null;
};

type BuildScreeningsOptions = {
  placeId?: number | null;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTitleKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .replace(/\s*-\s*(imax|3d|dolby|atmos|4dx|35mm|70mm)\s*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function inferScreeningKind(
  event: ScreeningEventLike,
): ScreeningTitleKind {
  if (event.series?.festival?.id) return "festival_screening_block";
  if (event.series?.series_type === "film" || event.category_id === "film") {
    return "film";
  }
  return "screening_program";
}

function collectFormatLabels(tags: string[] | null | undefined): string[] {
  if (!tags?.length) return [];
  const labels = new Set<string>();
  for (const tag of tags) {
    switch (tag) {
      case "imax":
        labels.add("IMAX");
        break;
      case "3d":
        labels.add("3D");
        break;
      case "35mm":
        labels.add("35mm");
        break;
      case "70mm":
        labels.add("70mm");
        break;
      case "captioned":
      case "open_caption":
        labels.add("Captioned");
        break;
      default:
        break;
    }
  }
  return [...labels];
}

function sortTimes(left: ScreeningTime, right: ScreeningTime): number {
  if (left.start_date !== right.start_date) {
    return left.start_date.localeCompare(right.start_date);
  }
  return (left.start_time || "").localeCompare(right.start_time || "");
}

export function isScreeningLikeEvent(event: ScreeningEventLike): boolean {
  if (event.category_id === "film") return true;
  if (event.series?.series_type === "film") return true;
  const tags = event.tags || [];
  return tags.includes("showtime") || tags.includes("screening");
}

export function buildScreeningBundle(
  events: ScreeningEventLike[],
  options: BuildScreeningsOptions = {},
): ScreeningBundle {
  const titles = new Map<string, ScreeningTitle>();
  const runs = new Map<string, ScreeningRun>();
  const times: ScreeningTime[] = [];

  for (const event of events) {
    const canonicalTitle = event.series?.title || event.title;
    const key = event.series_id || event.series?.id || normalizeTitleKey(canonicalTitle);
    const titleId = `screening-title:${key}`;
    const runId = `screening-run:${titleId}:${options.placeId ?? "unknown"}`;

    if (!titles.has(titleId)) {
      titles.set(titleId, {
        id: titleId,
        canonical_title: canonicalTitle,
        slug: event.series?.slug || slugify(canonicalTitle),
        kind: inferScreeningKind(event),
        poster_image_url: event.series?.image_url || event.image_url,
        synopsis: event.description || null,
        genres: event.series?.genres || [],
        tmdb_id: null,
        imdb_id: null,
        festival_work_key: event.series?.festival?.id || null,
        director: null,
        runtime_minutes: null,
        year: null,
        rating: null,
      });
    }

    const currentRun = runs.get(runId);
    const startDate = event.start_date;
    const endDate = event.start_date;
    const isSpecialEvent = !(event.tags || []).includes("showtime");
    if (!currentRun) {
      runs.set(runId, {
        id: runId,
        screening_title_id: titleId,
        place_id: options.placeId ?? null,
        festival_id: event.series?.festival?.id || null,
        label: event.series?.title || canonicalTitle,
        start_date: startDate,
        end_date: endDate,
        source_id: event.source_id ?? null,
        buy_url: event.ticket_url || null,
        info_url: event.source_url || null,
        is_special_event: isSpecialEvent,
      });
    } else {
      currentRun.start_date =
        currentRun.start_date < startDate ? currentRun.start_date : startDate;
      currentRun.end_date =
        currentRun.end_date > endDate ? currentRun.end_date : endDate;
      currentRun.buy_url ||= event.ticket_url || null;
      currentRun.info_url ||= event.source_url || null;
      currentRun.is_special_event =
        currentRun.is_special_event || isSpecialEvent;
      currentRun.source_id ||= event.source_id ?? null;
    }

    times.push({
      id: `screening-time:${event.id}`,
      screening_run_id: runId,
      event_id: event.id,
      start_date: event.start_date,
      start_time: event.start_time,
      end_time: event.end_time,
      ticket_url: event.ticket_url || null,
      source_url: event.source_url || null,
      format_labels: collectFormatLabels(event.tags),
      status: "scheduled",
    });
  }

  times.sort(sortTimes);

  return {
    titles: [...titles.values()].sort((left, right) =>
      left.canonical_title.localeCompare(right.canonical_title),
    ),
    runs: [...runs.values()].sort((left, right) => {
      if (left.start_date !== right.start_date) {
        return left.start_date.localeCompare(right.start_date);
      }
      return left.label.localeCompare(right.label);
    }),
    times,
  };
}

function isMissingScreeningSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error && typeof error.message === "string"
    ? error.message
    : "";
  const code = "code" in error && typeof error.code === "string"
    ? error.code
    : "";

  return (
    code === "PGRST205" ||
    code === "PGRST200" ||
    code === "42P01" ||
    code === "42703" ||
    /screening_/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message)
  );
}

export async function fetchScreeningBundleFromTables(
  supabase: ScreeningSupabaseClient,
  options: {
    placeId?: number | null;
    festivalId?: string | null;
  },
): Promise<ScreeningBundle | null> {
  if (!options.placeId && !options.festivalId) return null;

  let runsQuery: any = supabase
    .from("screening_runs")
    .select(
      "id, screening_title_id, place_id, festival_id, label, start_date, end_date, source_id, buy_url, info_url, is_special_event",
    );

  if (options.placeId) {
    runsQuery = runsQuery.eq("place_id", options.placeId) as typeof runsQuery;
  }
  if (options.festivalId) {
    runsQuery = runsQuery.eq("festival_id", options.festivalId) as typeof runsQuery;
  }
  if (typeof runsQuery.order === "function") {
    runsQuery = runsQuery.order("start_date", { ascending: true });
  }

  const runsResult = (await runsQuery) as {
    data: ScreeningRun[] | null;
    error: unknown;
  };
  if (runsResult.error) {
    if (isMissingScreeningSchemaError(runsResult.error)) return null;
    throw runsResult.error;
  }

  const runs = runsResult.data || [];
  if (runs.length === 0) return null;

  const titleIds = Array.from(new Set(runs.map((run) => run.screening_title_id)));
  const runIds = runs.map((run) => run.id);

  const titlesQuery: any = supabase
    .from("screening_titles")
    .select(
      "id, canonical_title, slug, kind, poster_image_url, synopsis, genres, tmdb_id, imdb_id, festival_work_key, director, runtime_minutes, year, rating",
    );
  const titlesResult = typeof titlesQuery.in === "function"
    ? ((await titlesQuery.in("id", titleIds)) as {
        data: ScreeningTitle[] | null;
        error: unknown;
      })
    : { data: null, error: null };
  if (titlesResult.error) {
    if (isMissingScreeningSchemaError(titlesResult.error)) return null;
    throw titlesResult.error;
  }

  let timesQuery: any = supabase
    .from("screening_times")
    .select(
      "id, screening_run_id, event_id, start_date, start_time, end_time, ticket_url, source_url, format_labels, status",
    );
  if (typeof timesQuery.in === "function") {
    timesQuery = timesQuery.in("screening_run_id", runIds);
  }
  if (typeof timesQuery.order === "function") {
    timesQuery = timesQuery.order("start_date", { ascending: true });
  }
  const timesResult = (await timesQuery) as {
    data: ScreeningTime[] | null;
    error: unknown;
  };
  if (timesResult.error) {
    if (isMissingScreeningSchemaError(timesResult.error)) return null;
    throw timesResult.error;
  }

  return {
    titles: (titlesResult.data || []).sort((left, right) =>
      left.canonical_title.localeCompare(right.canonical_title),
    ),
    runs: runs.sort((left, right) => {
      if (left.start_date !== right.start_date) {
        return left.start_date.localeCompare(right.start_date);
      }
      return left.label.localeCompare(right.label);
    }),
    times: (timesResult.data || []).sort(sortTimes),
  };
}
