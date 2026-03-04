"use client";

/**
 * Social Hub — three-zone trending section.
 *
 * Zone 1: "Popular" — top events by going_count (always visible)
 * Zone 2: "Friends Are Going" — events friends RSVP'd to (auth-gated)
 * Zone 3: "Your Upcoming" — user's own RSVPs (auth-gated)
 *
 * Each empty state is a CTA nudging sign-in → add friends → RSVP.
 */

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import Image from "@/components/SmartImage";
import { useAuth } from "@/lib/auth-context";
import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";
import type { FeedEventData } from "@/components/EventCard";
import CategoryIcon, { getCategoryColor } from "@/components/CategoryIcon";
import { formatSmartDate, formatTime } from "@/lib/formats";
import {
  Fire,
  ArrowRight,
  Users,
  CalendarBlank,
  UserPlus,
  SignIn,
  Ticket,
  Lightning,
} from "@phosphor-icons/react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

type EnrichedEvent = FeedEventData & {
  friends_going?: { user_id: string; username: string; display_name: string | null }[];
  score?: number;
  is_recurring?: boolean;
  recurrence_label?: string;
};

type UpcomingEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time?: string | null;
  is_all_day?: boolean;
  venue_name?: string;
  category?: string;
  status: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSmartTimeLabel(ev: { start_date: string; start_time?: string | null; is_all_day?: boolean }): string {
  const dateInfo = formatSmartDate(ev.start_date);
  if (ev.is_all_day) return dateInfo.label;
  if (!ev.start_time) return dateInfo.label;
  const time = formatTime(ev.start_time);
  return `${dateInfo.label} ${time}`;
}

