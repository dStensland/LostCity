"use client";

import { useState, useEffect, useCallback } from "react";
import TagChip from "./TagChip";
import AddTagModal from "./AddTagModal";
import type { VenueTagWithVote } from "@/lib/types";

interface VenueTagListProps {
  venueId: number;
  initialTags?: VenueTagWithVote[];
}

export default function VenueTagList({ venueId, initialTags = [] }: VenueTagListProps) {
  const [tags, setTags] = useState<VenueTagWithVote[]>(initialTags);
  const [isLoading, setIsLoading] = useState(initialTags.length === 0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch tags on mount if not provided
  useEffect(() => {
    if (initialTags.length > 0) return;

    const fetchTags = async () => {
      try {
        const res = await fetch(`/api/venues/${venueId}/tags`);
        if (!res.ok) throw new Error("Failed to fetch tags");
        const data = await res.json();
        setTags(data.tags || []);
      } catch (err) {
        console.error("Error fetching tags:", err);
        setError("Failed to load tags");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTags();
  }, [venueId, initialTags.length]);

  // Handle voting
  const handleVote = useCallback(
    async (tagId: string, voteType: "up" | "down" | null) => {
      const res = await fetch(`/api/venues/${venueId}/tags/${tagId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteType }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Vote failed");
      }

      // Refresh tags after successful vote
      const tagsRes = await fetch(`/api/venues/${venueId}/tags`);
      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setTags(data.tags || []);
      }
    },
    [venueId]
  );

  // Handle tag added
  const handleTagAdded = useCallback(async () => {
    // Refresh tags
    const res = await fetch(`/api/venues/${venueId}/tags`);
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags || []);
    }
    setShowAddModal(false);
  }, [venueId]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="flex gap-2">
          <div className="h-8 w-24 bg-[var(--twilight)] rounded-lg" />
          <div className="h-8 w-20 bg-[var(--twilight)] rounded-lg" />
          <div className="h-8 w-28 bg-[var(--twilight)] rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-[var(--coral)]">{error}</div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest">
          Community Says
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs font-medium hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* Tags grid */}
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagChip
              key={tag.tag_id}
              tag={tag}
              onVote={handleVote}
            />
          ))}
        </div>
      ) : (
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-4 px-4 border border-dashed border-[var(--twilight)] rounded-lg hover:border-[var(--coral)]/30 hover:bg-[var(--twilight)]/20 transition-all group"
        >
          <p className="text-sm text-[var(--muted)] text-center mb-2">
            What&apos;s the vibe here?
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {["chill", "loud", "trendy", "divey", "date night"].map((example) => (
              <span
                key={example}
                className="px-2 py-1 rounded-md bg-[var(--twilight)]/50 text-[var(--soft)] font-mono text-xs opacity-60 group-hover:opacity-100 transition-opacity"
              >
                {example}
              </span>
            ))}
          </div>
        </button>
      )}

      {/* Add tag modal */}
      {showAddModal && (
        <AddTagModal
          venueId={venueId}
          onClose={() => setShowAddModal(false)}
          onTagAdded={handleTagAdded}
        />
      )}
    </div>
  );
}
