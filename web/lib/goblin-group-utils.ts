// web/lib/goblin-group-utils.ts

export interface GoblinGroupMovie {
  movie_id: number;
  sort_order: number | null;
  note: string | null;
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
}

export interface GoblinGroup {
  id: number;
  slug: string | null;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_recommendations: boolean;
  created_at: string;
  movies: GoblinGroupMovie[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  known_for_department: string | null;
  profile_path: string | null;
}

export interface TMDBFilmographyMovie {
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  year: number | null;
  overview: string | null;
}
