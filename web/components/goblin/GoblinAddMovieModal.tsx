"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import GoblinTagPicker from "./GoblinTagPicker";
import {
  toISODate,
  TMDB_POSTER_W185,
  type TMDBSearchResult,
  type GoblinTag,
  type LogList,
} from "@/lib/goblin-log-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    tmdb_id: number;
    watched_date: string;
    note?: string;
    watched_with?: string;
    tag_ids?: number[];
    list_id?: number | null;
  }) => Promise<boolean>;
  searchTMDB: (query: string) => Promise<TMDBSearchResult[]>;
  tags: GoblinTag[];
  lists: LogList[];
  onCreateTag: (name: string) => Promise<GoblinTag | null>;
}

export default function GoblinAddMovieModal({
  open,
  onClose,
  onSubmit,
  searchTMDB,
  tags,
  lists,
  onCreateTag,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TMDBSearchResult | null>(null);
  const [watchedDate, setWatchedDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state on close
      // eslint-disable-next-line react-hooks/set-state-in-effect -- modal close-reset: none of the reset fields are in deps ([open]), cascade bounded. Reset must run after open flips to false, so initializers aren't an option.
      setQuery("");
      setResults([]);
      setSelected(null);
      setNote("");
      setWatchedWith("");
      setSelectedTagIds([]);
      setSelectedListId(null);
      setWatchedDate(toISODate(new Date()));
    }
  }, [open]);

  // Debounced TMDB search
  /* eslint-disable react-hooks/set-state-in-effect --
     Debounced async search loading pattern: empty query resets results;
     non-empty flips searching on, setTimeout fetches, flips searching off
     on resolve. Cascade bounded — none of searching/results appears in
     the dep array ([query, searchTMDB]). */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const r = await searchTMDB(query);
      setResults(r);
      setSearching(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchTMDB]);
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

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    const success = await onSubmit({
      tmdb_id: selected.tmdb_id,
      watched_date: watchedDate,
      note: note.trim() || undefined,
      watched_with: watchedWith.trim() || undefined,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      list_id: selectedListId,
    });
    setSubmitting(false);
    if (success) onClose();
  };

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  if (!open) return null;

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
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full
            hover:bg-[var(--twilight)] transition-colors
            flex items-center justify-center text-[var(--muted)]"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-[var(--cream)] mb-6">
          Log a Movie
        </h2>

        {!selected ? (
          /* Search phase */
          <>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for a movie..."
              className="w-full px-3 py-2.5 rounded-lg
                bg-[var(--dusk)] border border-[var(--twilight)]
                text-[var(--cream)] font-mono text-sm
                placeholder:text-[var(--muted)]
                focus:outline-none focus:border-[var(--coral)] transition-colors"
            />

            {searching && (
              <p className="mt-3 text-xs text-[var(--muted)] font-mono">Searching...</p>
            )}

            <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
              {results.map((movie) => (
                <button
                  key={movie.tmdb_id}
                  onClick={() => setSelected(movie)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg
                    hover:bg-[var(--dusk)] transition-colors text-left group"
                >
                  <div className="w-10 h-15 flex-shrink-0 rounded overflow-hidden bg-[var(--twilight)]">
                    {movie.poster_path && (
                      <SmartImage
                        src={`${TMDB_POSTER_W185}${movie.poster_path}`}
                        alt={movie.title}
                        width={40}
                        height={60}
                        className="object-cover w-full h-full"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--cream)] truncate
                      group-hover:text-[var(--coral)] transition-colors">
                      {movie.title}
                      <span className="text-[var(--muted)] ml-1.5 font-normal">
                        {movie.release_date?.split("-")[0] || ""}
                      </span>
                    </p>
                    {movie.overview && (
                      <p className="text-2xs text-[var(--muted)] line-clamp-1 mt-0.5">
                        {movie.overview}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* Entry form phase */
          <>
            {/* Selected movie header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--twilight)]">
              <div className="w-12 h-18 flex-shrink-0 rounded overflow-hidden bg-[var(--twilight)]">
                {selected.poster_path && (
                  <SmartImage
                    src={`${TMDB_POSTER_W185}${selected.poster_path}`}
                    alt={selected.title}
                    width={48}
                    height={72}
                    className="object-cover w-full h-full"
                  />
                )}
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--cream)]">
                  {selected.title}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {selected.release_date?.split("-")[0] || ""}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="ml-auto text-xs text-[var(--muted)] hover:text-[var(--cream)]
                  font-mono transition-colors"
              >
                change
              </button>
            </div>

            {/* Date */}
            <div className="mb-4">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                Date Watched
              </label>
              <input
                type="date"
                value={watchedDate}
                onChange={(e) => setWatchedDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg
                  bg-[var(--dusk)] border border-[var(--twilight)]
                  text-[var(--cream)] font-mono text-sm
                  focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>

            {/* Watched with */}
            <div className="mb-4">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                Watched With
              </label>
              <input
                type="text"
                value={watchedWith}
                onChange={(e) => setWatchedWith(e.target.value)}
                placeholder="Ashley + Daniel"
                className="w-full px-3 py-2.5 rounded-lg
                  bg-[var(--dusk)] border border-[var(--twilight)]
                  text-[var(--cream)] font-mono text-sm
                  placeholder:text-[var(--muted)]
                  focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>

            {/* Note */}
            <div className="mb-4">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Quick thoughts..."
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg resize-none
                  bg-[var(--dusk)] border border-[var(--twilight)]
                  text-[var(--cream)] font-mono text-sm
                  placeholder:text-[var(--muted)]
                  focus:outline-none focus:border-[var(--coral)] transition-colors"
              />
            </div>

            {/* List (project) */}
            {lists.length > 0 && (
              <div className="mb-4">
                <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                  List
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedListId(null)}
                    className={`px-2.5 py-1 rounded-full font-mono text-2xs font-medium border transition-colors ${
                      selectedListId === null
                        ? "border-[var(--coral)] text-[var(--coral)] bg-[var(--coral)]/10"
                        : "border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--soft)]"
                    }`}
                  >
                    none
                  </button>
                  {lists.map((list) => (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => setSelectedListId(list.id)}
                      className={`px-2.5 py-1 rounded-full font-mono text-2xs font-medium border transition-colors ${
                        selectedListId === list.id
                          ? "border-[var(--coral)] text-[var(--coral)] bg-[var(--coral)]/10"
                          : "border-[var(--twilight)] text-[var(--muted)] hover:border-[var(--soft)]"
                      }`}
                    >
                      {list.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            <div className="mb-6">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                Tags
              </label>
              <GoblinTagPicker
                tags={tags}
                selectedIds={selectedTagIds}
                onToggle={toggleTag}
                onCreate={onCreateTag}
              />
            </div>

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
                disabled={submitting}
                className="flex-1 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg
                  font-mono text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {submitting ? "Adding..." : "Add to Log"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
