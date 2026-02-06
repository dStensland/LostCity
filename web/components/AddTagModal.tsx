"use client";

import { useState, useEffect, useRef } from "react";
import { getTagGroupsForEntity } from "@/lib/venue-tags-config";
import type { VenueTagDefinition, TagEntityType, TagGroup } from "@/lib/types";

interface AddTagModalProps {
  venueId: number;
  entityType?: TagEntityType;
  onClose: () => void;
  onTagAdded: () => void;
}

export default function AddTagModal({ venueId, entityType = "venue", onClose, onTagAdded }: AddTagModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [tagsByGroup, setTagsByGroup] = useState<Record<string, VenueTagDefinition[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestForm, setShowSuggestForm] = useState(false);
  const [suggestedLabel, setSuggestedLabel] = useState("");
  const [suggestedGroup, setSuggestedGroup] = useState<TagGroup>("vibes");

  // Get tag groups config for current entity type
  const tagGroupsConfig = getTagGroupsForEntity(entityType);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch(`/api/tags?grouped=true&entityType=${entityType}`);
        if (!res.ok) throw new Error("Failed to fetch tags");
        const data = await res.json();
        setTagsByGroup(data.tags || {});
        // Set default suggested group to first available group
        const groups = Object.keys(data.tags || {});
        if (groups.length > 0) {
          setSuggestedGroup(groups[0] as TagGroup);
        }
      } catch (err) {
        console.error("Error fetching tags:", err);
        setError("Failed to load tags");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
    inputRef.current?.focus();
  }, [entityType]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Filter tags by search
  const filteredTags = Object.entries(tagsByGroup).reduce(
    (acc, [group, tags]) => {
      const filtered = tags.filter((tag) =>
        tag.label.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[group] = filtered;
      }
      return acc;
    },
    {} as Record<string, VenueTagDefinition[]>
  );

  const hasResults = Object.keys(filteredTags).length > 0;

  // Add existing tag
  const handleAddTag = async (tagId: string) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/venues/${venueId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add tag");
      }

      onTagAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add tag");
      setIsSubmitting(false);
    }
  };

  // Suggest new tag
  const handleSuggestTag = async () => {
    if (!suggestedLabel.trim()) {
      setError("Please enter a tag name");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/venues/${venueId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestedLabel: suggestedLabel.trim(),
          suggestedTagGroup: suggestedGroup,
          entityType,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to suggest tag");
      }

      // Show success message
      alert("Tag suggestion submitted! It will be reviewed by our team.");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suggest tag");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        ref={modalRef}
        className="w-full max-w-md max-h-[80vh] rounded-xl border border-[var(--twilight)] shadow-2xl overflow-hidden flex flex-col bg-[var(--void)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
          <h2 className="font-mono text-sm font-medium text-[var(--cream)]">
            {showSuggestForm ? "Suggest New Tag" : "Add Tag"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-3 min-w-[48px] min-h-[48px] text-[var(--muted)] hover:text-[var(--cream)] hover:scale-110 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[var(--coral)]/10 text-[var(--coral)] text-sm">
              {error}
            </div>
          )}

          {showSuggestForm ? (
            // Suggest form
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-xs text-[var(--muted)] mb-1.5">
                  Tag Name
                </label>
                <input
                  type="text"
                  value={suggestedLabel}
                  onChange={(e) => setSuggestedLabel(e.target.value)}
                  placeholder="e.g., Great for Working"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] placeholder-[var(--muted)] font-mono text-sm border-none focus:outline-none focus:ring-2 focus:ring-[var(--coral)]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs text-[var(--muted)] mb-1.5">
                  Tag Group
                </label>
                <select
                  value={suggestedGroup}
                  onChange={(e) => setSuggestedGroup(e.target.value as TagGroup)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-sm border-none focus:outline-none focus:ring-2 focus:ring-[var(--coral)]"
                >
                  {Object.entries(tagGroupsConfig).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-[var(--muted)]">
                Your suggestion will be reviewed before being added. Thank you for helping improve our community!
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowSuggestForm(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-[var(--twilight)] text-[var(--cream)] font-mono text-sm hover:bg-[var(--twilight)] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSuggestTag}
                  disabled={isSubmitting || !suggestedLabel.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--coral)]/90 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit"}
                </button>
              </div>
            </div>
          ) : (
            // Tag selection
            <>
              {/* Search */}
              <div className="mb-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tags..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--twilight)] text-[var(--cream)] placeholder-[var(--muted)] font-mono text-sm border-none focus:outline-none focus:ring-2 focus:ring-[var(--coral)]"
                />
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-[var(--muted)]">Loading tags...</div>
              ) : hasResults ? (
                <div className="space-y-4">
                  {Object.entries(filteredTags).map(([group, tags]) => {
                    const groupConfig = tagGroupsConfig[group];
                    return (
                      <div key={group}>
                        <h3
                          data-tag-group={group}
                          className="font-mono text-[0.65rem] uppercase tracking-wider mb-2 tag-group-label"
                        >
                          {groupConfig?.label || group}
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => handleAddTag(tag.id)}
                              disabled={isSubmitting}
                              data-tag-group={group}
                              className="px-2.5 py-1 rounded-lg font-mono text-xs font-medium transition-colors hover:opacity-80 disabled:opacity-50 tag-group-button"
                            >
                              {tag.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-[var(--muted)] mb-4">
                    No tags found for &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}

              {/* Suggest new tag link */}
              <div className="mt-6 pt-4 border-t border-[var(--twilight)] text-center">
                <p className="text-xs text-[var(--muted)] mb-2">
                  Can&apos;t find what you&apos;re looking for?
                </p>
                <button
                  onClick={() => {
                    setSuggestedLabel(searchQuery);
                    setShowSuggestForm(true);
                  }}
                  className="text-sm text-[var(--coral)] hover:text-[var(--rose)] font-medium transition-colors"
                >
                  Suggest a new tag
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
