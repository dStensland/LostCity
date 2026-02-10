"use client";

import { useState } from "react";
import { useAuthenticatedFetch } from "@/lib/hooks/useAuthenticatedFetch";

type TagVote = "confirm" | "deny" | null;

interface TagVoteChipProps {
  entityType: "venue" | "event" | "series" | "festival";
  entityId: number;
  tagSlug: string;
  tagLabel: string;
  confirmCount: number;
  denyCount?: number;
  userVote?: TagVote;
  onVoteChange?: (newVote: TagVote) => void;
}

/**
 * TagVoteChip - Community tag voting component
 *
 * Shows a tag label with confirmation count. Users can click to confirm (upvote).
 * Clicking again removes the vote. Displays trust badge when multiple confirmations.
 *
 * Used for accessibility, dietary, and family needs tags across all entity types.
 */
export function TagVoteChip({
  entityType,
  entityId,
  tagSlug,
  tagLabel,
  confirmCount: initialConfirmCount,
  denyCount = 0,
  userVote: initialUserVote = null,
  onVoteChange,
}: TagVoteChipProps) {
  const { authFetch, user, isLoading: isAuthLoading } = useAuthenticatedFetch();
  const [userVote, setUserVote] = useState<TagVote>(initialUserVote);
  const [confirmCount, setConfirmCount] = useState(initialConfirmCount);
  const [isVoting, setIsVoting] = useState(false);

  const isConfirmed = userVote === "confirm";
  const totalConfirms = confirmCount;

  const handleClick = async () => {
    // Require auth for voting
    if (!user) {
      // authFetch will redirect to login
      await authFetch("/api/tags/vote", { method: "POST", body: {} });
      return;
    }

    if (isVoting) return;

    setIsVoting(true);

    try {
      if (isConfirmed) {
        // Remove vote
        const queryParams = new URLSearchParams({
          entity_type: entityType,
          entity_id: entityId.toString(),
          tag_slug: tagSlug,
        });
        const { error } = await authFetch(`/api/tags/vote?${queryParams.toString()}`, {
          method: "DELETE",
          body: undefined,
        });

        if (!error) {
          setUserVote(null);
          setConfirmCount((prev) => Math.max(0, prev - 1));
          onVoteChange?.(null);
        }
      } else {
        // Add/update vote to confirm
        const { error } = await authFetch<{ success: boolean }>("/api/tags/vote", {
          method: "POST",
          body: {
            entity_type: entityType,
            entity_id: entityId,
            tag_slug: tagSlug,
            vote: "confirm",
          },
        });

        if (!error) {
          const wasNull = userVote === null;
          setUserVote("confirm");
          if (wasNull) {
            setConfirmCount((prev) => prev + 1);
          }
          onVoteChange?.("confirm");
        }
      }
    } finally {
      setIsVoting(false);
    }
  };

  // Trust badge: show count when >= 3 confirmations (per PRD 004 Section 7.3)
  const showTrustBadge = totalConfirms >= 3;

  return (
    <button
      onClick={handleClick}
      disabled={isVoting || isAuthLoading}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
        transition-all duration-200 ease-in-out
        ${
          isConfirmed
            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-2 border-green-500"
            : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600"
        }
        ${isVoting ? "opacity-50 cursor-wait" : "cursor-pointer hover:scale-105"}
        disabled:cursor-not-allowed disabled:opacity-50
      `}
      aria-label={`${isConfirmed ? "Remove vote from" : "Confirm"} ${tagLabel}`}
      aria-pressed={isConfirmed}
    >
      {/* Checkmark icon when confirmed */}
      {isConfirmed && (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}

      {/* Tag label */}
      <span>{tagLabel}</span>

      {/* Trust badge with count */}
      {showTrustBadge && (
        <span
          className={`
            inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold
            ${
              isConfirmed
                ? "bg-green-500 text-white"
                : "bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
            }
          `}
          title={`${totalConfirms} ${totalConfirms === 1 ? "person confirms" : "people confirm"}`}
        >
          {totalConfirms}
        </span>
      )}
    </button>
  );
}
