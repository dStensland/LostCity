"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

type FriendsGoingProps = {
  eventId: number;
  fallbackCount?: number;
  className?: string;
};

type FriendRSVP = {
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  status: string;
};

export default function FriendsGoing({ eventId, fallbackCount = 0, className = "" }: FriendsGoingProps) {
  const { user } = useAuth();

  const [friends, setFriends] = useState<FriendRSVP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFriendsGoing() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Use the friends-going API endpoint which now uses the friendships table
        const res = await fetch(`/api/events/friends-going?event_ids=${eventId}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }

        const data = await res.json();
        const eventFriends = data.friends?.[eventId] || [];

        // Transform to match expected format
        const friendRsvps: FriendRSVP[] = eventFriends.map(
          (rsvp: { user: FriendRSVP["user"]; status: string }) => ({
            user: rsvp.user,
            status: rsvp.status,
          })
        );

        setFriends(friendRsvps);
      } catch (error) {
        console.error("Error loading friends going:", error);
      } finally {
        setLoading(false);
      }
    }

    loadFriendsGoing();
  }, [user, eventId]);

  // Show fallback count when no friends (or still loading without friends)
  if (loading) {
    return null; // Don't show anything while loading
  }

  if (friends.length === 0) {
    // No friends going - show fallback count if available
    if (fallbackCount > 0) {
      return (
        <span className={`flex items-center gap-1 text-xs text-[var(--muted)] ${className}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          {fallbackCount} interested
        </span>
      );
    }
    return null;
  }

  const goingFriends = friends.filter((f) => f.status === "going");
  const interestedFriends = friends.filter((f) => f.status === "interested");

  return (
    <div className={`flex items-center gap-2 ${className} animate-fade-in`}>
      {/* Avatars stack with staggered animation */}
      <div className="relative flex -space-x-2">
        {friends.length > 1 && (
          <div className="absolute -inset-1 bg-[var(--coral)]/10 rounded-full blur-sm animate-pulse-slow" />
        )}
        {friends.slice(0, 3).map((friend, idx) => (
          <Link
            key={friend.user.id}
            href={`/profile/${friend.user.username}`}
            className="relative block animate-scale-in"
            style={{
              animationDelay: `${idx * 100}ms`,
            }}
            title={friend.user.display_name || friend.user.username}
          >
            {friend.user.avatar_url ? (
              <Image
                src={friend.user.avatar_url}
                alt={friend.user.display_name || friend.user.username}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full object-cover border-2 border-[var(--night)] hover:border-[var(--coral)] hover:scale-110 transition-all duration-200"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[var(--coral)] flex items-center justify-center border-2 border-[var(--night)] hover:border-[var(--rose)] hover:scale-110 transition-all duration-200">
                <span className="font-mono text-[0.5rem] font-bold text-[var(--void)]">
                  {friend.user.display_name
                    ? friend.user.display_name[0].toUpperCase()
                    : friend.user.username[0].toUpperCase()}
                </span>
              </div>
            )}
          </Link>
        ))}
        {friends.length > 3 && (
          <div
            className="w-6 h-6 rounded-full bg-[var(--twilight)] flex items-center justify-center border-2 border-[var(--night)] animate-scale-in"
            style={{
              animationDelay: "300ms",
            }}
          >
            <span className="font-mono text-[0.5rem] font-medium text-[var(--muted)]">
              +{friends.length - 3}
            </span>
          </div>
        )}
      </div>

      {/* Text with fade-in animation */}
      <span className="font-mono text-xs text-[var(--muted)] animate-fade-in" style={{ animationDelay: "200ms" }}>
        {goingFriends.length > 0 && (
          <>
            <span className="text-[var(--coral)] font-bold">{goingFriends.length}</span>
            {" "}friend{goingFriends.length !== 1 ? "s" : ""} going
          </>
        )}
        {goingFriends.length > 0 && interestedFriends.length > 0 && " · "}
        {interestedFriends.length > 0 && (
          <>
            <span className="text-[var(--gold)] font-bold">{interestedFriends.length}</span>
            {" "}interested
          </>
        )}
      </span>
    </div>
  );
}
