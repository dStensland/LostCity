// Watchlist-specific types — separate tag system from The Log

export interface WatchlistEntry {
  id: number;
  movie_id: number;
  note: string | null;
  sort_order: number | null;
  added_at: string;
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
  tags: WatchlistTag[];
}

export interface WatchlistTag {
  id: number;
  name: string;
  color: string | null;
}
