"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import UserAvatar from "@/components/UserAvatar";

type Friend = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface PlanInviteSheetProps {
  planId: string;
  existingParticipantIds: string[];
  onInvite: (userIds: string[]) => void;
  onClose: () => void;
}

export function PlanInviteSheet({
  existingParticipantIds,
  onInvite,
  onClose,
}: PlanInviteSheetProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: friendsData } = useQuery<{ friends: Friend[] }>({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 60_000,
  });

  const friends = (friendsData?.friends || []).filter(
    (f) => !existingParticipantIds.includes(f.id)
  );

  const toggleFriend = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-[var(--dusk)] border border-[var(--twilight)] rounded-t-2xl sm:rounded-2xl max-h-[60vh] flex flex-col animate-fadeIn">
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--twilight)]" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
          <h3 className="font-mono text-sm font-semibold text-[var(--cream)]">
            Invite friends
          </h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--cream)] p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {friends.length === 0 ? (
            <p className="text-center font-mono text-sm text-[var(--muted)] py-8">
              All your friends are already invited!
            </p>
          ) : (
            friends.map((friend) => (
              <button
                key={friend.id}
                onClick={() => toggleFriend(friend.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  selectedIds.has(friend.id)
                    ? "bg-[var(--coral)]/10 border border-[var(--coral)]/30"
                    : "hover:bg-[var(--twilight)]/30 border border-transparent"
                }`}
              >
                <UserAvatar
                  src={friend.avatar_url}
                  name={friend.display_name || friend.username}
                  size="sm"
                />
                <span className="flex-1 text-left text-sm text-[var(--cream)]">
                  {friend.display_name || `@${friend.username}`}
                </span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedIds.has(friend.id)
                    ? "border-[var(--coral)] bg-[var(--coral)]"
                    : "border-[var(--twilight)]"
                }`}>
                  {selectedIds.has(friend.id) && (
                    <svg className="w-3 h-3 text-[var(--void)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-3 border-t border-[var(--twilight)]">
          <button
            onClick={() => onInvite(Array.from(selectedIds))}
            disabled={selectedIds.size === 0}
            className="w-full py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-xl font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50"
          >
            Invite {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
