"use client";

import { useState } from "react";
import Link from "next/link";
import { FriendSuggestions } from "@/components/community/FriendSuggestions";
import { FriendSearch } from "@/components/community/FriendSearch";
import { useFriendSuggestions } from "@/lib/hooks/useFriendSuggestions";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

export function FriendOnboarding() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { suggestions, isLoading: suggestionsLoading } = useFriendSuggestions();
  const [showSearch, setShowSearch] = useState(false);

  const handleCopyInvite = async () => {
    if (!profile?.username) return;
    const url = `${window.location.origin}/invite/${profile.username}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Invite link copied!", "success");
    } catch {
      showToast("Failed to copy link", "error");
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <div className="relative glass border border-[var(--coral)]/20 rounded-xl p-6 text-center overflow-hidden animate-stagger-1">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--coral)]/5 via-transparent to-[var(--neon-magenta)]/5 pointer-events-none" />

        <div className="relative z-10">
          {/* People illustration */}
          <div className="mb-4 flex justify-center">
            <div className="relative">
              <div className="flex -space-x-3">
                {["var(--coral)", "var(--neon-magenta)", "var(--neon-cyan)"].map((color, i) => (
                  <div
                    key={i}
                    className="w-12 h-12 rounded-full border-2 border-[var(--dusk)] flex items-center justify-center"
                    style={{ backgroundColor: `color-mix(in srgb, ${color} 30%, transparent)` }}
                  >
                    <svg className="w-6 h-6" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                ))}
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-transparent via-[var(--coral)] to-transparent" />
            </div>
          </div>

          <h3 className="text-lg font-semibold text-[var(--cream)] mb-1.5">
            Find your crew
          </h3>
          <p className="font-mono text-sm text-[var(--muted)] max-w-xs mx-auto">
            Atlanta&apos;s better with friends. See where your people are going and never miss the moment.
          </p>
        </div>
      </div>

      {/* Suggestions card */}
      {(suggestions.length > 0 || suggestionsLoading) && (
        <div className="animate-stagger-2">
          <FriendSuggestions suggestions={suggestions} isLoading={suggestionsLoading} />
        </div>
      )}

      {/* Quick actions card */}
      <div className="glass border border-[var(--twilight)] rounded-xl p-4 animate-stagger-3">
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[var(--twilight)]/30 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--coral)]/15 flex items-center justify-center group-hover:bg-[var(--coral)]/25 transition-colors">
              <svg className="w-5 h-5 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="font-mono text-[0.6rem] text-[var(--muted)] text-center leading-tight">
              Search by name
            </span>
          </button>

          <Link
            href="/find-friends?tab=import"
            className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[var(--twilight)]/30 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--neon-cyan)]/15 flex items-center justify-center group-hover:bg-[var(--neon-cyan)]/25 transition-colors">
              <svg className="w-5 h-5 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="font-mono text-[0.6rem] text-[var(--muted)] text-center leading-tight">
              Import contacts
            </span>
          </Link>

          <button
            onClick={handleCopyInvite}
            className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[var(--twilight)]/30 transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--neon-magenta)]/15 flex items-center justify-center group-hover:bg-[var(--neon-magenta)]/25 transition-colors">
              <svg className="w-5 h-5 text-[var(--neon-magenta)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <span className="font-mono text-[0.6rem] text-[var(--muted)] text-center leading-tight">
              Share invite
            </span>
          </button>
        </div>

        {/* Inline search (toggle) */}
        {showSearch && (
          <div className="mt-3 pt-3 border-t border-[var(--twilight)]">
            <FriendSearch />
          </div>
        )}
      </div>
    </div>
  );
}