function getMomentumSignal(ev: EnrichedEvent): { label: string; color: string; icon?: typeof Lightning } | null {
  const going = ev.going_count || 0;
  if (going >= 3) return { label: `${going} going`, color: "var(--coral)" };
  if (ev.is_free) return { label: "Free", color: "var(--neon-green, #39FF14)", icon: Lightning };
  if (ev.ticket_url) return { label: "Tickets", color: "var(--soft)", icon: Ticket };
  if (ev.is_recurring && ev.recurrence_label) return { label: ev.recurrence_label, color: "var(--muted)" };
  return null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Hero card for #1 popular event — full-bleed magazine style */
function PopularHero({ ev, portalSlug }: { ev: EnrichedEvent; portalSlug: string }) {
  const timeLabel = getSmartTimeLabel(ev);
  const momentum = getMomentumSignal(ev);
  const categoryColor = getCategoryColor(ev.category);

  return (
    <Link
      href={`/${portalSlug}?event=${ev.id}`}
      scroll={false}
      className="block relative rounded-xl overflow-hidden border border-[var(--twilight)]/40 group transition-all hover:border-[var(--coral)]/30 hover:shadow-[0_0_24px_-4px] hover:shadow-[var(--coral)]/15"
    >
      {/* Image background */}
      <div className="relative aspect-[16/7] overflow-hidden">
        {ev.image_url ? (
          <Image
            src={ev.image_url}
            alt=""
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, 50vw"
            blurhash={ev.blurhash}
            fallback={
              <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${categoryColor} 25%, var(--night)), var(--void))` }}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <CategoryIcon type={ev.category || "other"} size={48} glow="subtle" />
                </div>
              </div>
            }
          />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${categoryColor} 25%, var(--night)), var(--void))` }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <CategoryIcon type={ev.category || "other"} size={48} glow="subtle" />
            </div>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Content overlaid on image */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="inline-flex items-center gap-0.5 font-mono text-2xs font-bold uppercase tracking-wider"
              style={{ color: categoryColor }}
            >
              <CategoryIcon type={ev.category || "other"} size={10} glow="none" weight="bold" />
              #{1}
            </span>
            {momentum && (
              <span className="font-mono text-2xs font-medium" style={{ color: momentum.color }}>
                {momentum.icon && <momentum.icon weight="bold" className="inline w-2.5 h-2.5 mr-0.5 -mt-px" />}
                {momentum.label}
              </span>
            )}
          </div>
          <p className="text-base font-bold text-white leading-tight line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
            {ev.title}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-white/80 truncate">
              {ev.venue?.name}
            </span>
            <span className="font-mono text-2xs text-white/65">{timeLabel}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Compact card for ranked events (#2-5) */
function PopularCard({
  ev,
  rank,
  portalSlug,
}: {
  ev: EnrichedEvent;
  rank: number;
  portalSlug: string;
}) {
  const timeLabel = getSmartTimeLabel(ev);
  const momentum = getMomentumSignal(ev);
  const categoryColor = getCategoryColor(ev.category);

  return (
    <Link
      href={`/${portalSlug}?event=${ev.id}`}
      scroll={false}
      className="block rounded-lg overflow-hidden border border-[var(--twilight)]/30 bg-[var(--night)] group transition-all hover:border-[var(--twilight)]/50 hover:shadow-[0_0_12px_-4px] hover:shadow-[var(--coral)]/10"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {ev.image_url ? (
          <Image
            src={ev.image_url}
            alt=""
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, 25vw"
            blurhash={ev.blurhash}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${categoryColor} 22%, var(--night)), var(--void))` }}
          >
            <CategoryIcon type={ev.category || "other"} size={24} glow="none" weight="light" />
          </div>
        )}
        {/* Gradient + rank badge */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute top-1.5 left-1.5 font-mono text-2xs font-black tabular-nums px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm text-white/85">
          #{rank}
        </span>
      </div>

      {/* Content */}
      <div className="px-2.5 py-2 space-y-0.5">
        <p className="text-xs font-semibold text-[var(--cream)] line-clamp-2 leading-snug group-hover:text-white transition-colors">
          {ev.title}
        </p>
        <p className="text-2xs text-[var(--soft)] truncate">{ev.venue?.name}</p>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-2xs text-[var(--soft)]">{timeLabel}</span>
          {momentum && (
            <span className="font-mono text-2xs font-medium" style={{ color: momentum.color }}>
              {momentum.label}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Friends Are Going zone */
function FriendsZone({
  events,
  portalSlug,
  isSignedIn,
}: {
  events: CityPulseEventItem[];
  portalSlug: string;
  isSignedIn: boolean;
}) {
  // Collect events where friends are going, deduplicate, sort by friend count
  const friendEvents = useMemo(() => {
    return events
      .filter((e) => e.event.friends_going && e.event.friends_going.length > 0)
      .sort((a, b) => (b.event.friends_going?.length || 0) - (a.event.friends_going?.length || 0))
      .slice(0, 3);
  }, [events]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Users weight="duotone" className="w-3.5 h-3.5 text-[var(--neon-cyan)]" />
        <h3 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--neon-cyan)]">
          Friends Are Going
        </h3>
      </div>

      {!isSignedIn ? (
        <Link
          href={`/${portalSlug}/auth/login`}
          className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)]/50 hover:bg-white/[0.02] transition-colors group"
        >
          <div className="w-9 h-9 rounded-full bg-[var(--neon-cyan,#00d4e8)]/10 flex items-center justify-center shrink-0">
            <SignIn weight="light" className="w-4 h-4 text-[var(--neon-cyan,#00d4e8)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--cream)] group-hover:text-[var(--neon-cyan,#00d4e8)] transition-colors">
              Sign in to see friends&apos; plans
            </p>
            <p className="text-2xs text-[var(--soft)]">
              See what your people are up to this week
            </p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--neon-cyan,#00d4e8)] transition-colors" />
        </Link>
      ) : friendEvents.length === 0 ? (
        <Link
          href={`/${portalSlug}/community`}
          className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)]/50 hover:bg-white/[0.02] transition-colors group"
        >
          <div className="w-9 h-9 rounded-full bg-[var(--neon-cyan,#00d4e8)]/10 flex items-center justify-center shrink-0">
            <UserPlus weight="light" className="w-4 h-4 text-[var(--neon-cyan,#00d4e8)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--cream)] group-hover:text-[var(--neon-cyan,#00d4e8)] transition-colors">
              Add friends to see their plans
            </p>
            <p className="text-2xs text-[var(--soft)]">
              Follow people to see what they&apos;re going to
            </p>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--neon-cyan,#00d4e8)] transition-colors" />
        </Link>
      ) : (
        <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
          {friendEvents.map((item, idx) => {
            const ev = item.event;
            const friends = ev.friends_going || [];
            const timeLabel = getSmartTimeLabel(ev);
            const isLast = idx === friendEvents.length - 1;

            return (
              <Link
                key={`friend-${ev.id}`}
                href={`/${portalSlug}?event=${ev.id}`}
                scroll={false}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.02] group ${
                  !isLast ? "border-b border-[var(--twilight)]/30" : ""
                }`}
              >
                {/* Friend avatars (simple colored circles with initials) */}
                <div className="flex -space-x-1.5 shrink-0">
                  {friends.slice(0, 3).map((f, i) => (
                    <div
                      key={f.user_id}
                      className="w-6 h-6 rounded-full border-2 border-[var(--night)] flex items-center justify-center text-[8px] font-bold"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--neon-cyan,#00d4e8) ${40 - i * 10}%, var(--twilight))`,
                        color: "var(--cream)",
                        zIndex: 3 - i,
                      }}
                    >
                      {(f.display_name || f.username || "?")[0].toUpperCase()}
                    </div>
                  ))}
                  {friends.length > 3 && (
                    <div
                      className="w-6 h-6 rounded-full border-2 border-[var(--night)] flex items-center justify-center text-[8px] font-mono font-bold bg-[var(--twilight)] text-[var(--muted)]"
                    >
                      +{friends.length - 3}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--soft)] truncate group-hover:text-[var(--neon-cyan,#00d4e8)] transition-colors">
                    {ev.title}
                  </p>
                  <p className="text-2xs text-[var(--soft)] truncate">
                    {friends.slice(0, 2).map((f) => f.display_name || f.username).join(", ")}
                    {friends.length > 2 && ` +${friends.length - 2}`}
                    {" going"}
                  </p>
                </div>

                <span className="font-mono text-2xs text-[var(--soft)] shrink-0">{timeLabel}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Your Upcoming zone */
function UpcomingZone({
  portalSlug,
  username,
}: {
  portalSlug: string;
  username: string | null;
}) {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    async function fetchUpcoming() {
      try {
        const res = await fetch(`/api/profile/${username}?section=upcoming`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setEvents((data.events || []).slice(0, 3));
        }
      } catch {
        // Silently fail — Zone 3 is optional
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    fetchUpcoming();
    return () => { cancelled = true; };
  }, [username]);

  if (!username) return null;
  if (!loaded) return null; // Don't show skeleton — zone is optional

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <CalendarBlank weight="duotone" className="w-3.5 h-3.5 text-[var(--gold)]" />
        <h3 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
          Your Upcoming
        </h3>
      </div>

      {events.length === 0 ? (
        <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)]/50">
          <div className="w-9 h-9 rounded-full bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
            <CalendarBlank weight="light" className="w-4 h-4 text-[var(--gold)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--cream)]">
              No upcoming plans yet
            </p>
            <p className="text-2xs text-[var(--soft)]">
              RSVP to events above to build your lineup
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
          {events.map((ev, idx) => {
            const timeLabel = getSmartTimeLabel({
              start_date: ev.start_date,
              start_time: ev.start_time,
              is_all_day: ev.is_all_day,
            });
            const isLast = idx === events.length - 1;

            return (
              <Link
                key={`upcoming-${ev.id}`}
                href={`/${portalSlug}?event=${ev.id}`}
                scroll={false}
                className={`flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.02] group ${
                  !isLast ? "border-b border-[var(--twilight)]/30" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--soft)] truncate group-hover:text-[var(--gold)] transition-colors">
                    {ev.title}
                  </p>
                  <p className="text-2xs text-[var(--soft)] truncate">
                    {ev.venue_name}
                  </p>
                </div>
                <div className="shrink-0 text-right space-y-0.5">
                  <p className="font-mono text-2xs text-[var(--soft)]">{timeLabel}</p>
                  <p className="font-mono text-2xs font-medium uppercase tracking-wider text-[var(--gold)]">
                    {ev.status === "going" ? "Going" : ev.status === "interested" ? "Maybe" : "Going"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TrendingSection({ section, portalSlug }: Props) {
  const { user } = useAuth();
  const allEvents = section.items.filter(
    (i): i is CityPulseEventItem => i.item_type === "event",
  );

  // Zone 1: Popular — top events by going_count
  const popularEvents = useMemo(() => {
    return [...allEvents]
      .sort((a, b) => (b.event.going_count || 0) - (a.event.going_count || 0))
      .slice(0, 5)
      .map((i) => i.event as EnrichedEvent);
  }, [allEvents]);

  // Determine header label based on data quality
  const hasGoingData = useMemo(
    () => allEvents.some((e) => (e.event.going_count || 0) > 0),
    [allEvents],
  );
  const headerLabel = hasGoingData ? "Trending" : "Featured";

  if (allEvents.length === 0) return null;

  const heroEvent = popularEvents[0];
  const listEvents = popularEvents.slice(1, 5);

  // Extract username for Zone 3 — profile API uses username
  const username = user?.user_metadata?.username as string | null ?? null;

  return (
    <section className="space-y-6">
      {/* ── Zone 1: Popular ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fire weight="duotone" className="w-3.5 h-3.5 text-[var(--coral)]" />
            <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--coral)]">
              {headerLabel}
            </h2>
          </div>
          <Link
            href={`/${portalSlug}?view=find&type=events`}
            className="text-xs flex items-center gap-1 text-[var(--coral)] transition-colors hover:opacity-80"
          >
            See all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Hero (#1) */}
        {heroEvent && <PopularHero ev={heroEvent} portalSlug={portalSlug} />}

        {/* Grid (#2-5) — compact cards */}
        {listEvents.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2.5">
            {listEvents.map((ev, idx) => (
              <PopularCard
                key={`pop-${ev.id}`}
                ev={ev}
                rank={idx + 2}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Zone 2: Friends Are Going ── */}
      <FriendsZone
        events={allEvents}
        portalSlug={portalSlug}
        isSignedIn={!!user}
      />

      {/* ── Zone 3: Your Upcoming ── */}
      <UpcomingZone portalSlug={portalSlug} username={username} />
    </section>
  );
}
