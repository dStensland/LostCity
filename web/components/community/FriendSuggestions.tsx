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
};

interface FriendSuggestionsProps {
  suggestions: Profile[];
}

export function FriendSuggestions({ suggestions }: FriendSuggestionsProps) {
  const [hiddenCards, setHiddenCards] = useState<Set<string>>(new Set());

  const handleCardDismiss = useCallback((profileId: string) => {
    setHiddenCards((prev) => new Set(prev).add(profileId));
  }, []);

  const visibleSuggestions = suggestions.filter(
    (profile) => !hiddenCards.has(profile.id)
  );

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
      <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
        People You May Know
      </h3>
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

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] transition-all duration-500 group ${
        cardState === "idle"
          ? "hover:border-[var(--neon-cyan)]/30 opacity-100 scale-100"
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
      <Link href={`/profile/${profile.username}`} className="flex-shrink-0">
        <UserAvatar
          src={profile.avatar_url}
          name={profile.display_name || profile.username}
          size="md"
          glow
        />
      </Link>

      <div className="flex-1 min-w-0 w-full sm:w-auto">
        <Link
          href={`/profile/${profile.username}`}
          className="font-medium text-[var(--cream)] hover:text-[var(--neon-cyan)] transition-colors block truncate"
        >
          {profile.display_name || `@${profile.username}`}
        </Link>
        <p className="text-xs text-[var(--muted)] truncate">@{profile.username}</p>
        {profile.bio && (
          <p className="text-xs text-[var(--soft)] mt-0.5 line-clamp-2 sm:line-clamp-1">
            {profile.bio}
          </p>
        )}
        {cardState === "actioned" && (
          <p className="text-xs text-[var(--neon-green)] font-mono mt-1 flex items-center gap-1.5">
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

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto flex-shrink-0">
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

export type { FriendSuggestionsProps };
