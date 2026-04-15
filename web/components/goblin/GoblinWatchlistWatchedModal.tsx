"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import GoblinTagPicker from "./GoblinTagPicker";
import {
  toISODate,
  TMDB_POSTER_W185,
  type GoblinTag,
} from "@/lib/goblin-log-utils";
import type { WatchlistEntry } from "@/lib/goblin-watchlist-utils";

interface Props {
  entry: WatchlistEntry | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (
    entryId: number,
    logData: {
      watched_date: string;
      note?: string;
      watched_with?: string;
      log_tag_ids?: number[];
    }
  ) => Promise<{ log_entry_id: number } | null>;
  logTags: GoblinTag[];
  onCreateLogTag: (name: string) => Promise<GoblinTag | null>;
}

export default function GoblinWatchlistWatchedModal({
  entry,
  open,
  onClose,
  onSubmit,
  logTags,
  onCreateLogTag,
}: Props) {
  const [watchedDate, setWatchedDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Reset state on close
  /* eslint-disable react-hooks/set-state-in-effect --
     Modal close-reset: clears all form fields when open flips false.
     Cascade bounded — none of the reset fields are in the dep array
     ([open]). */
  useEffect(() => {
    if (!open) {
      setWatchedDate(toISODate(new Date()));
      setNote("");
      setWatchedWith("");
      setSelectedTagIds([]);
    }
  }, [open]);
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

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  }, []);

  const handleSubmit = async () => {
    if (!entry || submitting) return;
    setSubmitting(true);
    const result = await onSubmit(entry.id, {
      watched_date: watchedDate,
      note: note.trim() || undefined,
      watched_with: watchedWith.trim() || undefined,
      log_tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
    });
    setSubmitting(false);
    if (result) onClose();
  };

  if (!open || !entry) return null;

  const movie = entry.movie;
  const year = movie.year ?? movie.release_date?.split("-")[0] ?? "";

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
          Log It
        </h2>

        {/* Movie header — not editable */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--twilight)]">
          <div className="w-12 h-[72px] flex-shrink-0 rounded overflow-hidden bg-[var(--twilight)]">
            {movie.poster_path && (
              <SmartImage
                src={`${TMDB_POSTER_W185}${movie.poster_path}`}
                alt={movie.title}
                width={48}
                height={72}
                className="object-cover w-full h-full"
              />
            )}
          </div>
          <div>
            <p className="text-base font-semibold text-[var(--cream)]">
              {movie.title}
            </p>
            {year && (
              <p className="text-xs text-[var(--muted)]">{year}</p>
            )}
          </div>
        </div>

        {/* Date Watched */}
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
              focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Watched With */}
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
              focus:outline-none focus:border-emerald-500 transition-colors"
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
              focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Log Tags */}
        <div className="mb-6">
          <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5 block">
            Tags
          </label>
          <GoblinTagPicker
            tags={logTags}
            selectedIds={selectedTagIds}
            onToggle={toggleTag}
            onCreate={onCreateLogTag}
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
            className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg
              font-mono text-sm font-medium disabled:opacity-50
              hover:bg-emerald-500 transition-colors"
          >
            {submitting ? "Logging..." : "Log It"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
