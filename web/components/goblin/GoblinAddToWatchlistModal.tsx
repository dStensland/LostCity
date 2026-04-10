"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import GoblinTagPicker from "./GoblinTagPicker";
import {
  TMDB_POSTER_W185,
  type TMDBSearchResult,
} from "@/lib/goblin-log-utils";
import type { WatchlistTag } from "@/lib/goblin-watchlist-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    tmdb_id: number;
    note?: string;
    tag_ids?: number[];
  }) => Promise<boolean>;
  searchTMDB: (query: string) => Promise<TMDBSearchResult[]>;
  tags: WatchlistTag[];
  onCreateTag: (name: string) => Promise<WatchlistTag | null>;
}

export default function GoblinAddToWatchlistModal({
  open,
  onClose,
  onSubmit,
  searchTMDB,
  tags,
  onCreateTag,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<TMDBSearchResult | null>(null);
  const [note, setNote] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // Reset state on close
      setQuery("");
      setResults([]);
      setSelected(null);
      setNote("");
      setSelectedTagIds([]);
    }
  }, [open]);

  // Debounced TMDB search
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
      note: note.trim() || undefined,
      tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
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
          Add to Queue
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
                focus:outline-none focus:border-amber-500 transition-colors"
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
                      group-hover:text-amber-400 transition-colors">
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

            {/* Note */}
            <div className="mb-4">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                Note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Why this movie? Who recommended it?"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg resize-none
                  bg-[var(--dusk)] border border-[var(--twilight)]
                  text-[var(--cream)] font-mono text-sm
                  placeholder:text-[var(--muted)]
                  focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Tags */}
            <div className="mb-6">
              <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
                Tags
              </label>
              <GoblinTagPicker
                tags={tags as { id: number; name: string; color: string | null }[]}
                selectedIds={selectedTagIds}
                onToggle={toggleTag}
                onCreate={onCreateTag as (name: string) => Promise<{ id: number; name: string; color: string | null } | null>}
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
                className="flex-1 py-2.5 bg-amber-600 text-black rounded-lg
                  font-mono text-sm font-medium disabled:opacity-50
                  hover:bg-amber-500 transition-colors"
              >
                {submitting ? "Adding..." : "Add to Queue"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
