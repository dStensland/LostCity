"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";

// Timeout constant for Supabase queries to prevent indefinite hanging
const QUERY_TIMEOUT = 8000; // 8 seconds

type WhosGoingProps = {
  eventId: number;
  className?: string;
};

type AttendeeProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Attendee = {
  user: AttendeeProfile;
  status: "going" | "interested";
  isFriend: boolean;
};

export default function WhosGoing({ eventId, className = "" }: WhosGoingProps) {
  const { user } = useAuth();
  const supabase = createClient();

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const goingCount = attendees.filter((a) => a.status === "going").length;
  const interestedCount = attendees.filter((a) => a.status === "interested").length;

  useEffect(() => {
    let isMounted = true;

    async function loadAttendees() {
      try {
        // Run RSVP query and friend queries in parallel with timeout protection
        const rsvpQuery = supabase
          .from("event_rsvps")
          .select(`
            status,
            user:profiles!event_rsvps_user_id_fkey(
              id, username, display_name, avatar_url
            )
          `)
          .eq("event_id", eventId)
          .eq("visibility", "public")
          .in("status", ["going", "interested"]);

        const rsvpPromise = Promise.race([
          rsvpQuery,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT)
          ),
        ]);

        // Get current user's friend IDs in parallel (only if logged in)
        const friendIdsPromise = user
          ? Promise.race([
              (async () => {
              const friendIds: Set<string> = new Set();

              const { data: myFollows } = await supabase
                .from("follows")
                .select("followed_user_id")
                .eq("follower_id", user.id)
                .not("followed_user_id", "is", null);

              const followsData = myFollows as { followed_user_id: string | null }[] | null;
              if (followsData && followsData.length > 0) {
                const followedIds = followsData.map((f) => f.followed_user_id).filter(Boolean) as string[];

                // Batch query: get all who follow back (mutual = friends)
                const { data: mutualFollows } = await supabase
                  .from("follows")
                  .select("follower_id")
                  .in("follower_id", followedIds)
                  .eq("followed_user_id", user.id);

                const mutualData = mutualFollows as { follower_id: string }[] | null;
                if (mutualData) {
                  mutualData.forEach((f) => friendIds.add(f.follower_id));
                }
              }
              return friendIds;
            })(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT)
              ),
            ])
          : Promise.resolve(new Set<string>());

        // Wait for both queries in parallel
        const [{ data: rsvpData }, friendIds] = await Promise.all([rsvpPromise, friendIdsPromise]);

      if (!isMounted) return;

      type RSVPQueryResult = {
        status: string;
        user: AttendeeProfile | null;
      };

      const rsvps = rsvpData as RSVPQueryResult[] | null;
      if (!rsvps || rsvps.length === 0) {
        setLoading(false);
        return;
      }

      // Build attendee list
      const attendeeList: Attendee[] = rsvps
        .filter((rsvp) => rsvp.user !== null)
        .map((rsvp) => ({
          user: rsvp.user as AttendeeProfile,
          status: rsvp.status as "going" | "interested",
          isFriend: friendIds.has(rsvp.user!.id),
        }));

      // Sort: friends first, then by status (going before interested)
      attendeeList.sort((a, b) => {
        if (a.isFriend !== b.isFriend) return a.isFriend ? -1 : 1;
        if (a.status !== b.status) return a.status === "going" ? -1 : 1;
        return 0;
      });

      setAttendees(attendeeList);
      setLoading(false);
      } catch (error) {
        // Handle timeout or other errors gracefully - just stop loading
        console.error("WhosGoing query error:", error);
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadAttendees();

    return () => {
      isMounted = false;
    };
  }, [user, eventId, supabase]);

  // Hide while loading or when no attendees
  if (loading || attendees.length === 0) {
    return null;
  }

  const displayLimit = expanded ? attendees.length : 12;
  const displayAttendees = attendees.slice(0, displayLimit);
  const remainingCount = attendees.length - displayLimit;

  return (
    <div className={`${className}`}>
      <h2 className="font-mono text-[0.65rem] font-medium text-[var(--muted)] uppercase tracking-widest mb-4">
        Who&apos;s in
      </h2>

      {/* Stats with accessible indicators */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {goingCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm">
            <span
              className="w-4 h-4 rounded-full bg-[var(--neon-green)] flex items-center justify-center text-[0.55rem] font-bold text-[var(--void)]"
              aria-label="Going indicator"
            >
              G
            </span>
            <span className="text-[var(--cream)] font-medium">{goingCount}</span>
            <span className="text-[var(--muted)]">going</span>
          </span>
        )}
        {interestedCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm">
            <span
              className="w-4 h-4 rounded-full bg-[var(--neon-amber)] flex items-center justify-center text-[0.55rem] font-bold text-[var(--void)]"
              aria-label="Interested indicator"
            >
              I
            </span>
            <span className="text-[var(--cream)] font-medium">{interestedCount}</span>
            <span className="text-[var(--muted)]">interested</span>
          </span>
        )}
      </div>

      {/* Avatar grid */}
      <div className="flex flex-wrap gap-2">
        {displayAttendees.map((attendee) => (
          <Link
            key={attendee.user.id}
            href={`/profile/${attendee.user.username}`}
            className="group relative"
            title={`${attendee.user.display_name || attendee.user.username} (${attendee.status})`}
          >
            <div
              className={`relative w-10 h-10 rounded-full overflow-hidden border-2 transition-all ${
                attendee.isFriend
                  ? "border-[var(--neon-magenta)] ring-2 ring-[var(--neon-magenta)]/20"
                  : "border-[var(--twilight)] group-hover:border-[var(--soft)]"
              }`}
            >
              {attendee.user.avatar_url ? (
                <Image
                  src={attendee.user.avatar_url}
                  alt={attendee.user.display_name || attendee.user.username}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[var(--neon-magenta)] to-[var(--coral)] flex items-center justify-center">
                  <span className="font-mono text-sm font-bold text-white">
                    {(attendee.user.display_name || attendee.user.username)[0].toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            {/* Status indicator with letter for accessibility */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[var(--dusk)] flex items-center justify-center text-[0.5rem] font-bold ${
                attendee.status === "going"
                  ? "bg-[var(--neon-green)] text-[var(--void)]"
                  : "bg-[var(--neon-amber)] text-[var(--void)]"
              }`}
              title={attendee.status === "going" ? "In" : "Maybe"}
            >
              {attendee.status === "going" ? "✓" : "?"}
            </span>
          </Link>
        ))}

        {/* Show more button */}
        {!expanded && remainingCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-10 h-10 rounded-full bg-[var(--twilight)] border-2 border-[var(--twilight)] hover:border-[var(--soft)] transition-colors flex items-center justify-center"
          >
            <span className="font-mono text-xs font-medium text-[var(--muted)]">
              +{remainingCount}
            </span>
          </button>
        )}
      </div>

      {/* Collapse button */}
      {expanded && attendees.length > 12 && (
        <button
          onClick={() => setExpanded(false)}
          className="mt-3 text-xs font-mono text-[var(--muted)] hover:text-[var(--soft)] transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}
