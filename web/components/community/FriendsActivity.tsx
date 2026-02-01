"use client";

import Link from "next/link";
import UserAvatar, { AvatarStack } from "@/components/UserAvatar";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import FollowButton from "@/components/FollowButton";
import { formatDistanceToNow, format, parseISO } from "date-fns";

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
  target_user?: {
    id: string;
    username: string;
    display_name: string | null;
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

interface FriendsActivityProps {
  activities: ActivityItem[];
}

export function FriendsActivity({ activities }: FriendsActivityProps) {
  // Group activities by event
  const groupedActivities = activities.reduce<GroupedActivity[]>((acc, activity) => {
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

  // Non-event activities (follows, recommendations)
  const otherActivities = activities.filter(
    (a) => a.activity_type !== "rsvp" || !a.event
  );

  if (activities.length === 0) {
    return (
      <div className="p-6 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg text-center">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-[var(--muted)]"
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
        <p className="text-[var(--soft)] font-mono text-sm">
          Your friends are suspiciously quiet.
        </p>
        <p className="text-[var(--muted)] font-mono text-xs mt-1">
          Follow more people to see their activity here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Grouped Event Activity */}
      {groupedActivities.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
            Friends Are Going
          </h3>
          {groupedActivities.slice(0, 5).map((group) => (
            <GroupedEventCard key={group.event!.id} group={group} />
          ))}
        </div>
      )}

      {/* Other Activity */}
      {otherActivities.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
            What Friends Are Into
          </h3>
          {otherActivities.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} />
          ))}
        </div>
      )}
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
      className="block p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--neon-cyan)]/30 transition-all group"
      style={{
        borderLeftWidth: categoryColor ? "3px" : undefined,
        borderLeftColor: categoryColor || undefined,
      }}
    >
      <div className="flex gap-3">
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
            <h3 className="text-[var(--cream)] font-medium leading-snug line-clamp-1 group-hover:text-[var(--neon-cyan)] transition-colors">
              {event.title}
            </h3>
          </div>

          {/* Friend avatars */}
          <div className="flex items-center gap-2 mb-1">
            <AvatarStack
              users={group.users.map((u) => ({
                id: u.id,
                name: u.display_name || u.username,
                avatar_url: u.avatar_url,
              }))}
              max={4}
              size="xs"
            />
            <span className="font-mono text-xs text-[var(--neon-cyan)]">
              {group.users.length === 1
                ? `${group.users[0].display_name || group.users[0].username} is going`
                : `${group.users.length} friends going`}
            </span>
          </div>

          {/* Venue details */}
          {event.venue && (
            <p className="font-mono text-xs text-[var(--muted)]">
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
        className="block p-3 rounded-lg border border-[var(--twilight)] bg-[var(--dusk)] hover:border-[var(--neon-magenta)]/30 transition-all group"
        style={{
          borderLeftWidth: categoryColor ? "3px" : undefined,
          borderLeftColor: categoryColor || undefined,
        }}
      >
        <div className="flex gap-3">
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
            <div className="flex items-center gap-2 mb-1">
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
              <h3 className="text-[var(--cream)] font-medium leading-snug line-clamp-1 group-hover:text-[var(--neon-magenta)] transition-colors">
                {activity.event.title}
              </h3>
            </div>

            {/* Venue details */}
            {activity.event.venue && (
              <p className="font-mono text-xs text-[var(--muted)]">
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
        className="block p-3 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--neon-cyan)]/30 transition-all group"
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <UserAvatar
            src={activity.user.avatar_url}
            name={activity.user.display_name || activity.user.username}
            size="xs"
          />
          <span className="text-xs text-[var(--muted)]">
            <span className="text-[var(--soft)]">
              {activity.user.display_name || activity.user.username}
            </span>
            {" "}now follows
          </span>
          <span className="ml-auto font-mono text-[0.55rem] text-[var(--muted)]">
            {timeAgo}
          </span>
        </div>

        {/* Venue info */}
        <h4 className="font-medium text-[var(--cream)] group-hover:text-[var(--neon-cyan)] transition-colors">
          {activity.venue.name}
        </h4>
        {activity.venue.neighborhood && (
          <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
            {activity.venue.neighborhood}
          </p>
        )}
      </Link>
    );
  }

  // Render user follow activity - simpler card
  if (activity.activity_type === "follow" && activity.target_user) {
    return (
      <div className="p-3 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <UserAvatar
            src={activity.user.avatar_url}
            name={activity.user.display_name || activity.user.username}
            size="xs"
          />
          <span className="text-xs text-[var(--muted)]">
            <span className="text-[var(--soft)]">
              {activity.user.display_name || activity.user.username}
            </span>
            {" "}followed
          </span>
          <span className="ml-auto font-mono text-[0.55rem] text-[var(--muted)]">
            {timeAgo}
          </span>
        </div>

        {/* Target user card */}
        <div className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-[var(--twilight)]/20 transition-colors">
          <Link href={`/profile/${activity.target_user.username}`}>
            <UserAvatar
              src={null}
              name={activity.target_user.display_name || activity.target_user.username}
              size="md"
              glow
            />
          </Link>
          <div className="flex-1 min-w-0">
            <Link
              href={`/profile/${activity.target_user.username}`}
              className="font-medium text-[var(--cream)] hover:text-[var(--neon-cyan)] transition-colors block truncate"
            >
              {activity.target_user.display_name || `@${activity.target_user.username}`}
            </Link>
            <p className="text-xs text-[var(--muted)]">@{activity.target_user.username}</p>
          </div>
          <FollowButton targetUserId={activity.target_user.id} size="sm" />
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}

export type { FriendsActivityProps };
