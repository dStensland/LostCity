"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDistanceToNow } from "date-fns";

type ActivityType = "rsvp" | "recommendation" | "follow";

type ActivityItem = {
  id: string;
  activity_type: ActivityType;
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
    start_date: string;
    venue?: { name: string } | null;
  } | null;
  venue?: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
  target_user?: {
    id: string;
    username: string;
    display_name: string | null;
  } | null;
  metadata?: {
    status?: string;
    note?: string;
  };
};

type ActivityFeedProps = {
  limit?: number;
  className?: string;
};

export default function ActivityFeed({ limit = 20, className = "" }: ActivityFeedProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

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

        const followedIds = follows
          .map((f) => f.followed_user_id)
          .filter(Boolean) as string[];

        // Get activities from followed users
        const { data: activityData } = await supabase
          .from("activities")
          .select(`
            id,
            activity_type,
            created_at,
            metadata,
            user:profiles!activities_user_id_fkey(
              id, username, display_name, avatar_url
            ),
            event:events(
              id, title, start_date,
              venue:venues(name)
            ),
            venue:venues(id, name, neighborhood),
            target_user:profiles!activities_target_user_id_fkey(
              id, username, display_name
            )
          `)
          .in("user_id", followedIds)
          .in("visibility", ["public", "friends"])
          .order("created_at", { ascending: false })
          .limit(limit);

        if (!isMounted) return;

        type ActivityQueryResult = {
          id: string;
          activity_type: string;
          created_at: string;
          metadata: Record<string, unknown> | null;
          user: ActivityItem["user"] | null;
          event: ActivityItem["event"] | null;
          venue: ActivityItem["venue"] | null;
          target_user: ActivityItem["target_user"] | null;
        };

        const rawActivities = activityData as ActivityQueryResult[] | null;
        if (!rawActivities) {
          setLoading(false);
          return;
        }

        // Filter out activities where user data is missing and transform
        const validActivities: ActivityItem[] = rawActivities
          .filter((a) => a.user !== null)
          .map((a) => ({
            id: a.id,
            activity_type: a.activity_type as ActivityType,
            created_at: a.created_at,
            user: a.user!,
            event: a.event,
            venue: a.venue,
            target_user: a.target_user,
            metadata: a.metadata as ActivityItem["metadata"],
          }));

        setActivities(validActivities);
        setLoading(false);
      } catch (error) {
        console.error("Failed to load activity feed:", error);
        if (isMounted) setLoading(false);
      }
    }

    loadFeed();

    return () => {
      isMounted = false;
    };
  }, [user, supabase, limit]);

  if (loading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg animate-pulse"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--twilight)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-[var(--twilight)] rounded w-3/4" />
                <div className="h-3 bg-[var(--twilight)] rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center ${className}`}>
        <p className="text-[var(--muted)] font-mono text-sm">
          Sign in to see activity from people you follow
        </p>
        <Link
          href="/auth/login"
          className="inline-block mt-3 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center ${className}`}>
        <p className="text-[var(--soft)] font-mono text-sm">No recent activity</p>
        <p className="text-[var(--muted)] font-mono text-xs mt-1">
          Follow more people to see their activity here
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

function ActivityCard({ activity }: { activity: ActivityItem }) {
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

  return (
    <div className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Link
          href={`/profile/${activity.user.username}`}
          className="flex-shrink-0"
        >
          {activity.user.avatar_url ? (
            <img
              src={activity.user.avatar_url}
              alt={activity.user.display_name || activity.user.username}
              className="w-10 h-10 rounded-full object-cover border border-[var(--twilight)] hover:border-[var(--coral)] transition-colors"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[var(--coral)] flex items-center justify-center border border-[var(--twilight)] hover:border-[var(--rose)] transition-colors">
              <span className="font-mono text-sm font-bold text-[var(--void)]">
                {activity.user.display_name
                  ? activity.user.display_name[0].toUpperCase()
                  : activity.user.username[0].toUpperCase()}
              </span>
            </div>
          )}
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--soft)]">
            <Link
              href={`/profile/${activity.user.username}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
            >
              {activity.user.display_name || activity.user.username}
            </Link>
            {" "}
            <ActivityText activity={activity} />
          </p>

          {/* Note for recommendations */}
          {activity.activity_type === "recommendation" && activity.metadata?.note && (
            <p className="mt-2 text-sm text-[var(--muted)] italic">
              &ldquo;{activity.metadata.note}&rdquo;
            </p>
          )}

          {/* Timestamp */}
          <p className="mt-1 font-mono text-[0.65rem] text-[var(--muted)]">
            {timeAgo}
          </p>
        </div>

        {/* Activity icon */}
        <div className="flex-shrink-0">
          <ActivityIcon type={activity.activity_type} status={activity.metadata?.status} />
        </div>
      </div>
    </div>
  );
}

function ActivityText({ activity }: { activity: ActivityItem }) {
  switch (activity.activity_type) {
    case "rsvp":
      const status = activity.metadata?.status || "going";
      const statusText = status === "going" ? "is going to" : status === "interested" ? "is interested in" : "went to";
      return (
        <>
          {statusText}{" "}
          {activity.event ? (
            <Link
              href={`/events/${activity.event.id}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
            >
              {activity.event.title}
            </Link>
          ) : (
            <span className="text-[var(--muted)]">an event</span>
          )}
        </>
      );

    case "recommendation":
      return (
        <>
          recommended{" "}
          {activity.event ? (
            <Link
              href={`/events/${activity.event.id}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
            >
              {activity.event.title}
            </Link>
          ) : activity.venue ? (
            <Link
              href={`/spots/${activity.venue.id}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
            >
              {activity.venue.name}
            </Link>
          ) : (
            <span className="text-[var(--muted)]">something</span>
          )}
        </>
      );

    case "follow":
      return (
        <>
          started following{" "}
          {activity.target_user ? (
            <Link
              href={`/profile/${activity.target_user.username}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
            >
              {activity.target_user.display_name || activity.target_user.username}
            </Link>
          ) : activity.venue ? (
            <Link
              href={`/spots/${activity.venue.id}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
            >
              {activity.venue.name}
            </Link>
          ) : (
            <span className="text-[var(--muted)]">someone</span>
          )}
        </>
      );

    default:
      return null;
  }
}

function ActivityIcon({ type, status }: { type: ActivityType; status?: string }) {
  const iconClasses = "w-5 h-5";

  switch (type) {
    case "rsvp":
      if (status === "interested") {
        return (
          <div className="p-1.5 rounded-full bg-[var(--gold)]/20">
            <svg className={`${iconClasses} text-[var(--gold)]`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
        );
      }
      return (
        <div className="p-1.5 rounded-full bg-[var(--coral)]/20">
          <svg className={`${iconClasses} text-[var(--coral)]`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );

    case "recommendation":
      return (
        <div className="p-1.5 rounded-full bg-[var(--rose)]/20">
          <svg className={`${iconClasses} text-[var(--rose)]`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
      );

    case "follow":
      return (
        <div className="p-1.5 rounded-full bg-[var(--lavender)]/20">
          <svg className={`${iconClasses} text-[var(--lavender)]`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </div>
      );

    default:
      return null;
  }
}
