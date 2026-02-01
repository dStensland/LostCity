"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePortal } from "@/lib/portal-context";
import { formatDistanceToNow } from "date-fns";

// Timeout constant for Supabase queries to prevent indefinite hanging
const QUERY_TIMEOUT = 8000;

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
    slug: string;
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
  const { portal } = usePortal();
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
        // Get users we follow - with timeout protection
        const followsQuery = supabase
          .from("follows")
          .select("followed_user_id")
          .eq("follower_id", user.id)
          .not("followed_user_id", "is", null);

        const { data: followsData } = await Promise.race([
          followsQuery,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT)
          ),
        ]);

        if (!isMounted) return;

        const follows = followsData as { followed_user_id: string | null }[] | null;
        if (!follows || follows.length === 0) {
          setLoading(false);
          return;
        }

        const followedIds = follows
          .map((f) => f.followed_user_id)
          .filter(Boolean) as string[];

        // Get activities from followed users - with timeout protection
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

        const activitiesQuery = supabase
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
            venue:venues(id, name, slug, neighborhood),
            target_user:profiles!activities_target_user_id_fkey(
              id, username, display_name
            )
          `)
          .in("user_id", followedIds)
          .in("visibility", ["public", "friends"])
          .order("created_at", { ascending: false })
          .limit(limit);

        const { data: activityData } = await Promise.race([
          activitiesQuery,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT)
          ),
        ]);

        if (!isMounted) return;

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
      <div className={`p-8 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)] border border-[var(--twilight)] rounded-xl text-center ${className}`}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[var(--lavender)]/20 to-[var(--coral)]/10 flex items-center justify-center animate-float">
          <svg className="w-8 h-8 text-[var(--lavender)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <h3 className="text-[var(--cream)] text-lg font-medium mb-2">
          Your people are out there
        </h3>
        <p className="text-[var(--muted)] font-mono text-sm mb-5 max-w-sm mx-auto">
          See what they&apos;re up to and never miss the vibes. Connect with your crew and discover together.
        </p>
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium rounded-lg hover:bg-[var(--rose)] transition-all hover:scale-105 shadow-lg shadow-[var(--coral)]/20"
        >
          Sign In
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={`p-8 bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl text-center ${className}`}>
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[var(--twilight)]/50 flex items-center justify-center animate-pulse-slow">
          <svg className="w-7 h-7 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h3 className="text-[var(--soft)] text-base font-medium mb-2">
          Quiet around here
        </h3>
        <p className="text-[var(--muted)] font-mono text-sm max-w-xs mx-auto">
          Follow more people to see their RSVPs, recommendations, and plans
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {activities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} portalSlug={portal?.slug} />
      ))}
    </div>
  );
}

function ActivityCard({ activity, portalSlug }: { activity: ActivityItem; portalSlug?: string }) {
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
            <Image
              src={activity.user.avatar_url}
              alt={activity.user.display_name || activity.user.username}
              width={40}
              height={40}
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
            <ActivityText activity={activity} portalSlug={portalSlug} />
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

function ActivityText({ activity, portalSlug }: { activity: ActivityItem; portalSlug?: string }) {
  switch (activity.activity_type) {
    case "rsvp":
      const status = activity.metadata?.status || "going";
      const statusText = status === "going" ? "is going to" : status === "interested" ? "is interested in" : "went to";
      return (
        <>
          {statusText}{" "}
          {activity.event ? (
            <Link
              href={portalSlug ? `/${portalSlug}?event=${activity.event.id}` : `/events/${activity.event.id}`}
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
              href={portalSlug ? `/${portalSlug}?event=${activity.event.id}` : `/events/${activity.event.id}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors"
            >
              {activity.event.title}
            </Link>
          ) : activity.venue ? (
            <Link
              href={portalSlug ? `/${portalSlug}?spot=${activity.venue.slug}` : `/spots/${activity.venue.slug}`}
              scroll={false}
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
              href={portalSlug ? `/${portalSlug}?spot=${activity.venue.slug}` : `/spots/${activity.venue.slug}`}
              scroll={false}
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
