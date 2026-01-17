"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
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
  const supabase = createClient();

  const [friends, setFriends] = useState<FriendRSVP[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFriendsGoing() {
      if (!user) {
        setLoading(false);
        return;
      }

      // First get mutual follows (friends)
      const { data: myFollows } = await supabase
        .from("follows")
        .select("followed_user_id")
        .eq("follower_id", user.id)
        .not("followed_user_id", "is", null);

      const followsData = myFollows as { followed_user_id: string | null }[] | null;
      if (!followsData || followsData.length === 0) {
        setLoading(false);
        return;
      }

      const followedIds = followsData.map((f) => f.followed_user_id).filter(Boolean) as string[];

      // Get RSVPs from followed users who also follow back (mutual = friends)
      // and who have visibility set to 'public' or 'friends'
      const { data: rsvpData } = await supabase
        .from("event_rsvps")
        .select(`
          status,
          visibility,
          user:profiles!event_rsvps_user_id_fkey(
            id, username, display_name, avatar_url
          )
        `)
        .eq("event_id", eventId)
        .in("user_id", followedIds)
        .in("visibility", ["public", "friends"])
        .in("status", ["going", "interested"]);

      type RSVPQueryResult = {
        status: string;
        visibility: string;
        user: FriendRSVP["user"] | null;
      };

      const rsvps = rsvpData as RSVPQueryResult[] | null;
      if (!rsvps || rsvps.length === 0) {
        setLoading(false);
        return;
      }

      // Get user IDs from RSVPs to check mutual follows in batch
      const rsvpUserIds = rsvps
        .map((r) => r.user?.id)
        .filter((id): id is string => !!id);

      if (rsvpUserIds.length === 0) {
        setLoading(false);
        return;
      }

      // Batch query: get all users from RSVPs who follow back (mutual = friends)
      const { data: mutualFollows } = await supabase
        .from("follows")
        .select("follower_id")
        .in("follower_id", rsvpUserIds)
        .eq("followed_user_id", user.id);

      const mutualFollowData = mutualFollows as { follower_id: string }[] | null;
      const mutualFollowerIds = new Set(mutualFollowData?.map((f) => f.follower_id) || []);

      // Filter RSVPs to only mutual follows (friends)
      const friendRsvps: FriendRSVP[] = rsvps
        .filter((rsvp) => rsvp.user && mutualFollowerIds.has(rsvp.user.id))
        .map((rsvp) => ({
          user: rsvp.user!,
          status: rsvp.status,
        }));

      setFriends(friendRsvps);
      setLoading(false);
    }

    loadFriendsGoing();
  }, [user, eventId, supabase]);

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
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Avatars stack */}
      <div className="flex -space-x-2">
        {friends.slice(0, 3).map((friend) => (
          <Link
            key={friend.user.id}
            href={`/profile/${friend.user.username}`}
            className="relative block"
            title={friend.user.display_name || friend.user.username}
          >
            {friend.user.avatar_url ? (
              <Image
                src={friend.user.avatar_url}
                alt={friend.user.display_name || friend.user.username}
                width={24}
                height={24}
                className="w-6 h-6 rounded-full object-cover border-2 border-[var(--night)] hover:border-[var(--coral)] transition-colors"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[var(--coral)] flex items-center justify-center border-2 border-[var(--night)] hover:border-[var(--rose)] transition-colors">
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
          <div className="w-6 h-6 rounded-full bg-[var(--twilight)] flex items-center justify-center border-2 border-[var(--night)]">
            <span className="font-mono text-[0.5rem] font-medium text-[var(--muted)]">
              +{friends.length - 3}
            </span>
          </div>
        )}
      </div>

      {/* Text */}
      <span className="font-mono text-xs text-[var(--muted)]">
        {goingFriends.length > 0 && (
          <>
            <span className="text-[var(--coral)]">{goingFriends.length}</span>
            {" "}friend{goingFriends.length !== 1 ? "s" : ""} going
          </>
        )}
        {goingFriends.length > 0 && interestedFriends.length > 0 && " · "}
        {interestedFriends.length > 0 && (
          <>
            <span className="text-[var(--gold)]">{interestedFriends.length}</span>
            {" "}interested
          </>
        )}
      </span>
    </div>
  );
}
