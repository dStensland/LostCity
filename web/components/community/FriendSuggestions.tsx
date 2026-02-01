"use client";

import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import FriendButton from "@/components/FriendButton";
import FollowButton from "@/components/FollowButton";

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

  return (
    <div className="space-y-3">
      <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
        People You May Know
      </h3>
      {suggestions.map((profile) => (
        <UserCard key={profile.id} profile={profile} />
      ))}
    </div>
  );
}

function UserCard({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--neon-cyan)]/30 transition-all group">
      <Link href={`/profile/${profile.username}`} className="flex-shrink-0">
        <UserAvatar
          src={profile.avatar_url}
          name={profile.display_name || profile.username}
          size="md"
          glow
        />
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${profile.username}`}
          className="font-medium text-[var(--cream)] hover:text-[var(--neon-cyan)] transition-colors block truncate"
        >
          {profile.display_name || `@${profile.username}`}
        </Link>
        <p className="text-xs text-[var(--muted)] truncate">@{profile.username}</p>
        {profile.bio && (
          <p className="text-xs text-[var(--soft)] mt-0.5 line-clamp-1">{profile.bio}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <FriendButton
          targetUserId={profile.id}
          targetUsername={profile.username}
          size="sm"
        />
        <FollowButton targetUserId={profile.id} size="sm" />
      </div>
    </div>
  );
}

export type { FriendSuggestionsProps };
