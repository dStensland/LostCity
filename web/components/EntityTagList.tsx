"use client";

import { useState, useEffect, useCallback } from "react";
import TagChip from "./TagChip";
import AddTagModal from "./AddTagModal";
import type { VenueTagWithVote, TagEntityType } from "@/lib/types";

interface EntityTagListProps {
  entityType: TagEntityType;
  entityId: number | string;
  compact?: boolean; // Smaller display without header
}

export default function EntityTagList({
  entityType,
  entityId,
  compact = false,
}: EntityTagListProps) {
  const [tags, setTags] = useState<VenueTagWithVote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build the API URL based on entity type
  const getApiUrl = useCallback(() => {
    switch (entityType) {
      case "venue":
        return `/api/venues/${entityId}/tags`;
      case "event":
        return `/api/events/${entityId}/tags`;
      case "org":
        return `/api/orgs/${entityId}/tags`;
      default:
        return `/api/venues/${entityId}/tags`;
    }
  }, [entityType, entityId]);

  // Fetch tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const res = await fetch(getApiUrl());
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
  }, [getApiUrl]);

  // Handle voting
  const handleVote = useCallback(
    async (tagId: string, voteType: "up" | "down" | null) => {
      const res = await fetch(`${getApiUrl()}/${tagId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteType }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Vote failed");
      }

      // Refresh tags after successful vote
      const tagsRes = await fetch(getApiUrl());
      if (tagsRes.ok) {
        const data = await tagsRes.json();
        setTags(data.tags || []);
      }
    },
    [getApiUrl]
  );

  // Handle tag added
  const handleTagAdded = useCallback(async () => {
    // Refresh tags
    const res = await fetch(getApiUrl());
    if (res.ok) {
      const data = await res.json();
      setTags(data.tags || []);
    }
    setShowAddModal(false);
  }, [getApiUrl]);

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="flex gap-2">
          <div className="h-7 w-20 bg-[var(--twilight)] rounded-lg" />
          <div className="h-7 w-16 bg-[var(--twilight)] rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return null; // Silently fail for tags
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {tags.length > 0 ? (
          tags.map((tag) => (
            <TagChip key={tag.tag_id} tag={tag} onVote={handleVote} />
          ))
        ) : (
          <span className="text-xs text-[var(--muted)]">No tags yet</span>
        )}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--twilight)]/50 text-[var(--muted)] font-mono text-[0.65rem] hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>

        {showAddModal && (
          <AddTagModal
            venueId={typeof entityId === "number" ? entityId : 0}
            entityType={entityType}
            onClose={() => setShowAddModal(false)}
            onTagAdded={handleTagAdded}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Tags display */}
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <TagChip key={tag.tag_id} tag={tag} onVote={handleVote} />
          ))}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--twilight)]/50 text-[var(--muted)] font-mono text-xs hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-[var(--muted)] py-3 px-4 border border-dashed border-[var(--twilight)] rounded-lg">
          <span>No community tags yet</span>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--twilight)] text-[var(--cream)] font-mono text-xs hover:bg-[var(--coral)]/20 hover:text-[var(--coral)] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Be the first
          </button>
        </div>
      )}

      {/* Add tag modal */}
      {showAddModal && (
        <AddTagModal
          venueId={typeof entityId === "number" ? entityId : 0}
          entityType={entityType}
          onClose={() => setShowAddModal(false)}
          onTagAdded={handleTagAdded}
        />
      )}
    </div>
  );
}
