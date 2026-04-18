"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import SmartImage from "@/components/SmartImage";
import GoblinTagPicker from "./GoblinTagPicker";
import { TMDB_POSTER_W185, TAG_COLORS, type LogEntry, type GoblinTag, type LogList } from "@/lib/goblin-log-utils";

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
      tier_name?: string | null;
      tier_color?: string | null;
      list_id?: number | null;
    }
  ) => Promise<boolean>;
  onDelete: (entryId: number) => Promise<boolean>;
  tags: GoblinTag[];
  lists: LogList[];
  onCreateTag: (name: string) => Promise<GoblinTag | null>;
}

export default function GoblinEditEntryModal({
  entry,
  open,
  onClose,
  onSave,
  onDelete,
  tags,
  lists,
  onCreateTag,
}: Props) {
  const [watchedDate, setWatchedDate] = useState("");
  const [note, setNote] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tierEnabled, setTierEnabled] = useState(false);
  const [tierName, setTierName] = useState("");
  const [tierColor, setTierColor] = useState<string>(TAG_COLORS[0]);

  // Populate form when entry changes
  /* eslint-disable react-hooks/set-state-in-effect --
     Derived-state reset when entry prop changes: seeds every form field
     from the entry being edited. Cascade bounded — none of the form
     state fields appear in the dep array ([entry]). */
  useEffect(() => {
    if (entry) {
      setWatchedDate(entry.watched_date);
      setNote(entry.note || "");
      setWatchedWith(entry.watched_with || "");
      setSelectedTagIds(entry.tags.map((t) => t.id));
      setSelectedListId(entry.list_id ?? null);
      setConfirmDelete(false);
      setTierEnabled(!!entry.tier_name);
      setTierName(entry.tier_name || "");
      setTierColor(entry.tier_color || TAG_COLORS[0] as string);
    }
  }, [entry]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      tier_name: tierEnabled ? tierName.trim() || undefined : null,
      tier_color: tierEnabled ? tierColor : null,
      list_id: selectedListId,
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

        {/* Tier */}
        <div className="mb-6 border-t border-[var(--twilight)] pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
              Start New Tier
            </label>
            <button
              onClick={() => setTierEnabled(!tierEnabled)}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                tierEnabled ? "bg-cyan-600" : "bg-zinc-700"
              }`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                tierEnabled ? "translate-x-5" : "translate-x-0.5"
              }`} />
            </button>
          </div>
          {tierEnabled && (
            <div className="space-y-3 animate-fade-in">
              <input
                type="text"
                value={tierName}
                onChange={(e) => setTierName(e.target.value)}
                placeholder="e.g. Transcendent, Great, Solid..."
                className="w-full px-3 py-2.5 rounded-lg
                  bg-[var(--dusk)] border border-[var(--twilight)]
                  text-[var(--cream)] font-mono text-sm
                  placeholder:text-[var(--muted)]
                  focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <div className="flex items-center gap-1.5 flex-wrap">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setTierColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      tierColor === c ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}
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
