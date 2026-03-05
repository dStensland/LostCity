"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import UserAvatar from "@/components/UserAvatar";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";
import { useInfiniteActivities } from "@/lib/hooks/useInfiniteActivities";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { FriendOnboarding } from "@/components/community/FriendOnboarding";
import { ActivityEventCard } from "@/components/community/ActivityEventCard";

export type ActivityItem = {
  id: string;
  activity_type: "rsvp" | "follow" | "save";
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
    start_time: string | null;
    is_all_day: boolean;
    category: string | null;
    image_url: string | null;
    venue?: { name: string } | null;
  } | null;
  venue?: {
    id: number;
    name: string;
    slug: string | null;
    neighborhood: string | null;
  } | null;
  organization?: {
    id: number;
    name: string;
    slug: string | null;
  } | null;
  metadata?: {
    status?: string;
  };
};

export type GroupedActivity = {
  event: ActivityItem["event"];
  activities: ActivityItem[];
  users: ActivityItem["user"][];
};

export function FriendsActivity() {
  const {
    activities,
    isLoading,
    isFetchingNextPage,
    hasMore,
    loadMore
  } = useInfiniteActivities({ limit: 30 });

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" }
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, loadMore]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (activities.length === 0) {
    return <EmptyState />;
  }

  // Group activities by time period
  const groupedByTime = groupActivitiesByTime(activities);

  return (
    <div className="space-y-6">
      {groupedByTime.today.length > 0 && (
        <TimeSection
          title="Today"
          activities={groupedByTime.today}
          accentColor="var(--coral)"
        />
      )}

      {groupedByTime.yesterday.length > 0 && (
        <TimeSection
          title="Yesterday"
          activities={groupedByTime.yesterday}
          accentColor="var(--neon-magenta)"
        />
      )}

      {groupedByTime.thisWeek.length > 0 && (
        <TimeSection
          title="This Week"
          activities={groupedByTime.thisWeek}
          accentColor="var(--neon-cyan)"
        />
      )}

      {groupedByTime.older.length > 0 && (
        <TimeSection
          title="Earlier"
          activities={groupedByTime.older}
          accentColor="var(--muted)"
        />
      )}

      {hasMore && (
        <div ref={loadMoreRef} className="py-4">
          {isFetchingNextPage && <LoadingSkeleton count={3} />}
        </div>
      )}

      {!hasMore && activities.length > 0 && (
        <div className="text-center py-4">
          <p className="font-mono text-xs text-[var(--muted)]">
            You&apos;ve reached the end of your feed
          </p>
        </div>
      )}
    </div>
  );
}

function groupActivitiesByTime(activities: ActivityItem[]) {
  const today: ActivityItem[] = [];
  const yesterday: ActivityItem[] = [];
  const thisWeek: ActivityItem[] = [];
  const older: ActivityItem[] = [];

  activities.forEach((activity) => {
    const activityDate = new Date(activity.created_at);

    if (isToday(activityDate)) {
      today.push(activity);
    } else if (isYesterday(activityDate)) {
      yesterday.push(activity);
    } else if (isThisWeek(activityDate, { weekStartsOn: 0 })) {
      thisWeek.push(activity);
    } else {
      older.push(activity);
    }
  });

  return { today, yesterday, thisWeek, older };
}

interface TimeSectionProps {
  title: string;
  activities: ActivityItem[];
  accentColor: string;
}

