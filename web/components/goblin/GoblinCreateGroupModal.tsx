"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import { TMDB_POSTER_W185 } from "@/lib/goblin-log-utils";
import type { TMDBPerson, TMDBFilmographyMovie } from "@/lib/goblin-group-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    movie_tmdb_ids?: number[];
  }) => Promise<any>;
  searchPerson: (query: string) => Promise<TMDBPerson[]>;
  getFilmography: (
    personId: number
  ) => Promise<{
    person: { name: string };
    movies: TMDBFilmographyMovie[];
  } | null>;
}

export default function GoblinCreateGroupModal({
  open,
  onClose,
  onSubmit,
  searchPerson,
  getFilmography,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // TMDB seed state
  const [seedMode, setSeedMode] = useState<"none" | "person">("none");
  const [personQuery, setPersonQuery] = useState("");
  const [personResults, setPersonResults] = useState<TMDBPerson[]>([]);
  const [personSearching, setPersonSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<TMDBPerson | null>(null);
  const [filmography, setFilmography] = useState<TMDBFilmographyMovie[]>([]);
  const [selectedTmdbIds, setSelectedTmdbIds] = useState<Set<number>>(new Set());
  const [loadingFilmography, setLoadingFilmography] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus name input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 100);
    } else {
      // Reset all state
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal close-reset: none of the reset fields are in deps ([open]), cascade bounded.
      setName("");
      setDescription("");
      setSeedMode("none");
      setPersonQuery("");
      setPersonResults([]);
      setSelectedPerson(null);
      setFilmography([]);
      setSelectedTmdbIds(new Set());
    }
  }, [open]);

  // Debounced person search
  /* eslint-disable react-hooks/set-state-in-effect --
     Debounced async search loading pattern: empty query resets results;
     non-empty flips personSearching on, setTimeout fetches, flips off on
     resolve. Cascade bounded — none of personSearching/personResults
     appears in the dep array ([personQuery, searchPerson]). */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (personQuery.length < 2) {
      setPersonResults([]);
      return;
    }
    setPersonSearching(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchPerson(personQuery);
      setPersonResults(r);
      setPersonSearching(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [personQuery, searchPerson]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleSelectPerson = useCallback(
    async (person: TMDBPerson) => {
      setSelectedPerson(person);
      setPersonResults([]);
      setPersonQuery("");
      setLoadingFilmography(true);

      // Auto-fill name if empty
      if (!name.trim()) {
        setName(`Films of ${person.name}`);
      }

      const result = await getFilmography(person.id);
      if (result) {
        setFilmography(result.movies);
        // Select all by default
        setSelectedTmdbIds(new Set(result.movies.map((m) => m.tmdb_id)));
      }
      setLoadingFilmography(false);
    },
    [getFilmography, name]
  );

  const toggleMovie = useCallback((tmdbId: number) => {
    setSelectedTmdbIds((prev) => {
      const next = new Set(prev);
      if (next.has(tmdbId)) next.delete(tmdbId);
      else next.add(tmdbId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selectedTmdbIds.size === filmography.length) {
      setSelectedTmdbIds(new Set());
    } else {
      setSelectedTmdbIds(new Set(filmography.map((m) => m.tmdb_id)));
    }
  }, [selectedTmdbIds.size, filmography]);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);

    const tmdbIds =
      filmography.length > 0 ? Array.from(selectedTmdbIds) : undefined;

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      movie_tmdb_ids: tmdbIds,
    });

    setSubmitting(false);
    onClose();
  };

  if (!open) return null;

  const showFilmography = selectedPerson && filmography.length > 0;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4
        bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative bg-[var(--night)] border border-[var(--twilight)]
          rounded-xl p-6 max-w-lg w-full shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full
            hover:bg-[var(--twilight)] transition-colors
            flex items-center justify-center text-[var(--muted)]"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-[var(--cream)] mb-6">
          New Group
        </h2>

        {/* Name */}
        <div className="mb-4">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Name
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Films of Denis Villeneuve"
            className="w-full px-3 py-2.5 rounded-lg
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] font-mono text-sm
              placeholder:text-[var(--muted)]
              focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional — flavor text for this group"
            className="w-full px-3 py-2.5 rounded-lg
              bg-[var(--dusk)] border border-[var(--twilight)]
              text-[var(--cream)] font-mono text-sm
              placeholder:text-[var(--muted)]
              focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Seed from TMDB */}
        {!showFilmography && (
          <div className="mb-6">
            <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-2 block">
              Seed from TMDB
            </label>

            {seedMode === "none" ? (
              <button
                onClick={() => setSeedMode("person")}
                className="px-3 py-2 border border-dashed border-zinc-700
                  text-zinc-500 font-mono text-2xs uppercase tracking-wider
                  hover:border-amber-500/40 hover:text-amber-400 transition-colors w-full"
              >
                Search by Director / Actor
              </button>
            ) : (
              <div>
                <input
                  type="text"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder="Search for a director or actor..."
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg
                    bg-[var(--dusk)] border border-[var(--twilight)]
                    text-[var(--cream)] font-mono text-sm
                    placeholder:text-[var(--muted)]
                    focus:outline-none focus:border-amber-500 transition-colors"
                />

                {personSearching && (
                  <p className="mt-2 text-xs text-[var(--muted)] font-mono">
                    Searching...
                  </p>
                )}

                <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                  {personResults.map((person) => (
                    <button
                      key={person.id}
                      onClick={() => handleSelectPerson(person)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg
                        hover:bg-[var(--dusk)] transition-colors text-left"
                    >
                      <span className="text-sm text-[var(--cream)]">
                        {person.name}
                      </span>
                      {person.known_for_department && (
                        <span className="text-2xs text-[var(--muted)] font-mono">
                          {person.known_for_department}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    setSeedMode("none");
                    setPersonQuery("");
                    setPersonResults([]);
                  }}
                  className="mt-2 text-2xs text-[var(--muted)] font-mono
                    hover:text-[var(--cream)] transition-colors"
                >
                  Cancel seed
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filmography selection */}
        {loadingFilmography && (
          <p className="text-xs text-[var(--muted)] font-mono mb-4">
            Loading filmography...
          </p>
        )}

        {showFilmography && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                {selectedPerson.name}&apos;s Films ({selectedTmdbIds.size}/{filmography.length})
              </label>
              <button
                onClick={toggleAll}
                className="text-2xs font-mono text-amber-500 hover:text-amber-400 transition-colors"
              >
                {selectedTmdbIds.size === filmography.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="space-y-1 max-h-60 overflow-y-auto border border-[var(--twilight)] rounded-lg p-2">
              {filmography.map((movie) => {
                const isSelected = selectedTmdbIds.has(movie.tmdb_id);
                return (
                  <button
                    key={movie.tmdb_id}
                    onClick={() => toggleMovie(movie.tmdb_id)}
                    className={`w-full flex items-center gap-2.5 p-1.5 rounded-lg
                      transition-colors text-left ${
                        isSelected
                          ? "bg-amber-950/30"
                          : "hover:bg-[var(--dusk)]"
                      }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-4 h-4 rounded border flex-shrink-0
                        flex items-center justify-center text-2xs font-bold
                        ${
                          isSelected
                            ? "bg-amber-600 border-amber-500 text-black"
                            : "border-zinc-700 text-transparent"
                        }`}
                    >
                      ✓
                    </div>

                    {/* Poster */}
                    <div className="w-8 h-12 flex-shrink-0 rounded overflow-hidden bg-[var(--twilight)]">
                      {movie.poster_path && (
                        <SmartImage
                          src={`${TMDB_POSTER_W185}${movie.poster_path}`}
                          alt={movie.title}
                          width={32}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      )}
                    </div>

                    {/* Title + year */}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm truncate ${
                          isSelected
                            ? "text-[var(--cream)]"
                            : "text-[var(--soft)]"
                        }`}
                      >
                        {movie.title}
                        {movie.year && (
                          <span className="text-[var(--muted)] ml-1.5 text-xs">
                            ({movie.year})
                          </span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setSelectedPerson(null);
                setFilmography([]);
                setSelectedTmdbIds(new Set());
                setSeedMode("none");
              }}
              className="mt-2 text-2xs text-[var(--muted)] font-mono
                hover:text-[var(--cream)] transition-colors"
            >
              Clear selection
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg
              font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="flex-1 py-2.5 bg-amber-600 text-black rounded-lg
              font-mono text-sm font-medium disabled:opacity-50
              hover:bg-amber-500 transition-colors"
          >
            {submitting
              ? "Creating..."
              : filmography.length > 0
                ? `Create (${selectedTmdbIds.size} films)`
                : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
