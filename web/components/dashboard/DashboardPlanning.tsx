"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import SaveButton from "@/components/SaveButton";
import CategoryIcon from "@/components/CategoryIcon";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { format, parseISO, startOfDay } from "date-fns";
import { formatTime } from "@/lib/formats";

// Timeout wrapper for Supabase queries to prevent indefinite hanging
const QUERY_TIMEOUT = 8000;
async function withTimeout<T>(
  queryFn: () => Promise<T>,
  ms: number = QUERY_TIMEOUT
): Promise<T> {
  return Promise.race([
    queryFn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Query timeout")), ms)
    ),
  ]);
}

type EventData = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  image_url: string | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
};

type SavedEvent = {
  id: string;
  created_at: string;
  event: EventData | null;
};

type RSVP = {
  id: string;
  status: string;
  created_at: string;
  event: EventData | null;
};

type EventInvite = {
  id: string;
  note: string | null;
  status: "pending" | "accepted" | "declined" | "maybe";
  created_at: string;
  inviter: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  event: EventData | null;
};

type PlanningTab = "saved" | "rsvps" | "invites";
type FilterTab = "upcoming" | "past";

export default function DashboardPlanning() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const supabase = createClient();

  const [planningTab, setPlanningTab] = useState<PlanningTab>("saved");
  const [filterTab, setFilterTab] = useState<FilterTab>("upcoming");
  const [savedItems, setSavedItems] = useState<SavedEvent[]>([]);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [invites, setInvites] = useState<EventInvite[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load all data in parallel - with timeout protection
      const [savedRes, rsvpRes, invitesRes] = await Promise.all([
        withTimeout(() =>
          supabase
            .from("saved_items")
            .select(`
              id,
              created_at,
              event:events (
                id,
                title,
                start_date,
                start_time,
                is_all_day,
                is_free,
                price_min,
                price_max,
                category,
                image_url,
                venue:venues (
                  id,
                  name,
                  neighborhood
                )
              )
            `)
            .eq("user_id", user.id)
            .not("event_id", "is", null)
            .order("created_at", { ascending: false })
        ),

        withTimeout(() =>
          supabase
            .from("event_rsvps")
            .select(`
              id,
              status,
              created_at,
              event:events (
                id,
                title,
                start_date,
                start_time,
                is_all_day,
                is_free,
                price_min,
                price_max,
                category,
                image_url,
                venue:venues (
                  id,
                  name,
                  neighborhood
                )
              )
            `)
            .eq("user_id", user.id)
            .in("status", ["going", "interested"])
            .order("created_at", { ascending: false })
        ),

        withTimeout(() =>
          supabase
            .from("event_invites")
            .select(`
              id,
              note,
              status,
              created_at,
              inviter:profiles!event_invites_inviter_id_fkey (
                id,
                username,
                display_name,
                avatar_url
              ),
              event:events (
                id,
                title,
                start_date,
                start_time,
                is_all_day,
                is_free,
                price_min,
                price_max,
                category,
                image_url,
                venue:venues (
                  id,
                  name,
                  neighborhood
                )
              )
            `)
            .eq("invitee_id", user.id)
            .order("created_at", { ascending: false })
        ),
      ]);

      if (savedRes.data) {
        setSavedItems(savedRes.data as SavedEvent[]);
      }

      if (rsvpRes.data) {
        setRsvps(rsvpRes.data as RSVP[]);
      }

      if (invitesRes.data) {
        setInvites(invitesRes.data as EventInvite[]);
      }
    } catch (error) {
      console.error("Failed to load planning data:", error);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInviteResponse = async (inviteId: string, status: "accepted" | "declined" | "maybe") => {
    try {
      const res = await fetch(`/api/invites/${inviteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        showToast(
          status === "accepted"
            ? "You're in!"
            : status === "declined"
            ? "Invite declined"
            : "Maybe next time"
        );
        loadData();
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to respond", "error");
      }
    } catch {
      showToast("Failed to respond to invite", "error");
    }
  };

  const filterByDate = <T extends { event: EventData | null }>(items: T[]): T[] => {
    return items.filter((item) => {
      if (!item.event) return false;

      const eventDate = startOfDay(parseISO(item.event.start_date));
      const today = startOfDay(new Date());
      const isEventPast = eventDate < today;

      if (filterTab === "upcoming") return !isEventPast;
      return isEventPast;
    });
  };

  const pendingInvites = invites.filter((i) => i.status === "pending");

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Tab skeleton */}
        <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-9 skeleton-shimmer rounded-md" />
          ))}
        </div>
        {/* Items skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
              <div className="flex gap-4">
                <div className="w-20 h-20 skeleton-shimmer rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 skeleton-shimmer rounded w-3/4" />
                  <div className="h-4 skeleton-shimmer rounded w-1/2" />
                  <div className="h-3 skeleton-shimmer rounded w-1/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Planning Tab Bar */}
      <div className="flex gap-1 p-1 bg-[var(--night)] rounded-lg">
        <TabButton
          active={planningTab === "saved"}
          onClick={() => setPlanningTab("saved")}
          badge={savedItems.length}
        >
          Stashed
        </TabButton>
        <TabButton
          active={planningTab === "rsvps"}
          onClick={() => setPlanningTab("rsvps")}
          badge={rsvps.length}
        >
          RSVPs
        </TabButton>
        <TabButton
          active={planningTab === "invites"}
          onClick={() => setPlanningTab("invites")}
          badge={pendingInvites.length}
          highlight={pendingInvites.length > 0}
        >
          Invites
        </TabButton>
      </div>

      {/* Filter Bar (for saved and RSVPs) */}
      {planningTab !== "invites" && (
        <div className="flex gap-2">
          <button
            onClick={() => setFilterTab("upcoming")}
            className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors ${
              filterTab === "upcoming"
                ? "bg-[var(--twilight)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setFilterTab("past")}
            className={`px-3 py-1.5 rounded-md font-mono text-xs transition-colors ${
              filterTab === "past"
                ? "bg-[var(--twilight)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:text-[var(--cream)]"
            }`}
          >
            Past
          </button>
        </div>
      )}

      {/* Content */}
      {planningTab === "saved" && (
        <SavedSection items={filterByDate(savedItems)} filterTab={filterTab} />
      )}

      {planningTab === "rsvps" && (
        <RSVPSection items={filterByDate(rsvps)} filterTab={filterTab} />
      )}

      {planningTab === "invites" && (
        <InvitesSection
          invites={invites}
          onRespond={handleInviteResponse}
        />
      )}

      {/* Calendar Preview */}
      <div className="mt-8 p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
            This Week
          </h3>
          <Link
            href={`/${DEFAULT_PORTAL_SLUG}?view=calendar`}
            className="font-mono text-xs text-[var(--coral)] hover:text-[var(--rose)] transition-colors"
          >
            Full Calendar
          </Link>
        </div>
        <CalendarPreview savedItems={savedItems} rsvps={rsvps} />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  badge,
  highlight,
  children,
}: {
  active: boolean;
  onClick: () => void;
  badge?: number;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-md font-mono text-xs font-medium transition-all flex items-center justify-center gap-2 min-h-[40px] ${
        active
          ? "bg-[var(--dusk)] text-[var(--cream)] shadow-sm"
          : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)]/50"
      }`}
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
            highlight
              ? "bg-[var(--coral)] text-[var(--void)]"
              : "bg-[var(--twilight)] text-[var(--cream)]"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function SavedSection({ items, filterTab }: { items: SavedEvent[]; filterTab: FilterTab }) {
  if (items.length === 0) {
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
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        <p className="text-[var(--soft)] font-mono text-sm">
          {filterTab === "upcoming" ? "Nothing stashed. Boring." : "Nothing in the past"}
        </p>
        <Link
          href={`/${DEFAULT_PORTAL_SLUG}`}
          className="inline-block mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
        >
          Browse Events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) =>
        item.event ? <EventCard key={item.id} event={item.event} showSaveButton /> : null
      )}
    </div>
  );
}

