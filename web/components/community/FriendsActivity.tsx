"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import UserAvatar, { AvatarStack } from "@/components/UserAvatar";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import { formatDistanceToNow, format, parseISO, isToday, isYesterday, isThisWeek } from "date-fns";
import { useInfiniteActivities } from "@/lib/hooks/useInfiniteActivities";

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
      {/* Today's Activities */}
      {groupedByTime.today.length > 0 && (
        <TimeSection
          title="Today"
          activities={groupedByTime.today}
          accentColor="var(--coral)"
        />
      )}

      {/* Yesterday's Activities */}
      {groupedByTime.yesterday.length > 0 && (
        <TimeSection
          title="Yesterday"
          activities={groupedByTime.yesterday}
          accentColor="var(--neon-magenta)"
        />
      )}

      {/* This Week's Activities */}
      {groupedByTime.thisWeek.length > 0 && (
        <TimeSection
          title="This Week"
          activities={groupedByTime.thisWeek}
          accentColor="var(--neon-cyan)"
        />
      )}

      {/* Older Activities */}
      {groupedByTime.older.length > 0 && (
        <TimeSection
          title="Earlier"
          activities={groupedByTime.older}
          accentColor="var(--muted)"
        />
      )}

      {/* Intersection observer trigger */}
      {hasMore && (
        <div ref={loadMoreRef} className="py-4">
          {isFetchingNextPage && <LoadingSkeleton count={3} />}
        </div>
      )}

      {/* End of list indicator */}
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
  // Group RSVP activities by event for display
  const localGroupedActivities = activities.reduce<GroupedActivity[]>((acc, activity) => {
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

  // Non-event activities (follows, saves)
  const otherActivities = activities.filter(
    (a) => a.activity_type !== "rsvp" || !a.event
  );

  return (
    <div className="space-y-3">
      {/* Enhanced section header with colored accent, gradient divider, and event count */}
      <div className="flex items-center gap-3">
        <div
          className="w-1 h-4 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
        <h3
          className="font-mono text-xs font-bold uppercase tracking-wider"
          style={{
            color: accentColor,
            textShadow: `0 0 20px ${accentColor}40`,
          }}
        >
          {title}
        </h3>
        <div
          className="flex-1 h-px"
          style={{
            background: `linear-gradient(to right, ${accentColor}40, transparent)`,
          }}
        />
        <span
          className="font-mono text-xs px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: `${accentColor}15`,
            color: accentColor,
          }}
        >
          {activities.length}
        </span>
      </div>

      {/* Grouped Event Activity */}
      {localGroupedActivities.map((group) => (
        <GroupedEventCard key={group.event!.id} group={group} />
      ))}

      {/* Other Activity */}
      {otherActivities.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative py-12 text-center">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, color-mix(in srgb, var(--coral) 8%, transparent) 0%, transparent 60%)",
        }}
      />
      <div className="relative z-10">
        <div className="mb-4 flex justify-center animate-stagger-1">
          <div
            className="relative flex items-center justify-center w-16 h-16 rounded-full"
            style={{
              background: "linear-gradient(135deg, var(--twilight), var(--dusk))",
              boxShadow: "0 0 20px color-mix(in srgb, var(--coral) 40%, transparent)",
            }}
          >
            <svg
              className="w-8 h-8 text-[var(--coral)] animate-empty-icon-pulse"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
        </div>
        <h3 className="text-xl font-semibold text-[var(--cream)] mb-2 animate-stagger-2">
          Your friends are suspiciously quiet.
        </h3>
        <p className="font-mono text-sm text-[var(--muted)] max-w-sm mx-auto animate-stagger-2">
          Follow more people to see their activity here
        </p>
        <div className="mt-6 animate-stagger-4">
          <Link
            href="/community"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-medium transition-all hover:scale-105"
            style={{
              backgroundColor: "var(--coral)",
              color: "var(--void)",
              boxShadow: "0 0 20px color-mix(in srgb, var(--coral) 40%, transparent)",
            }}
          >
            Find Friends
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
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

