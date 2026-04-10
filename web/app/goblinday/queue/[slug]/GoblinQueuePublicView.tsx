"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import SmartImage from "@/components/SmartImage";
import { TMDB_POSTER_W342, TMDB_POSTER_W185, TMDBSearchResult } from "@/lib/goblin-log-utils";

interface Movie {
  id: number;
  tmdb_id: number | null;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  genres: string[] | null;
  runtime_minutes: number | null;
  director: string | null;
  year: number | null;
}

interface QueueEntry {
  id: number;
  movie: Movie;
}

interface Props {
  user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  slug: string;
  entries: QueueEntry[];
}

export default function GoblinQueuePublicView({ user, slug, entries }: Props) {
  // Recommend form state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TMDBSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TMDBSearchResult | null>(null);
  const [recommenderName, setRecommenderName] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-fill name from profile if signed in
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/profile", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.profile?.display_name) {
          setRecommenderName(data.profile.display_name);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Debounced TMDB search
  const handleSearchChange = useCallback(
    (q: string) => {
      setSearchQuery(q);
      setErrorMessage(null);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (q.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await fetch(
            `/api/goblinday/queue/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(q.trim())}`
          );
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.results || []);
          }
        } catch {
          // silently ignore
        } finally {
          setSearching(false);
        }
      }, 350);
    },
    [slug]
  );

  const handleSelectMovie = (movie: TMDBSearchResult) => {
    setSelectedMovie(movie);
    setSearchQuery("");
    setSearchResults([]);
    setErrorMessage(null);
  };

  const handleBack = () => {
    setSelectedMovie(null);
    setErrorMessage(null);
    setNote("");
  };

  const handleSubmit = async () => {
    if (!selectedMovie) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch(
        `/api/goblinday/queue/${encodeURIComponent(slug)}/recommend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdb_id: selectedMovie.tmdb_id,
            recommender_name: recommenderName.trim() || null,
            note: note.trim() || null,
          }),
        }
      );

      if (res.status === 409) {
        setErrorMessage("You already recommended this movie!");
        setSubmitting(false);
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.error || "Something went wrong. Try again.");
        setSubmitting(false);
        return;
      }

      // Success
      setSelectedMovie(null);
      setNote("");
      setSearchQuery("");
      setSuccessMessage("Recommendation sent!");

      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessMessage(null), 4000);
    } catch {
      setErrorMessage("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const displayName = user.displayName || user.username;

  return (
    <main className="min-h-screen bg-black text-white font-mono relative">
      {/* Top amber laser line */}
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(to right, transparent 5%, rgba(251,191,36,0.7) 35%, rgba(245,158,11,0.7) 65%, transparent 95%)",
          boxShadow: "0 0 8px rgba(251,191,36,0.3), 0 0 16px rgba(251,191,36,0.1)",
        }}
      />

      <div className="max-w-2xl mx-auto px-4 py-12 sm:py-20">
        {/* Header */}
        <div className="mb-10 pb-6 px-6 pt-6 rounded-lg bg-white/[0.03] border border-amber-900/20 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="flex items-end gap-4">
            {user.avatarUrl && (
              <div className="relative flex-shrink-0">
                <SmartImage
                  src={user.avatarUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="border border-amber-800/30"
                />
                <div className="absolute -top-px -left-px w-2 h-2 border-t border-l border-amber-600/50" />
                <div className="absolute -top-px -right-px w-2 h-2 border-t border-r border-amber-600/50" />
                <div className="absolute -bottom-px -left-px w-2 h-2 border-b border-l border-amber-600/50" />
                <div className="absolute -bottom-px -right-px w-2 h-2 border-b border-r border-amber-600/50" />
              </div>
            )}
            <div>
              <p
                className="text-2xs text-amber-600/80 tracking-[0.5em] uppercase mb-1.5 font-mono"
                style={{ textShadow: "0 0 6px rgba(255,217,61,0.2)" }}
              >
                The Queue
              </p>
              <h1
                className="text-3xl sm:text-5xl font-black text-white uppercase tracking-[0.15em] leading-none"
                style={{
                  textShadow:
                    "0 0 2px rgba(255,217,61,0.6), 0 0 20px rgba(255,217,61,0.35), 0 0 60px rgba(255,217,61,0.12)",
                }}
              >
                {displayName}
              </h1>
            </div>
          </div>
          <div className="mt-6">
            <span className="text-2xs text-zinc-600 tracking-[0.3em] uppercase tabular-nums">
              {entries.length} film{entries.length !== 1 ? "s" : ""} to watch
            </span>
          </div>
        </div>

        {/* Poster grid */}
        {entries.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3 mb-12">
            {entries.map((entry) => (
              <div key={entry.id} className="flex flex-col">
                <div className="aspect-[2/3] relative rounded-sm overflow-hidden bg-zinc-900 border border-zinc-800/50">
                  {entry.movie.poster_path ? (
                    <SmartImage
                      src={`${TMDB_POSTER_W342}${entry.movie.poster_path}`}
                      alt={entry.movie.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center p-2">
                      <span className="text-2xs text-zinc-600 text-center leading-tight font-mono">
                        {entry.movie.title}
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-2xs text-zinc-500 mt-1 leading-tight truncate font-mono">
                  {entry.movie.title}
                  {entry.movie.year ? (
                    <span className="text-zinc-700"> {entry.movie.year}</span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 mb-12">
            <p className="text-zinc-600 font-mono text-sm tracking-widest uppercase">
              // Queue is empty
            </p>
          </div>
        )}

        {/* Recommend section */}
        <div
          className="pt-8"
          style={{ borderTop: "1px solid rgba(120,53,15,0.2)" }}
        >
          <p
            className="text-2xs text-amber-600/80 tracking-[0.5em] uppercase mb-1 font-mono"
            style={{ textShadow: "0 0 6px rgba(255,217,61,0.15)" }}
          >
            Recommend a Film
          </p>
          <p className="text-zinc-500 font-mono text-xs mb-6 tracking-wide">
            Send {displayName} a movie to add to their queue.
          </p>

          {/* Success banner */}
          {successMessage && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-700/40 text-emerald-400 font-mono text-xs tracking-wider">
              {successMessage}
            </div>
          )}

          {/* Error banner */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-700/40 text-red-400 font-mono text-xs tracking-wider">
              {errorMessage}
            </div>
          )}

          {!selectedMovie ? (
            /* Phase 1: Search */
            <div>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search for a movie..."
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800
                    text-white font-mono text-sm placeholder:text-zinc-600
                    focus:outline-none focus:border-amber-700/60 transition-colors"
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-2xs text-zinc-600 font-mono">
                    searching...
                  </span>
                )}
              </div>

              {searchResults.length > 0 && (
                <ul className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden divide-y divide-zinc-800/60">
                  {searchResults.map((result) => (
                    <li key={result.tmdb_id}>
                      <button
                        onClick={() => handleSelectMovie(result)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left
                          hover:bg-zinc-900 transition-colors"
                      >
                        <div className="flex-shrink-0 w-8 h-12 relative rounded overflow-hidden bg-zinc-800">
                          {result.poster_path ? (
                            <SmartImage
                              src={`${TMDB_POSTER_W185}${result.poster_path}`}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-zinc-800" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-mono truncate leading-tight">
                            {result.title}
                          </p>
                          {result.release_date && (
                            <p className="text-2xs text-zinc-500 font-mono mt-0.5">
                              {result.release_date.slice(0, 4)}
                            </p>
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            /* Phase 2: Movie selected — fill in details */
            <div>
              {/* Selected movie preview */}
              <div className="flex items-center gap-3 mb-5 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="flex-shrink-0 w-10 h-[60px] relative rounded overflow-hidden bg-zinc-800">
                  {selectedMovie.poster_path ? (
                    <SmartImage
                      src={`${TMDB_POSTER_W185}${selectedMovie.poster_path}`}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-zinc-800" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-mono font-bold truncate leading-tight">
                    {selectedMovie.title}
                  </p>
                  {selectedMovie.release_date && (
                    <p className="text-2xs text-zinc-500 font-mono mt-0.5">
                      {selectedMovie.release_date.slice(0, 4)}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleBack}
                  className="flex-shrink-0 text-2xs text-zinc-600 hover:text-zinc-400 font-mono
                    tracking-wider uppercase transition-colors"
                >
                  Change
                </button>
              </div>

              {/* Name input */}
              <div className="mb-3">
                <label className="block font-mono text-xs text-zinc-500 uppercase tracking-wider mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  value={recommenderName}
                  onChange={(e) => setRecommenderName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={50}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800
                    text-white font-mono text-sm placeholder:text-zinc-600
                    focus:outline-none focus:border-amber-700/60 transition-colors"
                />
              </div>

              {/* Note textarea */}
              <div className="mb-4">
                <label className="block font-mono text-xs text-zinc-500 uppercase tracking-wider mb-1.5">
                  Note{" "}
                  <span className="text-zinc-700 normal-case tracking-normal">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why should they watch it?"
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg bg-zinc-900 border border-zinc-800
                    text-white font-mono text-sm placeholder:text-zinc-600 resize-none
                    focus:outline-none focus:border-amber-700/60 transition-colors"
                />
                <p className="text-right text-2xs text-zinc-700 font-mono mt-1">
                  {note.length}/500
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting || !recommenderName.trim()}
                className="w-full py-2.5 rounded-lg bg-amber-600 text-black font-mono text-sm
                  font-bold tracking-wider uppercase hover:bg-amber-500 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Recommend"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="mt-20 pt-6 flex items-center justify-between"
          style={{
            borderTop: "1px solid rgba(120,53,15,0.2)",
            boxShadow: "0 -1px 0 0 rgba(120,53,15,0.05)",
          }}
        >
          <a
            href="/goblinday"
            className="text-2xs text-amber-700 font-mono tracking-[0.2em] uppercase
              hover:text-amber-500 transition-colors"
          >
            Goblin Day
          </a>
          <span className="text-2xs text-zinc-600 font-mono tracking-[0.15em]">
            Lost City
          </span>
        </div>
      </div>
    </main>
  );
}
