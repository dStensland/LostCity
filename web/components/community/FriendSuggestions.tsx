"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import FriendButton from "@/components/FriendButton";
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

  if (visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--muted)] px-1">
        Suggested
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {visibleSuggestions.map((profile) => (
          <SuggestionCard
            key={profile.id}
            profile={profile}
            onDismiss={handleCardDismiss}
          />
        ))}
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  profile: Profile;
  onDismiss: (profileId: string) => void;
}

function SuggestionCard({ profile, onDismiss }: SuggestionCardProps) {
  const [cardState, setCardState] = useState<"idle" | "actioned" | "hiding">("idle");

  const handleRelationshipChange = useCallback(
    (newStatus: RelationshipStatus) => {
      if (newStatus === "request_sent" && cardState === "idle") {
        setCardState("actioned");
        setTimeout(() => setCardState("hiding"), 1200);
        setTimeout(() => onDismiss(profile.id), 1700);
      }
    },
    [cardState, onDismiss, profile.id]
  );

  const subtitle = profile.mutual_friends_count && profile.mutual_friends_count > 0
    ? `${profile.mutual_friends_count} mutual`
    : getSuggestionReasonShort(profile);

  return (
    <div
      className={`flex-shrink-0 w-[130px] rounded-lg border border-[var(--twilight)]/40 bg-[var(--dusk)]/60 p-3 flex flex-col items-center text-center transition-all duration-500 ${
        cardState === "idle" ? "opacity-100" : ""
      } ${
        cardState === "actioned" ? "border-[var(--neon-green)]/40" : ""
      } ${
        cardState === "hiding" ? "opacity-0 scale-90" : ""
      }`}
    >
      <Link href={`/profile/${profile.username}`} className="mb-2">
        <UserAvatar
          src={profile.avatar_url}
          name={profile.display_name || profile.username}
          size="md"
        />
      </Link>
      <Link
        href={`/profile/${profile.username}`}
        className="text-xs text-[var(--cream)] font-medium truncate w-full hover:text-[var(--coral)] transition-colors"
      >
        {profile.display_name || `@${profile.username}`}
      </Link>
      {subtitle && (
        <p className="text-[10px] text-[var(--muted)] font-mono truncate w-full mt-0.5">
          {subtitle}
        </p>
      )}
      <div className="mt-2 w-full">
        {cardState === "actioned" ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--neon-green)] font-mono">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Sent
          </span>
        ) : (
          <FriendButton
            targetUserId={profile.id}
            targetUsername={profile.username}
            size="sm"
            className="w-full justify-center text-[11px]"
            onRelationshipChange={handleRelationshipChange}
          />
        )}
      </div>
    </div>
  );
}

function getSuggestionReasonShort(profile: Profile): string | null {
  if (!profile.suggestion_reason) return null;
  switch (profile.suggestion_reason) {
    case "mutual_friends":
      return "Mutual friends";
    case "shared_interests":
      return "Similar interests";
    case "similar_activity":
      return "Similar events";
    case "popular":
      return "Popular nearby";
    default:
      return null;
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-3 skeleton-shimmer rounded w-16" />
      <div className="flex gap-3 overflow-hidden -mx-1 px-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-shrink-0 w-[130px] rounded-lg bg-[var(--dusk)]/60 border border-[var(--twilight)]/40 p-3 flex flex-col items-center"
          >
            <div className="w-9 h-9 skeleton-shimmer rounded-full mb-2" />
            <div className="h-3 skeleton-shimmer rounded w-16 mb-1" />
            <div className="h-2 skeleton-shimmer rounded w-12" />
            <div className="h-6 skeleton-shimmer rounded w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export type { FriendSuggestionsProps };
