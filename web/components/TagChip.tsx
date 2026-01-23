"use client";

import { useState } from "react";
import { TAG_CATEGORIES } from "@/lib/venue-tags";
import type { VenueTagWithVote, VenueTagCategory } from "@/lib/types";

interface TagChipProps {
  tag: VenueTagWithVote;
  venueId: number;
  onVote?: (tagId: string, voteType: "up" | "down" | null) => Promise<void>;
  compact?: boolean;
  showVoteControls?: boolean;
}

export default function TagChip({
  tag,
  venueId,
  onVote,
  compact = false,
  showVoteControls = true,
}: TagChipProps) {
  const [isVoting, setIsVoting] = useState(false);
  const [optimisticVote, setOptimisticVote] = useState<"up" | "down" | null | undefined>(
    undefined
  );

  const categoryConfig = TAG_CATEGORIES[tag.tag_category as VenueTagCategory];
  const color = categoryConfig?.color || "var(--cream)";

  const currentVote = optimisticVote !== undefined ? optimisticVote : tag.user_vote;
  const isVerified = tag.score >= 5;

  const handleVote = async (voteType: "up" | "down") => {
    if (!onVote || isVoting) return;

    // If clicking same vote, remove it
    const newVote = currentVote === voteType ? null : voteType;

    setOptimisticVote(newVote);
    setIsVoting(true);

    try {
      await onVote(tag.tag_id, newVote);
    } catch (error) {
      // Revert on error
      setOptimisticVote(undefined);
      console.error("Vote failed:", error);
    } finally {
      setIsVoting(false);
    }
  };

  if (compact) {
    // Compact view for SpotCard - just show label
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-mono font-medium border"
        style={{
          borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
          backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
          color: color,
        }}
      >
        {tag.tag_label}
        {tag.score > 0 && (
          <span className="ml-1 opacity-60">{tag.score}</span>
        )}
      </span>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition-colors"
      style={{
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {/* Tag label */}
      <span
        className="font-mono text-xs font-medium"
        style={{ color }}
      >
        {tag.tag_label}
      </span>

      {/* Verified badge */}
      {isVerified && (
        <span title="Verified by community">
          <svg
            className="w-3 h-3 text-[var(--neon-green)]"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      )}

      {/* Score and vote controls */}
      {showVoteControls && (
        <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-current/20">
          {/* Upvote */}
          <button
            onClick={() => handleVote("up")}
            disabled={isVoting}
            className={`p-0.5 rounded transition-colors ${
              currentVote === "up"
                ? "text-[var(--neon-green)]"
                : "text-[var(--muted)] hover:text-[var(--neon-green)]"
            } ${isVoting ? "opacity-50" : ""}`}
            title="Upvote"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Score */}
          <span
            className="font-mono text-[0.65rem] min-w-[1.5rem] text-center"
            style={{ color }}
          >
            {tag.score}
          </span>

          {/* Downvote */}
          <button
            onClick={() => handleVote("down")}
            disabled={isVoting}
            className={`p-0.5 rounded transition-colors ${
              currentVote === "down"
                ? "text-[var(--coral)]"
                : "text-[var(--muted)] hover:text-[var(--coral)]"
            } ${isVoting ? "opacity-50" : ""}`}
            title="Downvote"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* User added indicator */}
      {tag.user_added && (
        <span
          className="text-[0.55rem] text-[var(--muted)] ml-1"
          title="You added this tag"
        >
          (you)
        </span>
      )}
    </div>
  );
}
