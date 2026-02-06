"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import FriendButton from "@/components/FriendButton";
import FollowButton from "@/components/FollowButton";
import type { RelationshipStatus } from "@/lib/hooks/useFriendship";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  mutual_friends_count?: number;
  suggestion_reason?: "mutual_friends" | "shared_interests" | "similar_activity" | "popular";
};

interface FriendSuggestionsProps {
  suggestions: Profile[];
  isLoading?: boolean;
}

export function FriendSuggestions({ suggestions, isLoading = false }: FriendSuggestionsProps) {
  const [hiddenCards, setHiddenCards] = useState<Set<string>>(new Set());

  const handleCardDismiss = useCallback((profileId: string) => {
    setHiddenCards((prev) => new Set(prev).add(profileId));
  }, []);

  const visibleSuggestions = suggestions.filter(
    (profile) => !hiddenCards.has(profile.id)
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (suggestions.length === 0) {
    return (
      <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p className="text-[var(--soft)] font-mono text-sm">
          No recommendations yet
        </p>
        <p className="text-[var(--muted)] font-mono text-xs mt-1">
          Connect with more people to see suggestions
        </p>
      </div>
    );
  }

  if (visibleSuggestions.length === 0) {
    return (
      <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-[var(--neon-green)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-[var(--soft)] font-mono text-sm">
          All caught up!
        </p>
        <p className="text-[var(--muted)] font-mono text-xs mt-1">
          Check back later for more suggestions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Section header with cyan accent and gradient divider */}
      <div className="flex items-center gap-3">
        <h3
          className="font-mono text-xs font-bold uppercase tracking-wider text-neon-cyan-glow"
        >
          People You May Know
        </h3>
        <div
          className="flex-1 h-px divider-neon-cyan"
        />
        <span
          className="font-mono text-xs px-2 py-0.5 rounded-full badge-neon-cyan"
        >
          {visibleSuggestions.length}
        </span>
      </div>
      {visibleSuggestions.map((profile) => (
        <UserCard
          key={profile.id}
          profile={profile}
          onDismiss={handleCardDismiss}
        />
      ))}
    </div>
  );
}

interface UserCardProps {
  profile: Profile;
  onDismiss: (profileId: string) => void;
}

function UserCard({ profile, onDismiss }: UserCardProps) {
  const [cardState, setCardState] = useState<"idle" | "actioned" | "hiding">("idle");
  const [showTooltip, setShowTooltip] = useState(false);

  const handleRelationshipChange = useCallback(
    (newStatus: RelationshipStatus) => {
      if (newStatus === "request_sent" && cardState === "idle") {
        setCardState("actioned");

        setTimeout(() => {
          setCardState("hiding");
        }, 1500);

        setTimeout(() => {
          onDismiss(profile.id);
        }, 2000);
      }
    },
    [cardState, onDismiss, profile.id]
  );

  const suggestionReason = getSuggestionReasonText(profile);

  return (
    <div
      className={`relative flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg glass border border-[var(--twilight)]/50 transition-all duration-500 group ${
        cardState === "idle"
          ? "hover:border-[var(--coral)]/30 opacity-100 scale-100"
          : ""
      } ${
        cardState === "actioned"
          ? "border-[var(--neon-green)]/50 bg-[var(--neon-green)]/5 opacity-100 scale-100"
          : ""
      } ${
        cardState === "hiding"
          ? "opacity-0 scale-95 -translate-y-2"
          : ""
      }`}
    >
      {/* Hover glow effect */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl hover-glow-coral-cyan"
      />
      <Link href={`/profile/${profile.username}`} className="flex-shrink-0 relative z-10">
        <UserAvatar
          src={profile.avatar_url}
          name={profile.display_name || profile.username}
          size="md"
          glow
        />
      </Link>

      <div className="flex-1 min-w-0 w-full sm:w-auto relative z-10">
        <div className="flex items-center gap-2">
          <Link
            href={`/profile/${profile.username}`}
            className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors truncate"
          >
            {profile.display_name || `@${profile.username}`}
          </Link>
          {suggestionReason && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="flex-shrink-0 w-4 h-4 rounded-full bg-[var(--twilight)] hover:bg-[var(--coral)]/20 flex items-center justify-center transition-colors"
                aria-label="Why suggested"
              >
                <svg className="w-2.5 h-2.5 text-[var(--muted)]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </button>
              {showTooltip && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-[var(--void)] border border-[var(--twilight)] rounded-lg shadow-lg z-10 whitespace-nowrap animate-fade-in pointer-events-none">
                  <p className="font-mono text-xs text-[var(--soft)]">{suggestionReason}</p>
                  <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-4 border-transparent border-t-[var(--twilight)]" />
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-[var(--muted)] truncate">@{profile.username}</p>

        {profile.mutual_friends_count && profile.mutual_friends_count > 0 && (
          <p className="text-xs text-[var(--coral)] font-mono mt-0.5">
            {profile.mutual_friends_count} mutual friend{profile.mutual_friends_count !== 1 ? "s" : ""}
          </p>
        )}

        {profile.bio && (
          <p className="text-xs text-[var(--soft)] mt-0.5 line-clamp-2 sm:line-clamp-1">
            {profile.bio}
          </p>
        )}

        {cardState === "actioned" && (
          <p className="text-xs text-[var(--neon-green)] font-mono mt-1 flex items-center gap-1.5 animate-fade-in">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Request sent successfully
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-shrink-0 relative z-10">
        <FriendButton
          targetUserId={profile.id}
          targetUsername={profile.username}
          size="sm"
          onRelationshipChange={handleRelationshipChange}
        />
        <FollowButton targetUserId={profile.id} size="sm" />
      </div>
    </div>
  );
}

function getSuggestionReasonText(profile: Profile): string | null {
  if (!profile.suggestion_reason) return null;

  switch (profile.suggestion_reason) {
    case "mutual_friends":
      return profile.mutual_friends_count && profile.mutual_friends_count > 0
        ? `${profile.mutual_friends_count} mutual friend${profile.mutual_friends_count !== 1 ? "s" : ""}`
        : "Mutual connections";
    case "shared_interests":
      return "Similar event interests";
    case "similar_activity":
      return "Goes to similar events";
    case "popular":
      return "Popular in your area";
    default:
      return null;
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
        People You May Know
      </h3>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]"
        >
          <div className="w-9 h-9 skeleton-shimmer rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2 w-full sm:w-auto">
            <div className="h-4 skeleton-shimmer rounded w-32" />
            <div className="h-3 skeleton-shimmer rounded w-24" />
            <div className="h-3 skeleton-shimmer rounded w-40" />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <div className="h-8 skeleton-shimmer rounded flex-1 sm:flex-none sm:w-20" />
            <div className="h-8 skeleton-shimmer rounded flex-1 sm:flex-none sm:w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export type { FriendSuggestionsProps };
