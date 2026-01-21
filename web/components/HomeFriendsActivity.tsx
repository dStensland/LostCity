"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePortal } from "@/lib/portal-context";
import { formatDistanceToNow } from "date-fns";

type ActivityItem = {
  id: string;
  activity_type: "rsvp" | "recommendation" | "follow";
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  event?: {
    id: number;
    title: string;
  } | null;
  target_user?: {
    username: string;
    display_name: string | null;
  } | null;
  metadata?: {
    status?: string;
  };
};

export default function HomeFriendsActivity() {
  const { user } = useAuth();
  const { portal } = usePortal();
  const supabase = createClient();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasFriends, setHasFriends] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadFeed() {
      if (!user) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        // Get users we follow
        const { data: followsData } = await supabase
          .from("follows")
          .select("followed_user_id")
          .eq("follower_id", user.id)
          .not("followed_user_id", "is", null);

        if (!isMounted) return;

        const follows = followsData as { followed_user_id: string | null }[] | null;
        if (!follows || follows.length === 0) {
          setLoading(false);
          return;
        }

        setHasFriends(true);
        const followedIds = follows
          .map((f) => f.followed_user_id)
          .filter((id): id is string => id !== null);

        // Fetch RSVPs from followed users (limit 5)
        const { data: rsvps } = await supabase
          .from("event_rsvps")
          .select(`
            id,
            status,
            created_at,
            user:profiles!event_rsvps_user_id_fkey(id, username, display_name, avatar_url),
            event:events(id, title)
          `)
          .in("user_id", followedIds)
          .order("created_at", { ascending: false })
          .limit(5);

        if (!isMounted) return;

        // Transform to activity items
        type RsvpRow = {
          id: string;
          status: string;
          created_at: string;
          user: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
          event: { id: number; title: string } | null;
        };

        const activityItems: ActivityItem[] = ((rsvps as RsvpRow[] | null) || [])
          .filter((r) => r.user && r.event)
          .map((r) => ({
            id: r.id,
            activity_type: "rsvp" as const,
            created_at: r.created_at,
            user: r.user!,
            event: r.event,
            metadata: { status: r.status },
          }));

        setActivities(activityItems);
      } catch (err) {
        console.error("Error loading friends activity:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadFeed();

    return () => {
      isMounted = false;
    };
  }, [user, supabase]);

  // Don't render anything if not logged in or no friends
  if (!user || loading) return null;
  if (!hasFriends || activities.length === 0) return null;

  return (
    <div className="mb-6 p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-xs font-medium text-[var(--muted)] uppercase tracking-wider">
          Friends Activity
        </h2>
        <Link
          href="/foryou"
          className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
        >
          See all
        </Link>
      </div>

      {/* Compact activity list */}
      <div className="space-y-2">
        {activities.slice(0, 4).map((activity) => (
          <div key={activity.id} className="flex items-center gap-2 text-sm">
            {/* Mini avatar */}
            <Link href={`/profile/${activity.user.username}`} className="flex-shrink-0">
              {activity.user.avatar_url ? (
                <Image
                  src={activity.user.avatar_url}
                  alt={`${activity.user.display_name || activity.user.username}'s profile photo`}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-[var(--coral)] flex items-center justify-center">
                  <span className="font-mono text-[0.6rem] font-bold text-[var(--void)]">
                    {(activity.user.display_name || activity.user.username)[0].toUpperCase()}
                  </span>
                </div>
              )}
            </Link>

            {/* Activity text */}
            <p className="flex-1 min-w-0 text-[var(--soft)] truncate">
              <Link
                href={`/profile/${activity.user.username}`}
                className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
              >
                {activity.user.display_name || activity.user.username}
              </Link>
              {" "}
              {activity.metadata?.status === "going" ? "is going to" : "is interested in"}
              {" "}
              {activity.event && (
                <Link
                  href={portal?.slug ? `/${portal.slug}/events/${activity.event.id}` : `/events/${activity.event.id}`}
                  className="text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
                >
                  {activity.event.title}
                </Link>
              )}
            </p>

            {/* Time */}
            <span className="flex-shrink-0 font-mono text-[0.6rem] text-[var(--muted)]">
              {formatDistanceToNow(new Date(activity.created_at), { addSuffix: false })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
