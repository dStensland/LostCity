"use client";

interface SummaryMovie {
  id: number;
  title: string;
  poster_path: string | null;
  watch_order: number;
}

interface SummaryTheme {
  id: number;
  label: string;
  status: string;
  goblin_theme_movies: Array<{ movie_id: number }>;
}

interface SummaryTimelineEntry {
  id: number;
  event_type: string;
  movie_id: number | null;
  theme_id: number | null;
  user_name: string | null;
  created_at: string;
}

interface SummaryMember {
  display_name: string | null;
  avatar_url: string | null;
}

interface GoblinSummaryProps {
  name: string | null;
  date: string | null;
  members: SummaryMember[];
  guestNames: string[];
  movies: SummaryMovie[];
  themes: SummaryTheme[];
  timeline: SummaryTimelineEntry[];
}

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w200";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
}

export default function GoblinSummaryView({
  name,
  date,
  members,
  guestNames,
  movies,
  themes,
  timeline,
}: GoblinSummaryProps) {
  const sortedMovies = [...movies].sort((a, b) => a.watch_order - b.watch_order);
  const activeThemes = themes.filter((t) => t.status === "active");
  const canceledThemes = themes.filter((t) => t.status === "canceled");

  // Compute completed themes (tagged on every watched movie)
  const movieIds = new Set(sortedMovies.map((m) => m.id));
  const completedThemes = activeThemes.filter(
    (t) =>
      movieIds.size > 0 &&
      sortedMovies.every((m) =>
        t.goblin_theme_movies.some((tm) => tm.movie_id === m.id)
      )
  );
  const completedIds = new Set(completedThemes.map((t) => t.id));
  const incompleteThemes = activeThemes.filter((t) => !completedIds.has(t.id));

  const movieMap = new Map(movies.map((m) => [m.id, m]));
  const themeMap = new Map(themes.map((t) => [t.id, t]));

  // All attendee names: real members + guests
  const attendeeNames = [
    ...members.map((m) => m.display_name ?? "Goblin"),
    ...guestNames,
  ];

  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="min-h-screen bg-black text-zinc-400 font-mono">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-red-900 text-2xs tracking-[0.3em] uppercase">
            A RECAP OF
          </p>
          <h1 className="text-red-500 text-2xl font-black tracking-[0.2em] uppercase">
            {name || "GOBLIN DAY"}
          </h1>
          {date && (
            <p className="text-zinc-600 text-xs tracking-[0.2em] uppercase">
              {formatDate(date)}
            </p>
          )}
        </div>

        {/* Attendees */}
        {attendeeNames.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              GOBLINS [{attendeeNames.length}]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {attendeeNames.map((attendeeName, i) => (
                <span
                  key={i}
                  className="text-2xs px-2 py-0.5 border border-zinc-800 text-zinc-400 tracking-wider uppercase"
                >
                  {attendeeName}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Movies */}
        {sortedMovies.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              WATCH ORDER [{sortedMovies.length}]
            </h2>
            <div className="space-y-1.5">
              {sortedMovies.map((movie, i) => (
                <div key={movie.id} className="flex items-center gap-2.5">
                  <span className="text-red-700 font-black text-xs tabular-nums w-5 text-right shrink-0">
                    {i + 1}.
                  </span>
                  {movie.poster_path && (
                    <div className="w-6 h-9 flex-shrink-0 bg-zinc-900 overflow-hidden">
                      <img
                        src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                        alt={movie.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <span className="text-zinc-300 text-xs uppercase tracking-wide font-bold">
                    {movie.title}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Completed themes */}
        {completedThemes.length > 0 && (
          <section>
            <h2 className="text-amber-500 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              COMPLETED THEMES [{completedThemes.length}]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {completedThemes.map((t) => (
                <span
                  key={t.id}
                  className="text-2xs px-2.5 py-1 border-2 border-amber-700/60 bg-amber-950/30 text-amber-400 font-bold tracking-wider uppercase"
                >
                  {t.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Incomplete themes */}
        {incompleteThemes.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              ACTIVE THEMES [{incompleteThemes.length}]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {incompleteThemes.map((t) => (
                <span
                  key={t.id}
                  className="text-2xs px-2 py-0.5 border border-red-700 text-red-400 font-bold tracking-wider uppercase"
                >
                  {t.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Canceled themes */}
        {canceledThemes.length > 0 && (
          <section>
            <h2 className="text-zinc-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              CANCELED THEMES [{canceledThemes.length}]
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {canceledThemes.map((t) => (
                <span
                  key={t.id}
                  className="text-2xs px-2 py-0.5 border border-zinc-800 text-zinc-600 font-bold tracking-wider uppercase line-through"
                >
                  {t.label}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Timeline */}
        {sortedTimeline.length > 0 && (
          <section>
            <h2 className="text-red-600 text-2xs font-bold tracking-[0.2em] uppercase mb-2">
              TIMELINE
            </h2>
            <div className="space-y-0.5">
              {sortedTimeline.map((entry) => {
                const movie = entry.movie_id ? movieMap.get(entry.movie_id) : null;
                const theme = entry.theme_id ? themeMap.get(entry.theme_id) : null;
                return (
                  <div key={entry.id} className="flex items-baseline gap-2 text-2xs">
                    <span className="text-zinc-600 tabular-nums shrink-0">
                      {formatTimestamp(entry.created_at)}
                    </span>
                    <span className="text-zinc-500 uppercase tracking-wider">
                      {entry.user_name && (
                        <span className="text-zinc-400 font-bold mr-1">
                          {entry.user_name.toUpperCase()}
                        </span>
                      )}
                      {entry.event_type.replace(/_/g, " ")}
                      {movie && <span className="text-zinc-400"> — {movie.title}</span>}
                      {theme && <span className="text-zinc-400"> — {theme.label}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {sortedMovies.length === 0 && themes.length === 0 && timeline.length === 0 && (
          <p className="text-zinc-700 text-xs tracking-widest uppercase text-center py-8">
            // NO DATA RECORDED
          </p>
        )}
      </div>
    </div>
  );
}
