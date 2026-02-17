"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/components/Toast";

type Friend = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface PostRsvpSharePromptProps {
  eventId: number;
  eventTitle: string;
  onDismiss: () => void;
}

export function PostRsvpSharePrompt({
  eventId,
  eventTitle,
  onDismiss,
}: PostRsvpSharePromptProps) {
  const { showToast } = useToast();
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [inviteCount, setInviteCount] = useState(0);

  // Check localStorage to avoid re-showing
  useEffect(() => {
    const key = `rsvp_share_dismissed_${eventId}`;
    if (localStorage.getItem(key)) {
      onDismiss();
    }
  }, [eventId, onDismiss]);

  // Auto-dismiss after 2 invites sent
  useEffect(() => {
    if (inviteCount >= 2) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [inviteCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: friendsData, isLoading } = useQuery<{ friends: Friend[] }>({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to fetch friends");
      return res.json();
    },
    staleTime: 60_000,
  });

  const friends = friendsData?.friends?.slice(0, 5) || [];

  const handleDismiss = () => {
    localStorage.setItem(`rsvp_share_dismissed_${eventId}`, "1");
    onDismiss();
  };

  const handleInvite = async (friendId: string) => {
    if (invitedIds.has(friendId) || sendingId) return;

    setSendingId(friendId);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, friend_id: friendId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send invite");
      }

      setInvitedIds((prev) => new Set(prev).add(friendId));
      setInviteCount((c) => c + 1);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Failed to invite",
        "error"
      );
    } finally {
      setSendingId(null);
    }
  };

  // Don't show if no friends or still loading
  if (isLoading || friends.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-fadeIn">
      <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl shadow-2xl p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-mono text-sm font-semibold text-[var(--cream)]">
              Bring your crew?
            </h3>
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5 line-clamp-1">
              Invite friends to {eventTitle}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-1"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Friend list */}
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {friends.map((friend) => {
            const isInvited = invitedIds.has(friend.id);
            const isSending = sendingId === friend.id;

            return (
              <div key={friend.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 w-16">
                <UserAvatar
                  src={friend.avatar_url}
                  name={friend.display_name || friend.username}
                  size="sm"
                />
                <span className="font-mono text-[0.6rem] text-[var(--muted)] truncate w-full text-center">
                  {friend.display_name?.split(" ")[0] || friend.username}
                </span>
                <button
                  onClick={() => handleInvite(friend.id)}
                  disabled={isInvited || isSending}
                  className={`px-2.5 py-1 rounded-full font-mono text-[0.6rem] font-medium transition-all ${
                    isInvited
                      ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)]"
                      : isSending
                        ? "bg-[var(--twilight)] text-[var(--muted)]"
                        : "bg-[var(--coral)]/15 text-[var(--coral)] hover:bg-[var(--coral)]/25"
                  }`}
                >
                  {isInvited ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isSending ? (
                    <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Invite"
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Skip button */}
        <button
          onClick={handleDismiss}
          className="w-full text-center font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors py-1 mt-1"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
