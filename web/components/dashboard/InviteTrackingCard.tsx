"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";

type InviteStats = {
  emailsSent: number;
  requestsSent: number;
  friendsMade: number;
  recentJoiners: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  }[];
};

export default function InviteTrackingCard() {
  const { data, isLoading } = useQuery<InviteStats>({
    queryKey: ["invite-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/invite-stats");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 300_000, // 5min
    refetchOnWindowFocus: false,
  });

  if (isLoading) return null;

  // Don't show if user has never invited anyone
  if (!data || (data.emailsSent === 0 && data.requestsSent === 0)) {
    return null;
  }

  const totalInvited = data.emailsSent + data.requestsSent;

  return (
    <div className="glass border border-[var(--twilight)] rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[var(--neon-green)]/15 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[var(--neon-green)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-[var(--cream)]">
              You&apos;ve invited <span className="font-medium text-[var(--neon-green)]">{totalInvited}</span> {totalInvited === 1 ? "person" : "people"}
              {data.friendsMade > 0 && (
                <> · <span className="text-[var(--coral)]">{data.friendsMade}</span> {data.friendsMade === 1 ? "is" : "are"} here now</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Recent joiners */}
      {data.recentJoiners.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--twilight)]">
          <div className="flex -space-x-2">
            {data.recentJoiners.map((joiner) => (
              <UserAvatar
                key={joiner.username}
                src={joiner.avatar_url}
                name={joiner.display_name || joiner.username}
                size="xs"
              />
            ))}
          </div>
          <p className="font-mono text-xs text-[var(--muted)]">
            {data.recentJoiners[0].display_name || data.recentJoiners[0].username} just joined!
          </p>
        </div>
      )}

      {/* Invite more CTA */}
      <Link
        href="/find-friends?tab=invite"
        className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-[var(--twilight)]/50 text-[var(--soft)] font-mono text-xs hover:bg-[var(--twilight)] hover:text-[var(--cream)] transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        Invite more
      </Link>
    </div>
  );
}
