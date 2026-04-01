"use client";

import Link from "next/link";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { FriendSuggestions } from "@/components/community/FriendSuggestions";
import { useFriendSuggestions } from "@/lib/hooks/useFriendSuggestions";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

export default function FindFriendsSection() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { suggestions, isLoading: suggestionsLoading } = useFriendSuggestions();

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

  const actions = [
    {
      label: "Search",
      description: "Find friends on Lost City",
      href: "/find-friends",
      iconBg: "rgba(232,85,160,0.1)",
      iconColor: "var(--neon-magenta)",
      icon: "search" as const,
    },
    {
      label: "Contacts",
      description: "See who you know",
      href: "/find-friends?tab=import",
      iconBg: "rgba(167,139,250,0.1)",
      iconColor: "var(--vibe)",
      icon: "users" as const,
    },
    {
      label: "Invite",
      description: "Share your link",
      onClick: handleCopyInvite,
      iconBg: "rgba(0,212,232,0.1)",
      iconColor: "var(--neon-cyan)",
      icon: "share-2" as const,
    },
  ];

  return (
    <div className="space-y-3">
      <FeedSectionHeader
        title="Find Friends"
        priority="tertiary"
        accentColor="var(--neon-magenta)"
      />

      {/* Action cards — mobile: 3-col grid, desktop: row with descriptions */}
      <div className="grid grid-cols-3 sm:grid-cols-1 gap-2 sm:gap-2.5">
        {actions.map((action) => {
          const content = (
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 p-3 sm:px-4 sm:py-3.5 rounded-[10px] border border-[var(--twilight)] hover:bg-[var(--twilight)]/10 transition-colors">
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: action.iconBg }}
              >
                <svg className="w-[18px] h-[18px] sm:w-5 sm:h-5" style={{ color: action.iconColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {action.icon === "search" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
                  {action.icon === "users" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />}
                  {action.icon === "share-2" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />}
                </svg>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-mono text-xs text-[var(--muted)] sm:text-sm sm:font-medium sm:text-[var(--cream)] sm:font-sans">{action.label}</span>
                <p className="hidden sm:block text-xs text-[var(--muted)]">{action.description}</p>
              </div>
            </div>
          );

          if ("onClick" in action && action.onClick) {
            return <button key={action.label} onClick={action.onClick} className="text-left">{content}</button>;
          }
          return <Link key={action.label} href={(action as { href: string }).href}>{content}</Link>;
        })}
      </div>

      {/* Suggestions */}
      {(suggestions.length > 0 || suggestionsLoading) && (
        <FriendSuggestions suggestions={suggestions} isLoading={suggestionsLoading} />
      )}
    </div>
  );
}