function GroupedEventCard({ group }: { group: GroupedActivity }) {
  const event = group.event!;
  const dateObj = parseISO(event.start_date);
  const categoryColor = event.category ? getCategoryColor(event.category) : null;

  // Format time
  const timeStr = event.is_all_day
    ? "All Day"
    : event.start_time
      ? format(parseISO(`2000-01-01T${event.start_time}`), "h:mm a")
      : "";

  const dayLabel = format(dateObj, "EEE");
  const dateLabel = format(dateObj, "MMM d");

  return (
    <Link
      href={`/events/${event.id}`}
      className="block p-3 rounded-lg glass border border-[var(--twilight)]/50 hover:border-[var(--coral)]/30 transition-all group relative"
      style={{
        borderLeftWidth: categoryColor ? "3px" : undefined,
        borderLeftColor: categoryColor || undefined,
      }}
    >
      {/* Hover glow effect */}
      <div
        className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl"
        style={{
          background: "radial-gradient(circle at center, var(--coral) 0%, var(--neon-magenta) 50%, transparent 70%)",
        }}
      />
      <div className="flex flex-col sm:flex-row gap-3 relative z-10">
        {/* Time cell - like EventCard */}
        <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
          <span className="font-mono text-[0.55rem] font-medium leading-none text-[var(--muted)]">
            {dayLabel}
          </span>
          <span className="font-mono text-sm font-medium text-[var(--soft)] leading-none tabular-nums mt-0.5">
            {dateLabel}
          </span>
          {timeStr && (
            <span className="font-mono text-[0.55rem] text-[var(--muted)] mt-0.5">{timeStr}</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Category icon + title */}
          <div className="flex items-center gap-2 mb-1">
            {event.category && (
              <span
                className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded"
                style={{
                  backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                }}
              >
                <CategoryIcon type={event.category} size={12} glow="subtle" />
              </span>
            )}
            <h3 className="text-[var(--cream)] font-medium leading-snug line-clamp-2 sm:line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
              {event.title}
            </h3>
          </div>

          {/* Friend avatars with enhanced visual */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <div className="relative">
              <AvatarStack
                users={group.users.map((u) => ({
                  id: u.id,
                  name: u.display_name || u.username,
                  avatar_url: u.avatar_url,
                }))}
                max={4}
                size="xs"
              />
              {group.users.length > 1 && (
                <div className="absolute -inset-1 bg-[var(--coral)]/10 rounded-full blur-sm -z-10 animate-pulse-slow" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {group.users.length === 1 ? (
                <>
                  <span className="font-medium text-[var(--coral)] text-xs truncate max-w-[120px]">
                    {group.users[0].display_name || group.users[0].username}
                  </span>
                  <span className="font-mono text-xs text-[var(--muted)]">is going</span>
                </>
              ) : group.users.length <= 3 ? (
                <>
                  <span className="font-medium text-[var(--coral)] text-xs">
                    {group.users.slice(0, 2).map((u) => u.display_name || u.username).join(", ")}
                  </span>
                  {group.users.length === 3 && (
                    <>
                      <span className="text-[var(--muted)] text-xs">and</span>
                      <span className="font-medium text-[var(--coral)] text-xs">
                        {group.users[2].display_name || group.users[2].username}
                      </span>
                    </>
                  )}
                  <span className="font-mono text-xs text-[var(--muted)]">are going</span>
                </>
              ) : (
                <>
                  <span className="font-bold text-[var(--coral)] text-sm">
                    {group.users.length}
                  </span>
                  <span className="font-mono text-xs text-[var(--muted)]">friends going</span>
                </>
              )}
            </div>
          </div>

          {/* Venue details */}
          {event.venue && (
            <p className="font-mono text-xs text-[var(--muted)] truncate">
              {event.venue.name}
            </p>
          )}
        </div>

        {/* Thumbnail if available */}
        {event.image_url && (
          <div
            className="hidden sm:block flex-shrink-0 w-16 h-16 rounded-lg border border-[var(--twilight)] bg-cover bg-center"
            style={{ backgroundImage: `url(${event.image_url})` }}
          />
        )}
      </div>
    </Link>
  );
}

function ActivityCard({ activity }: { activity: ActivityItem }) {
  const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

  // Render saved/RSVP event activity - styled like EventCard
  if ((activity.activity_type === "save" || activity.activity_type === "rsvp") && activity.event) {
    const eventDate = parseISO(activity.event.start_date);
    const categoryColor = activity.event.category ? getCategoryColor(activity.event.category) : null;

    // Format time
    const timeStr = activity.event.is_all_day
      ? "All Day"
      : activity.event.start_time
        ? format(parseISO(`2000-01-01T${activity.event.start_time}`), "h:mm a")
        : "";

    const dayLabel = format(eventDate, "EEE");
    const dateLabel = format(eventDate, "MMM d");

    return (
      <Link
        href={`/events/${activity.event.id}`}
        className="block p-3 rounded-lg glass border border-[var(--twilight)]/50 hover:border-[var(--neon-magenta)]/30 transition-all group relative"
        style={{
          borderLeftWidth: categoryColor ? "3px" : undefined,
          borderLeftColor: categoryColor || undefined,
        }}
      >
        {/* Hover glow effect */}
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl"
          style={{
            background: "radial-gradient(circle at center, var(--neon-magenta) 0%, var(--coral) 50%, transparent 70%)",
          }}
        />
        <div className="flex flex-col sm:flex-row gap-3 relative z-10">
          {/* Time cell - like EventCard */}
          <div className="flex-shrink-0 w-14 flex flex-col items-center justify-center py-1">
            <span className="font-mono text-[0.55rem] font-medium leading-none text-[var(--muted)]">
              {dayLabel}
            </span>
            <span className="font-mono text-sm font-medium text-[var(--soft)] leading-none tabular-nums mt-0.5">
              {dateLabel}
            </span>
            {timeStr && (
              <span className="font-mono text-[0.55rem] text-[var(--muted)] mt-0.5">{timeStr}</span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* User action header */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <UserAvatar
                src={activity.user.avatar_url}
                name={activity.user.display_name || activity.user.username}
                size="xs"
              />
              <span className="text-xs text-[var(--muted)] truncate">
                <span className="text-[var(--soft)]">
                  {activity.user.display_name || activity.user.username}
                </span>
                {" "}{activity.activity_type === "save" ? "saved" : "is interested in"} this
              </span>
              <span className="ml-auto font-mono text-[0.55rem] text-[var(--muted)] flex-shrink-0">
                {timeAgo}
              </span>
            </div>

            {/* Category icon + title */}
            <div className="flex items-center gap-2 mb-1">
              {activity.event.category && (
                <span
                  className="flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded"
                  style={{
                    backgroundColor: categoryColor ? `${categoryColor}20` : undefined,
                  }}
                >
                  <CategoryIcon type={activity.event.category} size={12} glow="subtle" />
                </span>
              )}
              <h3 className="text-[var(--cream)] font-medium leading-snug line-clamp-2 sm:line-clamp-1 group-hover:text-[var(--neon-magenta)] transition-colors">
                {activity.event.title}
              </h3>
            </div>

            {/* Venue details */}
            {activity.event.venue && (
              <p className="font-mono text-xs text-[var(--muted)] truncate">
                {activity.event.venue.name}
              </p>
            )}
          </div>

          {/* Thumbnail if available */}
          {activity.event.image_url && (
            <div
              className="hidden sm:block flex-shrink-0 w-16 h-16 rounded-lg border border-[var(--twilight)] bg-cover bg-center"
              style={{ backgroundImage: `url(${activity.event.image_url})` }}
            />
          )}
        </div>
      </Link>
    );
  }

  // Render venue follow activity - simpler card
  if (activity.activity_type === "follow" && activity.venue?.slug) {
    return (
      <Link
        href={`/spots/${activity.venue.slug}`}
        className="block p-3 rounded-lg glass border border-[var(--twilight)]/50 hover:border-[var(--coral)]/30 transition-all group relative"
      >
        {/* Hover glow effect */}
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl"
          style={{
            background: "radial-gradient(circle at center, var(--coral) 0%, transparent 70%)",
          }}
        />
        {/* Header */}
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
          <span className="font-mono text-[0.55rem] text-[var(--muted)] flex-shrink-0">
            {timeAgo}
          </span>
        </div>

        {/* Venue info */}
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

  // Render organization follow activity - simpler card
  if (activity.activity_type === "follow" && activity.organization?.slug) {
    return (
      <Link
        href={`/orgs/${activity.organization.slug}`}
        className="block p-3 rounded-lg glass border border-[var(--twilight)]/50 hover:border-[var(--neon-cyan)]/30 transition-all group relative"
      >
        {/* Hover glow effect */}
        <div
          className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl"
          style={{
            background: "radial-gradient(circle at center, var(--neon-cyan) 0%, transparent 70%)",
          }}
        />
        {/* Header */}
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
          <span className="font-mono text-[0.55rem] text-[var(--muted)] flex-shrink-0">
            {timeAgo}
          </span>
        </div>

        {/* Organization info */}
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

  // Fallback
  return null;
}
