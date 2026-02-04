"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import { useDebounce } from "@/lib/hooks/useDebounce";
import FriendButton from "@/components/FriendButton";
import FollowButton from "@/components/FollowButton";

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

interface FriendSearchProps {
  onResultsChange?: (count: number) => void;
}

export function FriendSearch({ onResultsChange }: FriendSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      onResultsChange?.(0);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        const users = data.users || [];
        setSearchResults(users);
        onResultsChange?.(users.length);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearchLoading(false);
    }
  }, [onResultsChange]);

  useEffect(() => {
    searchUsers(debouncedQuery);
  }, [debouncedQuery, searchUsers]);

  return (
    <section>
      {/* Glass search container with focus glow */}
      <div className="glass rounded-xl p-1 group focus-within:shadow-lg transition-shadow duration-300">
        {/* Focus glow effect */}
        <div className="absolute inset-0 rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl" style={{
          background: "radial-gradient(circle at center, var(--coral) 0%, transparent 70%)",
        }} />

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find your people"
            className="w-full px-4 py-3 pl-11 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)]/50 transition-all"
          />
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)] group-focus-within:text-[var(--coral)] transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>

      {searchQuery.length >= 2 && (
        <div className="mt-3 space-y-2">
          {searchResults.length > 0 ? (
            searchResults.map((profile) => (
              <UserCard key={profile.id} profile={profile} />
            ))
          ) : !searchLoading ? (
            <p className="text-center text-[var(--muted)] text-sm py-4">
              No people found for &ldquo;{searchQuery}&rdquo;
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function UserCard({ profile }: { profile: Profile }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)]/30 transition-all group">
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
          className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors block truncate"
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

export type { FriendSearchProps };
