"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  getItemTitle,
  formatItineraryTime,
  formatWalkTime,
  formatWalkDistance,
  type ItineraryItem,
} from "@/lib/itinerary-utils";
import { getCategoryColor } from "@/components/CategoryIcon";
import {
  Star,
  CalendarBlank,
  MapTrifold,
  CaretDown,
  Notebook,
  NavigationArrow,
  Copy,
} from "@phosphor-icons/react/dist/ssr";
import {
  ZONE_COLORS,
  getDangerLevel,
  getBufferLabel,
  getItemCategory,
  WalkingPersonIcon,
} from "@/lib/playbook-shared";
import AddToCalendar from "@/components/AddToCalendar";

const SharedPlaybookMap = dynamic(() => import("./SharedPlaybookMapInner"), {
  ssr: false,
  loading: () => (
    <div className="relative overflow-hidden" style={{ background: "#07070C" }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
      </div>
    </div>
  ),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SharedPlaybookViewProps {
  itinerary: {
    id: string;
    title: string;
    date: string | null;
    description: string | null;
    items: ItineraryItem[];
  };
  portalName: string;
  portalSlug: string;
}


// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SharedPlaybookView({
  itinerary,
  portalName,
  portalSlug,
}: SharedPlaybookViewProps) {
  const { items } = itinerary;
  const [mapExpanded, setMapExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select-copy for older browsers
    }
  }, []);

  const totalWalkMeters = useMemo(
    () => items.reduce((s, item) => s + (item.walk_distance_meters || 0), 0),
    [items],
  );

  const formattedDate = itinerary.date
    ? new Date(itinerary.date + "T00:00:00")
        .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
    : null;

  return (
    <div className="min-h-screen relative" style={{ background: "var(--void, #09090F)" }}>
      {/* Atmospheric background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 0%, rgba(0, 212, 232, 0.025), transparent 50%),
            radial-gradient(ellipse at 80% 100%, rgba(255, 217, 61, 0.015), transparent 40%)
          `,
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: "rgba(9, 9, 11, 0.82)",
          backdropFilter: "blur(20px) saturate(180%)",
          borderColor: "rgba(37, 37, 48, 0.6)",
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 py-3">
          <div
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ color: "var(--neon-cyan, #00D4E8)" }}
          >
            <Notebook size={20} weight="light" />
          </div>

          <div className="flex-1 min-w-0">
            <h1
              className="text-[15px] font-semibold truncate"
              style={{ color: "var(--cream, #F5F0E8)", fontFamily: "var(--font-outfit)" }}
            >
              {itinerary.title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {formattedDate && (
                <span
                  className="flex items-center gap-1 text-[10px]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--muted, #8B8B9E)" }}
                >
                  <CalendarBlank size={10} weight="light" />
                  {formattedDate.toUpperCase()}
                </span>
              )}
              <span
                className="text-[10px]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--muted, #8B8B9E)" }}
              >
                {items.length} STOP{items.length !== 1 ? "S" : ""}
                {totalWalkMeters > 0 ? ` \u00b7 ${formatWalkDistance(totalWalkMeters)}` : ""}
              </span>
            </div>
          </div>

          <Link
            href={`/${portalSlug}`}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all"
            style={{
              color: "var(--neon-cyan, #00D4E8)",
              border: "1px solid rgba(0, 212, 232, 0.25)",
              background: "rgba(0, 212, 232, 0.04)",
            }}
          >
            <NavigationArrow size={13} />
            Explore {portalName}
          </Link>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="relative z-10 max-w-5xl mx-auto lg:flex lg:gap-0">
        {/* LEFT: Timeline */}
        <main className="flex-1 lg:max-w-xl px-4 pt-4 pb-16">
          {/* Description */}
          {itinerary.description && (
            <p
              className="text-sm mb-5 leading-relaxed"
              style={{ color: "var(--muted, #8B8B9E)" }}
            >
              {itinerary.description}
            </p>
          )}

          {/* Mobile map toggle */}
          <div className="lg:hidden mb-5">
            <button
              onClick={() => setMapExpanded(!mapExpanded)}
              className="flex items-center gap-1.5 mb-2 transition-colors hover:opacity-80"
              style={{ color: "var(--muted, #8B8B9E)" }}
            >
              <MapTrifold size={13} className="opacity-40" />
              <span className="text-[11px] font-medium" style={{ fontFamily: "var(--font-outfit)" }}>
                {mapExpanded ? "Hide route" : "Show route"}
              </span>
              <CaretDown
                size={10}
                style={{
                  transform: mapExpanded ? "rotate(0)" : "rotate(-90deg)",
                  transition: "transform 0.3s ease",
                }}
              />
            </button>
            {mapExpanded && <SharedPlaybookMap items={items} className="rounded-xl h-[180px] border border-white/[0.04]" />}
          </div>

          {/* Empty state */}
          {items.length === 0 && (
            <div className="text-center py-16">
              <p className="text-sm text-white/40">This playbook has no stops yet</p>
            </div>
          )}

          {/* Timeline */}
          {items.length > 0 && (
            <div className="relative">
              {/* Spine line */}
              <div
                className="absolute left-[27px] top-4 bottom-4 w-px"
                style={{
                  background: `linear-gradient(to bottom,
                    transparent 0%,
                    rgba(0, 212, 232, 0.12) 6%,
                    rgba(0, 212, 232, 0.18) 30%,
                    rgba(255, 217, 61, 0.14) 50%,
                    rgba(0, 212, 232, 0.18) 70%,
                    rgba(0, 212, 232, 0.12) 94%,
                    transparent 100%
                  )`,
                }}
              />

              {items.map((item, idx) => {
                const title = getItemTitle(item);
                const time = item.start_time ? formatItineraryTime(item.start_time) : "";
                const walkTime = formatWalkTime(item.walk_time_minutes);
                const walkDist = formatWalkDistance(item.walk_distance_meters);
                const isAnchor = idx === 0;
                const category = getItemCategory(item);
                const accentColor = isAnchor ? "#FFD93D" : getCategoryColor(category);

                // Danger level for connector
                const walkMin = item.walk_time_minutes || 0;
                const duration = item.duration_minutes || 60;
                const bufferMinutes = duration - walkMin;
                const dangerLevel = walkMin > 0 ? getDangerLevel(walkMin, bufferMinutes) : "safe";

                return (
                  <div key={item.id}>
                    {/* Walk time connector */}
                    {idx > 0 && (item.walk_time_minutes != null || item.walk_distance_meters != null) && (
                      <div className="relative flex gap-3 py-1">
                        <div className="shrink-0 w-[54px]" />
                        <div className="shrink-0 w-6 flex justify-center">
                          <div className="w-px h-full" style={{ background: "rgba(0, 212, 232, 0.1)" }} />
                        </div>
                        <div className="flex-1 flex flex-col gap-1 py-0.5">
                          <div className="flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ color: "var(--muted, #8B8B9E)", opacity: 0.35 }}>
                              <path d="M7.875 1.75C8.358 1.75 8.75 1.358 8.75 0.875C8.75 0.392 8.358 0 7.875 0C7.392 0 7 0.392 7 0.875C7 1.358 7.392 1.75 7.875 1.75Z" fill="currentColor" />
                              <path d="M9.625 4.375L7.875 2.625L5.25 5.25M7 7L5.25 10.5L6.5625 10.5M7 7L8.75 10.5L7.4375 10.5M7 7L7.875 5.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span
                              className="text-[10px]"
                              style={{ fontFamily: "var(--font-mono)", color: "var(--muted, #8B8B9E)", opacity: 0.45 }}
                            >
                              {walkTime}{walkDist ? ` \u00b7 ${walkDist}` : ""}
                            </span>
                          </div>
                          {walkMin > 0 && (
                            <div
                              className="inline-flex items-center gap-1.5 self-start px-2 py-0.5 rounded-md text-[10px]"
                              style={{
                                fontFamily: "var(--font-mono)",
                                background: ZONE_COLORS[dangerLevel].bg,
                                border: `1px solid ${ZONE_COLORS[dangerLevel].border}`,
                                color: ZONE_COLORS[dangerLevel].text,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: ZONE_COLORS[dangerLevel].dot }}
                              />
                              {getBufferLabel(dangerLevel, Math.max(0, bufferMinutes))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stop block */}
                    <div className="relative flex gap-3">
                      {/* Time column */}
                      <div className="shrink-0 w-[54px] flex flex-col items-end pt-3">
                        <span
                          className="text-[11px] leading-none"
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: isAnchor ? "var(--gold, #D4A843)" : "var(--muted, #8B8B9E)",
                            opacity: isAnchor ? 1 : 0.7,
                          }}
                        >
                          {time}
                        </span>
                      </div>

                      {/* Spine dot */}
                      <div className="shrink-0 relative z-10 flex items-start pt-3">
                        {isAnchor ? (
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[12px]"
                            style={{
                              background: "rgba(255, 217, 61, 0.15)",
                              border: "2px solid rgba(255, 217, 61, 0.55)",
                              color: "var(--gold, #D4A843)",
                              boxShadow: "0 0 16px rgba(255, 217, 61, 0.3)",
                            }}
                          >
                            <Star size={12} weight="fill" />
                          </div>
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                            style={{
                              fontFamily: "var(--font-mono)",
                              background: "var(--night, #0F0F14)",
                              border: `2px solid ${accentColor}40`,
                              color: accentColor,
                            }}
                          >
                            {idx + 1}
                          </div>
                        )}
                      </div>

                      {/* Card */}
                      <div className="flex-1 min-w-0 py-2">
                        <div
                          className={`p-3 rounded-xl border ${
                            isAnchor
                              ? "bg-[var(--gold,#f59e0b)]/5 border-[var(--gold,#f59e0b)]/20"
                              : "bg-white/[0.02] border-white/5"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{title}</p>
                            {item.event?.venue_name && (
                              <p className="text-xs text-white/40 mt-0.5 truncate">
                                {(item.event as { venue_name?: string }).venue_name}
                              </p>
                            )}
                            {item.venue?.neighborhood && (
                              <p className="text-xs text-white/40 mt-0.5 truncate">
                                {item.venue.neighborhood}
                              </p>
                            )}
                            {item.item_type === "custom" && item.custom_description && (
                              <p className="text-xs text-white/40 mt-0.5 truncate">
                                {item.custom_description}
                              </p>
                            )}
                          </div>

                          {/* Duration chip */}
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className="px-2 py-0.5 rounded text-[10px]"
                              style={{
                                fontFamily: "var(--font-mono)",
                                background: `${accentColor}0D`,
                                color: `${accentColor}BB`,
                              }}
                            >
                              {item.duration_minutes} min
                            </span>
                            {isAnchor && (
                              <span
                                className="flex items-center gap-1 text-[9px] text-white/30"
                                style={{ fontFamily: "var(--font-mono)" }}
                              >
                                <Star size={8} weight="fill" className="text-[var(--gold)]" /> Anchor
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CTAs */}
          <div className="mt-10 space-y-3">
            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border text-sm font-medium transition-all hover:brightness-110"
              style={{
                color: "var(--gold, #D4A843)",
                borderColor: "rgba(212, 168, 67, 0.25)",
                background: "rgba(212, 168, 67, 0.06)",
              }}
            >
              <Copy size={16} />
              {copied ? "Copied!" : "Share this playbook"}
            </button>

            {/* Add to Calendar — uses first item's date/time */}
            {itinerary.date && items.length > 0 && (
              <div className="[&>div]:w-full">
                <AddToCalendar
                  title={itinerary.title}
                  date={itinerary.date}
                  time={items[0].start_time}
                  venue={items[0].venue?.name || items[0].event?.venue_name || undefined}
                />
              </div>
            )}

            {/* Explore CTA */}
            <div className="text-center pt-2">
              <Link
                href={`/${portalSlug}/playbook`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium transition-all hover:brightness-110"
                style={{
                  background: "var(--gold, #D4A843)",
                  color: "var(--void, #09090F)",
                }}
              >
                <NavigationArrow size={16} />
                Start planning your own outing
              </Link>
              <p className="text-xs text-white/20 mt-3">
                Powered by LostCity
              </p>
            </div>
          </div>
        </main>

        {/* RIGHT: Map sidebar (desktop) */}
        <aside className="hidden lg:block lg:w-[400px] lg:shrink-0">
          <div
            className="sticky top-[57px] h-[calc(100vh-57px)] border-l"
            style={{ borderColor: "rgba(37, 37, 48, 0.4)" }}
          >
            <SharedPlaybookMap items={items} className="h-full" />
          </div>
        </aside>
      </div>
    </div>
  );
}
