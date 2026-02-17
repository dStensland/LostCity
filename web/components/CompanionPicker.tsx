"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/components/Toast";

type Friend = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

interface CompanionPickerProps {
  eventId: number;
  onClose: () => void;
}

export function CompanionPicker({ eventId, onClose }: CompanionPickerProps) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Fetch friends
  const { data: friendsData } = useQuery<{ friends: Friend[] }>({
    queryKey: ["friends"],
    queryFn: async () => {
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 60_000,
  });

  // Fetch current companions
  const { data: companionsData } = useQuery<{ companions: Friend[] }>({
    queryKey: ["companions", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/rsvp/companions?event_id=${eventId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Track selections - will be synced from server data on first render
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSynced, setIsSynced] = useState(false);

  // Derive server state from companions data
  const serverIds = useMemo(
    () => new Set((companionsData?.companions || []).map((c) => c.id)),
    [companionsData]
  );

  // Sync local state with server state on first load (not in useEffect to avoid cascading)
  if (!isSynced && companionsData?.companions) {
    setSelectedIds(serverIds);
    setIsSynced(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/rsvp/companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, companion_ids: ids }),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companions", eventId] });
      showToast("Updated!", "success");
      onClose();
    },
    onError: () => {
      showToast("Failed to save", "error");
    },
  });

  const toggleFriend = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const friends = friendsData?.friends || [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-md bg-[var(--dusk)] border border-[var(--twilight)] rounded-t-2xl sm:rounded-2xl max-h-[70vh] flex flex-col animate-fadeIn">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--twilight)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
          <h3 className="font-mono text-sm font-semibold text-[var(--cream)]">
            Going with...
          </h3>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Friend list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {friends.length === 0 ? (
            <p className="text-center font-mono text-sm text-[var(--muted)] py-8">
              No friends yet
            </p>
          ) : (
            friends.map((friend) => {
              const isSelected = selectedIds.has(friend.id);
              return (
                <button
                  key={friend.id}
                  onClick={() => toggleFriend(friend.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                    isSelected
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
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? "border-[var(--coral)] bg-[var(--coral)]"
                      : "border-[var(--twilight)]"
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-[var(--void)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--twilight)]">
          <button
            onClick={() => saveMutation.mutate(Array.from(selectedIds))}
            disabled={saveMutation.isPending}
            className="w-full py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-xl font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-60"
          >
            {saveMutation.isPending ? "Saving..." : `Done${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
