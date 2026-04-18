"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, ArrowRight } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import { getNeighborhoodDescription, getNeighborhoodByName } from "@/config/neighborhoods";
import { getNeighborhoodColor } from "@/lib/neighborhood-colors";
import { formatTime, decodeHtmlEntities } from "@/lib/formats";
import { hexToRgb, formatCategoryLabel } from "@/lib/neighborhood-utils";
import { useEntityLinkOptions } from "@/lib/link-context";
import { buildEventUrl, buildNeighborhoodUrl } from "@/lib/entity-urls";
import type { NeighborhoodActivity } from "./NeighborhoodMap";

type DrillDownEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  is_all_day: boolean;
  category_id: string | null;
  is_free: boolean;
  venue: { id: number; name: string; slug: string; neighborhood: string | null } | null;
};

interface Props {
  slug: string;
  name: string;
  portalSlug: string;
  activity: NeighborhoodActivity;
  onClose: () => void;
}

function getEventSectionLabel(name: string): string {
  const hour = new Date().getHours();
  if (hour >= 22) return `Late night in ${name}`;
  if (hour >= 17) return `Tonight in ${name}`;
  return `Today in ${name}`;
}

function DrillDownContent({
  slug,
  name,
  portalSlug,
  activity,
  onClose,
  events,
  loading,
}: Props & { events: DrillDownEvent[]; loading: boolean }) {
  const description = getNeighborhoodDescription(slug);
  const hasDetailPage = !!getNeighborhoodByName(name);
  const { context, existingParams } = useEntityLinkOptions();
  const exploreHref = hasDetailPage
    ? buildNeighborhoodUrl(slug, portalSlug, context, existingParams)
    : `/${portalSlug}/find?neighborhood=${encodeURIComponent(name)}`;

  // Derive the neighborhood color and its RGB components for dynamic tinting
  const color = getNeighborhoodColor(name);
  const { r, g, b } = hexToRgb(color);
  const rgb = `${r}, ${g}, ${b}`;

  const todayCount = activity.eventsTodayCount;
  const weekCount = activity.eventsWeekCount;
  const goingCount = activity.goingCount;
  const venueCount = activity.venueCount;
  const topCats = activity.topCategories.slice(0, 3);
  const sectionLabel = getEventSectionLabel(name);

  return (
    <>
      {/* Header — color accent bar */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[var(--twilight)]">
        {/* Left accent bar in neighborhood color */}
        <div
          className="w-1 self-stretch rounded-sm flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="min-w-0 flex-1">
          <h2
            className="text-lg font-bold uppercase tracking-wide text-[var(--cream)] leading-tight"
          >
            {name}
          </h2>
          {description && (
            <p className="mt-1 text-xs text-[var(--soft)] leading-snug line-clamp-2">{description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--twilight)] transition-colors"
          aria-label="Close"
        >
          <X weight="bold" className="w-4 h-4 text-[var(--muted)]" />
        </button>
      </div>

      {/* Activity strip */}
      <div className="flex items-center gap-3 px-5 mt-4">
        {/* Events today — coral */}
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: "var(--coral)" }}
          />
          <span className="text-xs font-semibold" style={{ color: "var(--coral)" }}>
            {todayCount} {todayCount === 1 ? "event" : "events"} today
          </span>
        </div>

        {/* Going count — gold, only if > 0 */}
        {goingCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: "#FFD93D" }}
            />
            <span className="text-xs font-semibold" style={{ color: "#FFD93D" }}>
              {goingCount} going
            </span>
          </div>
        )}

        {/* Week count — only if meaningfully different from today */}
        {weekCount > todayCount && (
          <span className="text-2xs text-[var(--muted)]">
            {weekCount} this week
          </span>
        )}
      </div>

      {/* Vibe pills — tinted in neighborhood color */}
      {topCats.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-5 mt-3">
          {topCats.map((cat) => (
            <span
              key={cat}
              className="text-2xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
              style={{
                backgroundColor: `rgba(${rgb}, 0.08)`,
                border: `1px solid rgba(${rgb}, 0.20)`,
                color: color,
              }}
            >
              {formatCategoryLabel(cat)}
            </span>
          ))}
        </div>
      )}

      {/* Event list */}
      <div className="px-5 mt-4">
        <div className="flex items-center justify-between mb-2">
          <span
            className="font-mono text-xs font-bold tracking-[0.12em] uppercase"
            style={{ color: color }}
          >
            {sectionLabel}
          </span>
          <Link
            href={`/${portalSlug}/find?neighborhood=${encodeURIComponent(name)}`}
            className="text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: color }}
          >
            See all →
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 border-[var(--twilight)] animate-spin" style={{ borderTopColor: color }} />
          </div>
        ) : events.length > 0 ? (
          <ul className="divide-y divide-[var(--twilight)]/50">
            {events.map((ev) => (
              <li key={ev.id}>
                <Link
                  href={buildEventUrl(ev.id, portalSlug, context, existingParams)}
                  className="flex items-stretch gap-2.5 py-2.5 group"
                >
                  {/* Left accent bar per event row */}
                  <div
                    className="w-1 self-stretch rounded-sm flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                    style={{ backgroundColor: color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--cream)] leading-snug group-hover:text-[var(--cream)] transition-colors line-clamp-1">
                      {decodeHtmlEntities(ev.title)}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {ev.venue && (
                        <span className="text-xs text-[var(--muted)] truncate">{ev.venue.name}</span>
                      )}
                      {ev.start_time && (
                        <>
                          {ev.venue && <Dot />}
                          <span className="text-xs text-[var(--muted)] flex-shrink-0">
                            {formatTime(ev.start_time, ev.is_all_day)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ArrowRight weight="bold" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-30 group-hover:opacity-100 transition-opacity" style={{ color: color }} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)] py-4">Nothing happening in {name} right now.</p>
        )}
      </div>

      {/* Explore CTA — elevated with neighborhood color */}
      <div className="px-5 mt-4 pb-5">
        <Link
          href={exploreHref}
          className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl transition-opacity hover:opacity-90 group"
          style={{
            backgroundColor: `rgba(${rgb}, 0.08)`,
            border: `1.5px solid rgba(${rgb}, 0.30)`,
          }}
        >
          <div className="min-w-0">
            <span
              className="font-bold text-xs uppercase tracking-wide text-[var(--cream)]"
            >
              Explore {name}
            </span>
            <p className="text-2xs text-[var(--muted)] mt-0.5">
              {todayCount} {todayCount === 1 ? "event" : "events"} · {venueCount} {venueCount === 1 ? "spot" : "spots"}
            </p>
          </div>
          <ArrowRight weight="bold" className="w-3.5 h-3.5 flex-shrink-0" style={{ color: color }} />
        </Link>
      </div>
    </>
  );
}

export default function NeighborhoodDrillDown({ slug, name, portalSlug, activity, onClose }: Props) {
  const [events, setEvents] = useState<DrillDownEvent[]>([]);
  const [loading, setLoading] = useState(true);

  /* eslint-disable react-hooks/set-state-in-effect --
     Fetch-on-slug-change loading pattern: clears events, flips loading
     on, fetches, resolves both to final values. Cascade bounded — none
     of events/loading is in the dep array ([slug, name, portalSlug]). */
  useEffect(() => {
    setLoading(true);
    setEvents([]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    const params = new URLSearchParams({
      neighborhood: name,
      limit: "5",
    });

    fetch(`/api/neighborhoods/events?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`neighborhood events fetch failed: ${res.status}`);
        return res.json() as Promise<{ events: DrillDownEvent[] }>;
      })
      .then((data) => {
        setEvents(data.events ?? []);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("[NeighborhoodDrillDown] Failed to fetch events:", err);
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [slug, name, portalSlug]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const sharedProps = { slug, name, portalSlug, activity, onClose, events, loading };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="sm:hidden fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile bottom sheet */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-50 max-h-[70vh] bg-[var(--void)] border-t border-[var(--twilight)] rounded-t-2xl shadow-2xl overflow-y-auto">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-12 h-1 rounded-full bg-[var(--twilight)]" />
        </div>
        <DrillDownContent {...sharedProps} />
      </div>

      {/* Desktop side panel — rendered inline in the flex layout from parent */}
      <div className="hidden sm:flex flex-col w-[320px] lg:w-[360px] flex-shrink-0 h-full border-l border-[var(--twilight)] bg-[var(--void)] overflow-y-auto rounded-r-xl">
        <DrillDownContent {...sharedProps} />
      </div>
    </>
  );
}

export type { Props as NeighborhoodDrillDownProps };