function RSVPSection({ items, filterTab }: { items: RSVP[]; filterTab: FilterTab }) {
  if (items.length === 0) {
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
            d="M5 13l4 4L19 7"
          />
        </svg>
        <p className="text-[var(--soft)] font-mono text-sm">
          {filterTab === "upcoming" ? "No events on your calendar yet" : "No past events"}
        </p>
        <Link
          href={`/${DEFAULT_PORTAL_SLUG}`}
          className="inline-block mt-4 px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded-lg hover:bg-[var(--rose)] transition-colors"
        >
          Find Something
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) =>
        item.event ? (
          <EventCard
            key={item.id}
            event={item.event}
            badge={item.status === "going" ? "Going" : "Interested"}
          />
        ) : null
      )}
    </div>
  );
}

function InvitesSection({
  invites,
  onRespond,
}: {
  invites: EventInvite[];
  onRespond: (id: string, status: "accepted" | "declined" | "maybe") => void;
}) {
  const pendingInvites = invites.filter((i) => i.status === "pending");
  const respondedInvites = invites.filter((i) => i.status !== "pending");

  if (invites.length === 0) {
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
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <p className="text-[var(--soft)] font-mono text-sm">
          No one&apos;s invited you anywhere. Yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pendingInvites.length > 0 && (
        <section>
          <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
            Pending ({pendingInvites.length})
          </h3>
          <div className="space-y-3">
            {pendingInvites.map((invite) => (
              <InviteCard key={invite.id} invite={invite} onRespond={onRespond} />
            ))}
          </div>
        </section>
      )}

      {respondedInvites.length > 0 && (
        <section>
          <h3 className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
            Responded
          </h3>
          <div className="space-y-3">
            {respondedInvites.map((invite) => (
              <InviteCard key={invite.id} invite={invite} onRespond={onRespond} responded />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function InviteCard({
  invite,
  onRespond,
  responded = false,
}: {
  invite: EventInvite;
  onRespond: (id: string, status: "accepted" | "declined" | "maybe") => void;
  responded?: boolean;
}) {
  if (!invite.event || !invite.inviter) return null;

  const dateObj = parseISO(invite.event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const time = formatTime(invite.event.start_time, invite.event.is_all_day);

  return (
    <div className={`p-4 bg-[var(--dusk)] border rounded-lg ${
      responded ? "border-[var(--twilight)]" : "border-[var(--coral)]/30"
    }`}>
      {/* Inviter info */}
      <div className="flex items-center gap-2 mb-3">
        <Link href={`/profile/${invite.inviter.username}`}>
          {invite.inviter.avatar_url ? (
            <Image
              src={invite.inviter.avatar_url}
              alt={invite.inviter.display_name || invite.inviter.username}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[var(--coral)] flex items-center justify-center text-[var(--void)] text-[10px] font-bold">
              {(invite.inviter.display_name || invite.inviter.username).charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <span className="font-mono text-xs text-[var(--soft)]">
          {invite.inviter.display_name || `@${invite.inviter.username}`} invited you
        </span>
      </div>

      {/* Event info */}
      <Link
        href={`/events/${invite.event.id}`}
        className="block group"
      >
        <div className="flex gap-4">
          {invite.event.image_url && (
            <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--night)] relative">
              <Image
                src={invite.event.image_url}
                alt={invite.event.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[var(--cream)] line-clamp-1 group-hover:text-[var(--coral)] transition-colors">
              {invite.event.title}
            </h4>
            {invite.event.venue && (
              <p className="font-serif text-sm text-[var(--soft)] truncate">
                {invite.event.venue.name}
              </p>
            )}
            <p className="font-mono text-xs text-[var(--muted)] mt-0.5">
              {formattedDate} · {time}
            </p>
          </div>
        </div>
      </Link>

      {/* Note */}
      {invite.note && (
        <p className="mt-3 text-sm text-[var(--muted)] italic border-l-2 border-[var(--twilight)] pl-3">
          &ldquo;{invite.note}&rdquo;
        </p>
      )}

      {/* Response buttons */}
      {!responded ? (
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onRespond(invite.id, "accepted")}
            className="flex-1 px-3 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg text-xs font-mono font-medium hover:bg-[var(--rose)] transition-colors min-h-[40px]"
          >
            I&apos;m in!
          </button>
          <button
            onClick={() => onRespond(invite.id, "maybe")}
            className="flex-1 px-3 py-2 bg-[var(--twilight)] text-[var(--cream)] rounded-lg text-xs font-mono font-medium hover:bg-[var(--twilight)]/80 transition-colors min-h-[40px]"
          >
            Maybe
          </button>
          <button
            onClick={() => onRespond(invite.id, "declined")}
            className="px-3 py-2 bg-transparent border border-[var(--muted)] text-[var(--muted)] rounded-lg text-xs font-mono font-medium hover:bg-[var(--muted)]/10 transition-colors min-h-[40px]"
          >
            Pass
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono ${
            invite.status === "accepted"
              ? "bg-[var(--neon-green)]/20 text-[var(--neon-green)]"
              : invite.status === "maybe"
              ? "bg-[var(--gold)]/20 text-[var(--gold)]"
              : "bg-[var(--muted)]/20 text-[var(--muted)]"
          }`}>
            {invite.status === "accepted" && "Going"}
            {invite.status === "maybe" && "Maybe"}
            {invite.status === "declined" && "Declined"}
          </span>
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  showSaveButton = false,
  badge,
}: {
  event: EventData;
  showSaveButton?: boolean;
  badge?: string;
}) {
  const dateObj = parseISO(event.start_date);
  const formattedDate = format(dateObj, "EEE, MMM d");
  const time = formatTime(event.start_time, event.is_all_day);
  const isEventPast = startOfDay(dateObj) < startOfDay(new Date());

  return (
    <div className={`relative group ${isEventPast ? "opacity-60" : ""}`}>
      <Link
        href={`/events/${event.id}`}
        className="block p-4 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg hover:bg-[var(--twilight)]/50 transition-colors"
      >
        <div className="flex gap-4">
          {event.image_url && (
            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--night)] relative">
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                className="object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0 pr-10">
            {event.category && (
              <div className="mb-1">
                <CategoryIcon type={event.category} size={12} showLabel />
              </div>
            )}

            <h3 className="font-semibold text-[var(--cream)] line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
              {event.title}
            </h3>

            {event.venue && (
              <p className="font-serif text-sm text-[var(--soft)] mt-0.5 truncate">
                {event.venue.name}
                {event.venue.neighborhood && (
                  <span className="text-[var(--muted)]"> · {event.venue.neighborhood}</span>
                )}
              </p>
            )}

            <p className="font-mono text-xs text-[var(--muted)] mt-1">
              {formattedDate} · {time}
              {event.is_free && (
                <span className="ml-2 text-[var(--cat-community)]">Free</span>
              )}
              {isEventPast && <span className="ml-2 text-[var(--coral)]">Past</span>}
            </p>

            {badge && (
              <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-md text-[10px] font-mono bg-[var(--neon-green)]/20 text-[var(--neon-green)]">
                {badge}
              </span>
            )}
          </div>
        </div>
      </Link>

      {showSaveButton && (
        <div className="absolute top-4 right-4">
          <SaveButton eventId={event.id} size="sm" />
        </div>
      )}
    </div>
  );
}

function CalendarPreview({ savedItems, rsvps }: { savedItems: SavedEvent[]; rsvps: RSVP[] }) {
  const today = startOfDay(new Date());
  const next7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    return date;
  });

  // Get events for each day
  const getEventsForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");

    const savedForDate = savedItems.filter(
      (s) => s.event && s.event.start_date === dateStr
    );
    const rsvpsForDate = rsvps.filter(
      (r) => r.event && r.event.start_date === dateStr
    );

    return [...savedForDate, ...rsvpsForDate];
  };

  return (
    <div className="grid grid-cols-7 gap-1">
      {next7Days.map((date, i) => {
        const events = getEventsForDate(date);
        const isToday = i === 0;

        return (
          <div
            key={i}
            className={`text-center py-2 rounded ${
              isToday
                ? "bg-[var(--coral)]/20 border border-[var(--coral)]/30"
                : "bg-[var(--night)]"
            }`}
          >
            <p className="font-mono text-[10px] text-[var(--muted)]">
              {format(date, "EEE")}
            </p>
            <p className={`font-mono text-sm ${isToday ? "text-[var(--coral)]" : "text-[var(--cream)]"}`}>
              {format(date, "d")}
            </p>
            {events.length > 0 && (
              <div className="mt-1 flex justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--coral)]" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
