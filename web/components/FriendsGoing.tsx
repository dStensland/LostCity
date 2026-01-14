"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

type FriendsGoingProps = {
  eventId: number;
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

export default function FriendsGoing({ eventId, className = "" }: FriendsGoingProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const [friends, setFriends] = useState<FriendRSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

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
      if (!rsvps) {
        setLoading(false);
        return;
      }

      // Filter to only mutual follows (friends)
      const friendRsvps: FriendRSVP[] = [];

      for (const rsvp of rsvps) {
        const rsvpUser = rsvp.user;
        if (!rsvpUser) continue;

        // Check if they follow back (mutual follow = friend)
        const { data: followsBack } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", rsvpUser.id)
          .eq("followed_user_id", user.id)
          .single();

        if (followsBack) {
          friendRsvps.push({
            user: rsvpUser,
            status: rsvp.status,
          });
        }
      }

      setFriends(friendRsvps);
      setTotalCount(friendRsvps.length);
      setLoading(false);
    }

    loadFriendsGoing();
  }, [user, eventId, supabase]);

  if (loading || friends.length === 0) {
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
              <img
                src={friend.user.avatar_url}
                alt={friend.user.display_name || friend.user.username}
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
