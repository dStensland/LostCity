"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import UnifiedHeader from "@/components/UnifiedHeader";
import PageFooter from "@/components/PageFooter";
import FollowButton from "@/components/FollowButton";
import FriendButton from "@/components/FriendButton";
import { useAuth } from "@/lib/auth-context";
import { useDebounce } from "@/lib/hooks/useDebounce";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default function PeoplePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchUsers = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    searchUsers(debouncedQuery);
  }, [debouncedQuery, searchUsers]);

  const getInitials = (name: string | null, username: string) => {
    if (name) {
      return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-serif text-2xl text-[var(--cream)] italic mb-2">Find People</h1>
        <p className="text-[var(--muted)] text-sm mb-6">
          Search for people to follow and connect with
        </p>

        {/* Search input */}
        <div className="relative mb-8">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full px-4 py-3 pl-11 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)]/50 focus:ring-1 focus:ring-[var(--coral)]/20 transition-all"
          />
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {loading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search Results */}
        {hasSearched && searchResults.length > 0 && (
          <div className="space-y-3">
            <p className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-4">
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </p>
            {searchResults.map((profile) => (
              <div
                key={profile.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-[var(--twilight)] card-event-hover"
                style={{ backgroundColor: "var(--card-bg)" }}
              >
                <Link href={`/profile/${profile.username}`}>
                  {profile.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={profile.display_name || profile.username}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] font-bold text-lg">
                      {getInitials(profile.display_name, profile.username)}
                    </div>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/profile/${profile.username}`}
                    className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors block truncate"
                  >
                    {profile.display_name || `@${profile.username}`}
                  </Link>
                  <p className="text-sm text-[var(--muted)]">@{profile.username}</p>
                  {profile.bio && (
                    <p className="text-sm text-[var(--soft)] mt-1 line-clamp-1">{profile.bio}</p>
                  )}
                </div>

                {user && (
                  <div className="flex items-center gap-2">
                    <FriendButton
                      targetUserId={profile.id}
                      targetUsername={profile.username}
                      size="sm"
                    />
                    <FollowButton targetUserId={profile.id} size="sm" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty search result */}
        {hasSearched && searchResults.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h3 className="text-[var(--cream)] text-lg font-medium mb-2">No people found</h3>
            <p className="text-[var(--muted)] text-sm">
              Try a different search term
            </p>
          </div>
        )}

        {/* Initial state - no search yet */}
        {!hasSearched && (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[var(--twilight)] to-[var(--dusk)] flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-[var(--cream)] text-xl font-medium mb-2">Discover People</h3>
            <p className="text-[var(--muted)] text-sm mb-6 max-w-xs mx-auto">
              Search for friends and people with similar interests to see what events they are going to
            </p>

            {/* Quick links */}
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/friends"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors font-mono text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                My Friends
              </Link>
              <Link
                href="/community"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--cream)] hover:bg-[var(--twilight)] transition-colors font-mono text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Organizers
              </Link>
            </div>
          </div>
        )}
      </main>

      <PageFooter />
    </div>
  );
}
