"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

type Friend = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type SentInvite = {
  invitee_id: string;
  status: string;
};

interface EventInviteButtonProps {
  eventId: number;
  className?: string;
}

export default function EventInviteButton({ eventId, className = "" }: EventInviteButtonProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sentInvites, setSentInvites] = useState<SentInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedFriend(null);
        setNote("");
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Fetch friends and sent invites when dropdown opens
  useEffect(() => {
    if (isOpen && user) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [friendsRes, invitesRes] = await Promise.all([
        fetch("/api/friends"),
        fetch(`/api/invites?type=sent`),
      ]);

      if (friendsRes.ok) {
        const data = await friendsRes.json();
        setFriends(data.friends || []);
      }

      if (invitesRes.ok) {
        const data = await invitesRes.json();
        // Filter to only invites for this event
        const eventInvites = (data.invites || [])
          .filter((i: { event?: { id: number } }) => i.event?.id === eventId)
          .map((i: { invitee?: { id: string }; status: string }) => ({
            invitee_id: i.invitee?.id,
            status: i.status,
          }));
        setSentInvites(eventInvites);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (friendId: string) => {
    setSending(friendId);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          inviteeId: friendId,
          note: note.trim() || undefined,
        }),
      });

      if (res.ok) {
        showToast("Invite sent!");
        setSentInvites((prev) => [...prev, { invitee_id: friendId, status: "pending" }]);
        setSelectedFriend(null);
        setNote("");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to send invite", "error");
      }
    } catch {
      showToast("Failed to send invite", "error");
    } finally {
      setSending(null);
    }
  };

  const getInviteStatus = (friendId: string) => {
    const invite = sentInvites.find((i) => i.invitee_id === friendId);
    return invite?.status;
  };

  if (!user) return null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-2 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-xs hover:bg-[var(--twilight)]/80 transition-colors min-h-[40px]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        Invite
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-[var(--twilight)]">
            <h3 className="font-mono text-xs text-[var(--cream)] font-medium">
              Invite Friends
            </h3>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full skeleton-shimmer" />
                  <div className="h-4 skeleton-shimmer rounded flex-1" />
                </div>
              ))}
            </div>
          ) : friends.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-[var(--muted)] text-sm">No friends yet</p>
              <p className="text-[var(--muted)] text-xs mt-1">
                Add friends to invite them to events
              </p>
            </div>
          ) : selectedFriend ? (
            // Note input view
            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => {
                    setSelectedFriend(null);
                    setNote("");
                  }}
                  className="text-[var(--muted)] hover:text-[var(--cream)]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  {selectedFriend.avatar_url ? (
                    <Image
                      src={selectedFriend.avatar_url}
                      alt={selectedFriend.display_name || selectedFriend.username}
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] text-[10px] font-bold">
                      {(selectedFriend.display_name || selectedFriend.username).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-[var(--cream)]">
                    {selectedFriend.display_name || `@${selectedFriend.username}`}
                  </span>
                </div>
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)"
                className="w-full px-3 py-2 bg-[var(--night)] border border-[var(--twilight)] rounded-lg text-sm text-[var(--cream)] placeholder-[var(--muted)] resize-none focus:outline-none focus:border-[var(--coral)]"
                rows={3}
                maxLength={200}
              />

              <button
                onClick={() => handleSendInvite(selectedFriend.id)}
                disabled={sending === selectedFriend.id}
                className="w-full mt-3 px-4 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors disabled:opacity-50 min-h-[40px]"
              >
                {sending === selectedFriend.id ? "Sending..." : "Send Invite"}
              </button>
            </div>
          ) : (
            // Friends list view
            <div className="max-h-64 overflow-y-auto">
              {friends.map((friend) => {
                const status = getInviteStatus(friend.id);
                const isInvited = !!status;

                return (
                  <button
                    key={friend.id}
                    onClick={() => !isInvited && setSelectedFriend(friend)}
                    disabled={isInvited}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isInvited
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-[var(--twilight)]/30"
                    }`}
                  >
                    {friend.avatar_url ? (
                      <Image
                        src={friend.avatar_url}
                        alt={friend.display_name || friend.username}
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] text-xs font-bold">
                        {(friend.display_name || friend.username).charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <span className="block text-sm text-[var(--cream)] truncate">
                        {friend.display_name || `@${friend.username}`}
                      </span>
                    </div>

                    {isInvited ? (
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        status === "accepted"
                          ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)]"
                          : status === "declined"
                          ? "bg-[var(--muted)]/20 text-[var(--muted)]"
                          : "bg-[var(--twilight)] text-[var(--muted)]"
                      }`}>
                        {status === "accepted" ? "Going" : status === "declined" ? "Declined" : "Invited"}
                      </span>
                    ) : (
                      <svg
                        className="w-4 h-4 text-[var(--muted)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
