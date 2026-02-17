import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

type Activity = {
  id: number | string;
  activity_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  event?: { id: number; title: string; start_date: string } | null;
  venue?: { id: number; name: string; slug: string } | null;
};

export default function ProfileActivity({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <p className="font-mono text-sm text-[var(--muted)]">No public activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  );
}

function ActivityItem({ activity }: { activity: Activity }) {
  const metadata = activity.metadata as { status?: string; note?: string } | null;

  const getActivityIcon = () => {
    switch (activity.activity_type) {
      case "rsvp": {
        const status = metadata?.status;
        if (status === "going") {
          return (
            <div className="w-8 h-8 rounded-full bg-[var(--cat-community)]/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[var(--cat-community)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          );
        }
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--gold)]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[var(--gold)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
        );
      }
      case "recommendation":
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--coral)]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
        );
      case "follow_venue":
        return (
          <div className="w-8 h-8 rounded-full bg-[#A78BFA]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#A78BFA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-[var(--twilight)] flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-[var(--muted)]" />
          </div>
        );
    }
  };

  const getActivityText = () => {
    switch (activity.activity_type) {
      case "rsvp": {
        const status = metadata?.status;
        return (
          <>
            {status === "going" ? "Going to" : status === "interested" ? "Interested in" : "Went to"}{" "}
            {activity.event && (
              <Link href={`/events/${activity.event.id}`} className="text-[var(--coral)] hover:text-[var(--rose)] font-medium">
                {activity.event.title}
              </Link>
            )}
          </>
        );
      }
      case "recommendation":
        return (
          <>
            Recommends{" "}
            {activity.event && (
              <Link href={`/events/${activity.event.id}`} className="text-[var(--coral)] hover:text-[var(--rose)] font-medium">
                {activity.event.title}
              </Link>
            )}
            {activity.venue && (
              <Link href={`/spots/${activity.venue.slug}`} className="text-[var(--coral)] hover:text-[var(--rose)] font-medium">
                {activity.venue.name}
              </Link>
            )}
            {metadata?.note && (
              <span className="block mt-2 text-[var(--soft)] italic text-sm pl-2 border-l-2 border-[var(--twilight)]">
                &ldquo;{metadata.note as string}&rdquo;
              </span>
            )}
          </>
        );
      case "follow_venue":
        return (
          <>
            Started following{" "}
            {activity.venue && (
              <Link href={`/spots/${activity.venue.slug}`} className="text-[var(--coral)] hover:text-[var(--rose)] font-medium">
                {activity.venue.name}
              </Link>
            )}
          </>
        );
      default:
        return activity.activity_type;
    }
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] card-event-hover">
      {getActivityIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--cream)]">{getActivityText()}</p>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );
}
