"use client";

/**
 * Trending section — numbered leaderboard with scope toggle.
 *
 * Design: Coral header, 3-button scope toggle (Community / Friends / For You),
 * numbered leaderboard with rank colors (1=coral, 2=gold, 3+=muted),
 * top 2 items get thumbnails, going count in mono text.
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CityPulseSection, CityPulseEventItem } from "@/lib/city-pulse/types";
import type { FeedEventData } from "@/components/EventCard";
import Image from "@/components/SmartImage";
import { TrendUp, ArrowRight, Users, Star, UserCircle } from "@phosphor-icons/react";

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

type Scope = "community" | "friends" | "for_you";

const SCOPE_CONFIG: { id: Scope; label: string; icon: typeof Users }[] = [
  { id: "community", label: "Community", icon: Users },
  { id: "friends", label: "Friends", icon: UserCircle },
  { id: "for_you", label: "For You", icon: Star },
];

export default function TrendingSection({ section, portalSlug }: Props) {
  const allEvents = section.items.filter((i) => i.item_type === "event");
  const [scope, setScope] = useState<Scope>("community");

  const hasFriends = useMemo(
    () => allEvents.some((e) => e.item_type === "event" && e.event.friends_going?.length),
    [allEvents],
  );
  const hasForYou = useMemo(
    () => allEvents.some((e) => e.item_type === "event" && e.event.score),
    [allEvents],
  );

  const events = useMemo(() => {
    let filtered = allEvents.filter((i) => i.item_type === "event");

    switch (scope) {
      case "community":
        filtered.sort((a, b) => {
          const aCount = a.item_type === "event" ? (a.event.going_count || 0) : 0;
          const bCount = b.item_type === "event" ? (b.event.going_count || 0) : 0;
          return bCount - aCount;
        });
        break;
      case "friends":
        filtered = filtered.filter(
          (e) => e.item_type === "event" && e.event.friends_going?.length,
        );
        filtered.sort((a, b) => {
          const aFriends = a.item_type === "event" ? (a.event.friends_going?.length || 0) : 0;
          const bFriends = b.item_type === "event" ? (b.event.friends_going?.length || 0) : 0;
          return bFriends - aFriends;
        });
        break;
      case "for_you":
        filtered.sort((a, b) => {
          const aScore = a.item_type === "event" ? (a.event.score || 0) : 0;
          const bScore = b.item_type === "event" ? (b.event.score || 0) : 0;
          return bScore - aScore;
        });
        break;
    }

    return filtered.slice(0, 8);
  }, [allEvents, scope]);

  // When no events have going data, soften the ranked appearance
  const hasGoingData = useMemo(
    () => allEvents.some((e) => e.item_type === "event" && (e.event.going_count || 0) > 0),
    [allEvents],
  );

  if (allEvents.length === 0) return null;

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendUp weight="bold" className="w-3.5 h-3.5 text-[var(--coral)]" />
          <h2 className="font-mono text-[0.6875rem] font-bold tracking-[0.12em] uppercase text-[var(--coral)]">
            {hasGoingData ? "Trending" : "Featured"}
          </h2>
        </div>
        <Link
          href={`/${portalSlug}?view=find&type=events`}
          className="text-[0.6875rem] flex items-center gap-1 text-[var(--coral)] transition-colors hover:opacity-80"
        >
          All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Scope toggle — only show when multiple scopes have data */}
      {(hasFriends || hasForYou) && (
        <div className="flex items-center gap-1 mb-3 p-0.5 rounded-full bg-[var(--night)] border border-[var(--twilight)]/40 w-fit">
          {SCOPE_CONFIG.map((s) => {
            if (s.id === "friends" && !hasFriends) return null;
            if (s.id === "for_you" && !hasForYou) return null;
            const isActive = scope === s.id;
            const ScopeIcon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setScope(s.id)}
                className={[
                  "flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[0.5625rem] font-medium tracking-wide transition-all",
                  isActive
                    ? "bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/30"
                    : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent",
                ].join(" ")}
              >
                <ScopeIcon weight={isActive ? "fill" : "regular"} className="w-3 h-3" />
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Leaderboard */}
      <div className="rounded-xl overflow-hidden border border-[var(--twilight)]/40 bg-[var(--night)]">
        {events.map((item, index) => {
          if (item.item_type !== "event") return null;
          const ev = item.event;
          const rank = index + 1;
          const goingCount = (ev as FeedEventData).going_count || 0;
          const friendsGoing = (item as CityPulseEventItem).event.friends_going?.length || 0;
          const isTop = rank <= 2;
          const isLast = index === events.length - 1;

          const rankColor = !hasGoingData
            ? "var(--muted)"
            : rank === 1
              ? "var(--coral)"
              : rank === 2
                ? "var(--gold)"
                : "var(--muted)";

          return (
            <Link
              key={`trend-${ev.id}`}
              href={`/${portalSlug}?event=${ev.id}`}
              scroll={false}
              className={[
                "flex items-center gap-3 py-2.5 px-3 min-h-[48px] transition-colors hover:bg-white/[0.02] group",
                !isLast && "border-b border-[var(--twilight)]/30",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* Rank */}
              <span
                className="font-mono text-base font-black w-6 text-center shrink-0 tabular-nums"
                style={{ color: rankColor }}
              >
                {rank}
              </span>

              {/* Thumbnail (top 2 only) */}
              {isTop && ev.image_url && (
                <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <Image
                    src={ev.image_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="40px"
                    blurhash={ev.blurhash}
                  />
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={[
                    "text-[0.8125rem] font-medium truncate group-hover:text-[var(--coral)] transition-colors",
                    isTop ? "text-[var(--cream)]" : "text-[var(--soft)]",
                  ].join(" ")}
                >
                  {ev.title}
                </p>
                <p className="text-[0.6875rem] text-[var(--muted)] truncate">
                  {ev.venue?.name}
                </p>
              </div>

              {/* Social proof / metadata */}
              {scope === "friends" && friendsGoing > 0 ? (
                <span className="flex items-center gap-1 font-mono text-[0.5625rem] shrink-0 text-[var(--coral)]">
                  <Users weight="fill" className="w-2.5 h-2.5" />
                  {friendsGoing} friend{friendsGoing !== 1 ? "s" : ""}
                </span>
              ) : goingCount > 0 ? (
                <span className="font-mono text-[0.5625rem] shrink-0 text-[var(--coral)]">
                  {goingCount} going
                </span>
              ) : ev.category ? (
                <span className="font-mono text-[0.5rem] shrink-0 text-[var(--muted)] uppercase tracking-wider">
                  {ev.category.replace(/_/g, " ")}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