function TimeSection({ title, activities, accentColor }: TimeSectionProps) {
  const accentClass = createCssVarClass("--accent-color", accentColor, "accent");

  // Group RSVP activities by event for display
  const groupedRsvps = activities.reduce<GroupedActivity[]>((acc, activity) => {
    if (activity.activity_type === "rsvp" && activity.event) {
      const existing = acc.find((g) => g.event?.id === activity.event?.id);
      if (existing) {
        existing.activities.push(activity);
        if (!existing.users.find((u) => u.id === activity.user.id)) {
          existing.users.push(activity.user);
        }
      } else {
        acc.push({
          event: activity.event,
          activities: [activity],
          users: [activity.user],
        });
      }
    }
    return acc;
  }, []);

  // Non-RSVP activities (follows, saves)
  const otherActivities = activities.filter(
    (a) => a.activity_type !== "rsvp" || !a.event
  );

  return (
    <div className={`space-y-3 ${accentClass?.className ?? ""}`}>
      <ScopedStyles css={accentClass?.css} />
      <div className="flex items-center gap-3">
        <div className="w-1 h-4 rounded-full bg-accent" />
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-accent-glow">
          {title}
        </h3>
        <div className="flex-1 h-px divider-accent" />
        <span className="font-mono text-xs px-2 py-0.5 rounded-full badge-accent">
          {activities.length}
        </span>
      </div>

      {/* Grouped RSVP events */}
      {groupedRsvps.map((group) => (
        <ActivityEventCard
          key={group.event!.id}
          event={group.event!}
          users={group.users}
          activityType="rsvp"
        />
      ))}

      {/* Individual activities */}
      {otherActivities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

function EmptyState() {
  return <FriendOnboarding />;
}

function LoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 skeleton-shimmer rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 skeleton-shimmer rounded w-3/4" />
              <div className="h-3 skeleton-shimmer rounded w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityCard({ activity }: { activity: ActivityItem }) {
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

  // Render saved/RSVP event activity via shared card
  if ((activity.activity_type === "save" || activity.activity_type === "rsvp") && activity.event) {
    return (
      <ActivityEventCard
        event={activity.event}
        users={[activity.user]}
        activityType={activity.activity_type}
        timeAgo={timeAgo}
      />
    );
  }

  // Render venue follow activity
  if (activity.activity_type === "follow" && activity.venue?.slug) {
    return (
      <Link
        href={`/spots/${activity.venue.slug}`}
        className="block p-3 rounded-lg glass border border-[var(--twilight)]/50 hover:border-[var(--coral)]/30 transition-all group relative"
      >
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl hover-glow-coral" />
        <div className="flex flex-wrap items-center gap-2 mb-2 relative z-10">
          <UserAvatar
            src={activity.user.avatar_url}
            name={activity.user.display_name || activity.user.username}
            size="xs"
          />
          <span className="text-xs text-[var(--muted)] flex-1 min-w-0">
            <span className="text-[var(--soft)]">
              {activity.user.display_name || activity.user.username}
            </span>
            {" "}now follows
          </span>
          <span className="font-mono text-2xs text-[var(--muted)] flex-shrink-0">
            {timeAgo}
          </span>
        </div>
        <div className="relative z-10">
          <h4 className="font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors truncate">
            {activity.venue.name}
          </h4>
          {activity.venue.neighborhood && (
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5 truncate">
              {activity.venue.neighborhood}
            </p>
          )}
        </div>
      </Link>
    );
  }

  // Render organization follow activity
  if (activity.activity_type === "follow" && activity.organization?.slug) {
    return (
      <Link
        href={`/orgs/${activity.organization.slug}`}
        className="block p-3 rounded-lg glass border border-[var(--twilight)]/50 hover:border-[var(--neon-cyan)]/30 transition-all group relative"
      >
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl hover-glow-cyan" />
        <div className="flex flex-wrap items-center gap-2 mb-2 relative z-10">
          <UserAvatar
            src={activity.user.avatar_url}
            name={activity.user.display_name || activity.user.username}
            size="xs"
          />
          <span className="text-xs text-[var(--muted)] flex-1 min-w-0">
            <span className="text-[var(--soft)]">
              {activity.user.display_name || activity.user.username}
            </span>
            {" "}now follows
          </span>
          <span className="font-mono text-2xs text-[var(--muted)] flex-shrink-0">
            {timeAgo}
          </span>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--twilight)] flex items-center justify-center">
            <svg className="w-4 h-4 text-[var(--neon-cyan)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-[var(--cream)] group-hover:text-[var(--neon-cyan)] transition-colors truncate">
              {activity.organization.name}
            </h4>
            <p className="font-mono text-xs text-[var(--muted)]">Organization</p>
          </div>
        </div>
      </Link>
    );
  }

  return null;
}
