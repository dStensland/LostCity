"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import type { Curation } from "@/lib/curation-utils";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "@/lib/curation-constants";

interface ListEditModalProps {
  list: Curation;
  portalSlug: string;
  onClose: () => void;
  onUpdated: (list: Curation) => void;
  onDeleted: () => void;
}

export default function ListEditModal({
  list,
  portalSlug,
  onClose,
  onUpdated,
  onDeleted,
}: ListEditModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const trapRef = useFocusTrap<HTMLDivElement>();
  const [title, setTitle] = useState(list.title);
  const [description, setDescription] = useState(list.description || "");
  const [category, setCategory] = useState(list.category || "");
  const [isPublic, setIsPublic] = useState(list.is_public);
  const [accentColor, setAccentColor] = useState(list.accent_color || "");
  const [vibeTags, setVibeTags] = useState<string[]>(list.vibe_tags || []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmDelete) {
          setConfirmDelete(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, confirmDelete]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
    if (tag && !vibeTags.includes(tag) && vibeTags.length < 10) {
      setVibeTags([...vibeTags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setVibeTags(vibeTags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("Title is required", "error");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          category: category || null,
          is_public: isPublic,
          accent_color: accentColor || null,
          vibe_tags: vibeTags,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update curation");
      }

      const data = await res.json();
      showToast("Curation updated");
      onUpdated(data.list);
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/lists/${list.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete curation");
      }

      showToast("Curation deleted");
      onDeleted();
      router.push(`/${portalSlug}/curations`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  };

  const categoryEntries = Object.entries(CATEGORY_LABELS);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Edit curation">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[var(--void)]/80 backdrop-blur-sm modal-backdrop-enter"
        onClick={onClose}
      />

      {/* Centering wrapper */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Modal */}
        <div ref={trapRef} className="relative w-full max-w-md bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl shadow-2xl modal-content-enter">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-[var(--twilight)] bg-[var(--dusk)] rounded-t-xl">
            <h2 className="text-lg font-semibold text-[var(--cream)]">Edit Curation</h2>
            <button
              onClick={onClose}
              aria-label="Close edit modal"
              className="p-3 min-w-[48px] min-h-[48px] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)] rounded-lg hover:scale-110 transition-all active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSave} className="p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)] transition-colors"
                maxLength={100}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)] resize-none transition-colors"
                maxLength={500}
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categoryEntries.map(([value, label]) => {
                  const isSelected = category === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCategory(value)}
                      data-category={value}
                      className={`p-2.5 rounded-lg text-left transition-all border text-sm ${
                        isSelected
                          ? "ring-2 ring-offset-1 ring-offset-[var(--dusk)] bg-[var(--night)] border-[var(--coral)] ring-[var(--coral)] text-[var(--cream)]"
                          : "bg-[var(--night)] border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--soft)]"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={isSelected ? "text-[var(--coral)]" : "text-[var(--muted)]"}>
                          {CATEGORY_ICONS[value]}
                        </span>
                        <span className="font-mono text-xs">{label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
                Accent Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor || "#FBBF24"}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-[var(--twilight)] cursor-pointer bg-transparent"
                  aria-label="Pick accent color"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  placeholder="#FBBF24"
                  className="flex-1 px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)] font-mono text-sm transition-colors"
                  maxLength={7}
                />
                {accentColor && (
                  <button
                    type="button"
                    onClick={() => setAccentColor("")}
                    className="text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                    aria-label="Clear accent color"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Vibe Tags */}
            <div>
              <label className="block text-xs font-mono text-[var(--muted)] uppercase tracking-wider mb-2">
                Vibe Tags <span className="opacity-50">({vibeTags.length}/10)</span>
              </label>
              {vibeTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {vibeTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-[var(--twilight)] text-[var(--cream)]"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-0.5 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Type a tag, press Enter"
                  className="flex-1 px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)] font-mono text-sm transition-colors"
                  maxLength={30}
                  disabled={vibeTags.length >= 10}
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  disabled={!tagInput.trim() || vibeTags.length >= 10}
                  className="px-3 py-2 bg-[var(--twilight)] text-[var(--cream)] rounded-lg text-sm font-mono hover:bg-[var(--twilight)]/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Public toggle */}
            <div className="flex items-center justify-between py-2 px-3 bg-[var(--night)] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--twilight)] flex items-center justify-center">
                  {isPublic ? (
                    <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                </div>
                <div>
                  <div className="text-sm text-[var(--cream)]">
                    {isPublic ? "Public" : "Private"}
                  </div>
                  <div className="text-xs text-[var(--muted)]">
                    {isPublic ? "Anyone can view" : "Only you can see this"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                role="switch"
                aria-checked={isPublic}
                aria-label="Toggle public visibility"
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isPublic ? "bg-[var(--coral)]" : "bg-[var(--twilight)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isPublic ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--twilight)]/80 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="flex-1 px-4 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>

            {/* Delete zone */}
            <div className="pt-4 mt-4 border-t border-[var(--twilight)]">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full px-4 py-2.5 text-red-400 border border-red-400/30 rounded-lg font-mono text-sm hover:bg-red-400/10 transition-colors"
                >
                  Delete Curation
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-red-400 text-center">
                    This will permanently remove this curation and all its items.
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 px-4 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--twilight)]/80 transition-colors"
                    >
                      Keep It
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg font-mono text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      {deleting ? "Deleting..." : "Yes, Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
