// Tag color palette — muted jewel tones that work on dark backgrounds
export const TAG_COLORS = [
  "#FF6B7A", // coral
  "#F59E0B", // amber
  "#34D399", // emerald
  "#38BDF8", // sky
  "#A78BFA", // violet
  "#FB7185", // rose
  "#2DD4BF", // teal
  "#FB923C", // orange
  "#A3E635", // lime
  "#E879F9", // fuchsia
  "#22D3EE", // cyan
  "#818CF8", // indigo
] as const;

/** Get the next tag color based on how many tags the user has */
export function getNextTagColor(existingCount: number): string {
  return TAG_COLORS[existingCount % TAG_COLORS.length];
}

/** Format a date as "Mar 15, 2026" */
export function formatWatchedDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00"); // avoid timezone shift
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format a date as ISO "YYYY-MM-DD" for form inputs */
export function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/** Format runtime as "1h 42m" */
export function formatRuntime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

/** TMDB image base URL */
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
export const TMDB_POSTER_W500 = `${TMDB_IMAGE_BASE}/w500`;
export const TMDB_POSTER_W342 = `${TMDB_IMAGE_BASE}/w342`;
export const TMDB_POSTER_W185 = `${TMDB_IMAGE_BASE}/w185`;

/** Types */
export interface LogEntry {
  id: number;
  movie_id: number;
  watched_date: string;
  note: string | null;
  watched_with: string | null;
  sort_order: number | null;
  tier_name: string | null;
  tier_color: string | null;
  created_at: string;
  updated_at: string;
  movie: {
    id: number;
    tmdb_id: number | null;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string | null;
    genres: string[] | null;
    runtime_minutes: number | null;
    director: string | null;
    year: number | null;
    rt_critics_score: number | null;
    rt_audience_score: number | null;
    tmdb_vote_average: number | null;
    tmdb_vote_count: number | null;
    mpaa_rating: string | null;
    imdb_id: string | null;
    synopsis: string | null;
    trailer_url: string | null;
  };
  tags: GoblinTag[];
}

export interface GoblinTag {
  id: number;
  name: string;
  color: string | null;
}

export interface TMDBSearchResult {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  overview: string | null;
}
