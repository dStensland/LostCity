"use client";

import AnimatedCount from "@/components/AnimatedCount";
import { AvatarStack } from "@/components/UserAvatar";
import { formatCompactCount } from "@/lib/formats";
import type { FriendGoing } from "./types";

interface EventCardSocialProofProps {
  friendsGoing: FriendGoing[];
  hasSocialProof: boolean;
  goingCount: number;
  interestedCount: number;
  recommendationCount: number;
}

/**
 * Social proof row for the comfortable-density EventCard.
 * Shows friend avatars + names, and/or aggregate going/maybe/rec'd counts.
 */
export function EventCardSocialProof({
  friendsGoing,
  hasSocialProof,
  goingCount,
  interestedCount,
  recommendationCount,
}: EventCardSocialProofProps) {
  if (friendsGoing.length === 0 && !hasSocialProof) return null;

  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
      {/* Friends going — coral pill matching "I'm in" state */}
      {friendsGoing.length > 0 && (
        <span className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-lg bg-[var(--coral)]/15 border border-[var(--coral)]/30 shadow-[0_0_8px_var(--coral)/10]">
          <AvatarStack
            users={friendsGoing.map((f) => ({
              id: f.user_id,
              name: f.user.display_name || f.user.username,
              avatar_url: f.user.avatar_url,
            }))}
            max={3}
            size="xs"
            showCount={friendsGoing.length > 3}
          />
          <span className="font-mono text-xs font-medium text-[var(--coral)]">
            {friendsGoing.length === 1 ? (
              <>
                {friendsGoing[0].user.display_name ||
                  friendsGoing[0].user.username}{" "}
                {friendsGoing[0].status === "going" ? "is in" : "is interested"}
              </>
            ) : (
              <>
                {friendsGoing.length} friends{" "}
                {friendsGoing.some((f) => f.status === "going")
                  ? "are in"
                  : "interested"}
              </>
            )}
          </span>
        </span>
      )}

      {/* Mobile: collapsed social proof — single dominant-color summary pill */}
      {hasSocialProof &&
        (() => {
          const counts = [
            {
              type: "going" as const,
              count: goingCount,
              label: "going",
              color: "coral",
            },
            {
              type: "interested" as const,
              count: interestedCount,
              label: "maybe",
              color: "gold",
            },
            {
              type: "recommended" as const,
              count: recommendationCount,
              label: "rec'd",
              color: "lavender",
            },
          ];
          const dominant = counts.reduce((a, b) => (b.count > a.count ? b : a));
          const totalCount = goingCount + interestedCount + recommendationCount;
          if (totalCount <= 0) return null;
          return (
            <span
              className={`sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono text-xs font-medium ${
                dominant.color === "coral"
                  ? "bg-[var(--coral)]/10 border border-[var(--coral)]/20 text-[var(--coral)]"
                  : dominant.color === "gold"
                    ? "bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)]"
                    : "bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 text-[var(--lavender)]"
              }`}
            >
              {dominant.type === "going" && (
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
              {dominant.type === "recommended" && (
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
              )}
              {formatCompactCount(totalCount)} {dominant.label}
            </span>
          );
        })()}

      {/* Desktop: separate pills per count type */}
      <span className="hidden sm:contents">
        {/* Going — coral */}
        {goingCount > 0 &&
          (friendsGoing.length === 0 || goingCount > friendsGoing.length) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--coral)]/10 border border-[var(--coral)]/20 font-mono text-xs font-medium text-[var(--coral)]">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <AnimatedCount value={goingCount} format={formatCompactCount} />{" "}
              going
            </span>
          )}

        {/* Interested — gold */}
        {interestedCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 font-mono text-xs font-medium text-[var(--gold)]">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              />
            </svg>
            <AnimatedCount
              value={interestedCount}
              format={formatCompactCount}
            />{" "}
            maybe
          </span>
        )}

        {/* Recommendations — lavender */}
        {recommendationCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--lavender)]/15 border border-[var(--lavender)]/30 font-mono text-xs font-medium text-[var(--lavender)]">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            <AnimatedCount
              value={recommendationCount}
              format={formatCompactCount}
            />{" "}
            rec&apos;d
          </span>
        )}
      </span>
    </div>
  );
}
