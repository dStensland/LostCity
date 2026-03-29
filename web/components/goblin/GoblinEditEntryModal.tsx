"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import GoblinTagPicker from "./GoblinTagPicker";
import { TMDB_POSTER_W185, type LogEntry, type GoblinTag } from "@/lib/goblin-log-utils";

interface Props {
  entry: LogEntry | null;
  open: boolean;
  onClose: () => void;
  onSave: (
    entryId: number,
    data: {
      watched_date?: string;
      note?: string;
      watched_with?: string;
      tag_ids?: number[];
    }
  ) => Promise<boolean>;
  onDelete: (entryId: number) => Promise<boolean>;
  tags: GoblinTag[];
  onCreateTag: (name: string) => Promise<GoblinTag | null>;
}

export default function GoblinEditEntryModal({
  entry,
  open,
  onClose,
  onSave,
  onDelete,
  tags,
  onCreateTag,
}: Props) {
  const [watchedDate, setWatchedDate] = useState("");
  const [note, setNote] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Populate form when entry changes
  useEffect(() => {
    if (entry) {
      setWatchedDate(entry.watched_date);
      setNote(entry.note || "");
      setWatchedWith(entry.watched_with || "");
      setSelectedTagIds(entry.tags.map((t) => t.id));
      setConfirmDelete(false);
    }
  }, [entry]);

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

  const handleSave = async () => {
    if (!entry || submitting) return;
    setSubmitting(true);
    const success = await onSave(entry.id, {
      watched_date: watchedDate,
      note: note.trim() || undefined,
      watched_with: watchedWith.trim() || undefined,
      tag_ids: selectedTagIds,
    });
    setSubmitting(false);
    if (success) onClose();
  };

  const handleDelete = async () => {
    if (!entry || submitting) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSubmitting(true);
    const success = await onDelete(entry.id);
    setSubmitting(false);
    if (success) onClose();
  };

  if (!open || !entry) return null;

  const movie = entry.movie;

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
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full
            hover:bg-[var(--twilight)] transition-colors
            flex items-center justify-center text-[var(--muted)]"
        >
          ✕
        </button>

        <h2 className="text-xl font-semibold text-[var(--cream)] mb-6">
          Edit Entry
        </h2>

        {/* Movie header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--twilight)]">
          <div className="w-12 h-18 flex-shrink-0 rounded overflow-hidden bg-[var(--twilight)]">
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
            <p className="text-base font-semibold text-[var(--cream)]">{movie.title}</p>
            <p className="text-xs text-[var(--muted)]">{movie.year || ""}</p>
          </div>
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
            onClick={handleDelete}
            disabled={submitting}
            className={`py-2.5 px-4 rounded-lg font-mono text-sm transition-colors ${
              confirmDelete
                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                : "text-[var(--muted)] hover:text-red-400"
            }`}
          >
            {confirmDelete ? "Confirm Delete" : "Delete"}
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="py-2.5 px-4 bg-[var(--twilight)] text-[var(--cream)] rounded-lg
              font-mono text-sm hover:bg-[var(--dusk)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="py-2.5 px-4 bg-[var(--coral)] text-[var(--void)] rounded-lg
              font-mono text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
