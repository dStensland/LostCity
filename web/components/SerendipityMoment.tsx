"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatTimeSplit } from "@/lib/formats";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import CategoryIcon, { getCategoryColor, CATEGORY_CONFIG, type CategoryType } from "./CategoryIcon";

type SerendipityEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  venue: {
    name: string;
    neighborhood: string | null;
  } | null;
};

type SerendipityType = "hidden_gem" | "try_something_new" | "neighborhood_spotlight" | "free_finds";

const SERENDIPITY_CONFIGS: Record<SerendipityType, {
  icon: string;
  title: string;
  subtitle: string;
  gradient: string;
}> = {
  hidden_gem: {
    icon: "💎",
    title: "Hidden Gem",
    subtitle: "Discover something special",
    gradient: "from-purple-500/20 to-transparent",
  },
  try_something_new: {
    icon: "🎲",
    title: "Try Something New",
    subtitle: "Step outside your comfort zone",
    gradient: "from-cyan-500/20 to-transparent",
  },
  neighborhood_spotlight: {
    icon: "📍",
    title: "Neighborhood Spotlight",
    subtitle: "Explore a different part of town",
    gradient: "from-amber-500/20 to-transparent",
  },
  free_finds: {
    icon: "🎁",
    title: "Free Finds",
    subtitle: "Great experiences, zero cost",
    gradient: "from-green-500/20 to-transparent",
  },
};

function getSmartDate(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

interface Props {
  type: SerendipityType;
  event: SerendipityEvent;
  portalSlug?: string;
  onDismiss?: () => void;
}

export default function SerendipityMoment({ type, event, portalSlug, onDismiss }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const config = SERENDIPITY_CONFIGS[type];
  const categoryColor = event.category ? getCategoryColor(event.category) : "var(--neon-magenta)";
  const { time, period } = formatTimeSplit(event.start_time, event.is_all_day);

  useEffect(() => {
    // Animate in after mount
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsVisible(false);
    setTimeout(() => onDismiss?.(), 300);
  };

  return (
    <div
      className={`relative my-6 transition-all duration-500 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {/* Decorative line */}
      <div className="absolute left-1/2 -translate-x-1/2 -top-3 w-12 h-px bg-gradient-to-r from-transparent via-[var(--twilight)] to-transparent" />

      <div
        className={`relative rounded-2xl overflow-hidden border border-[var(--twilight)] bg-gradient-to-br ${config.gradient} backdrop-blur-sm`}
      >
        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[var(--void)]/50 flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--void)]/80 transition-colors z-10"
            aria-label="Dismiss"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h3 className="font-mono text-xs font-medium text-[var(--cream)] uppercase tracking-wider">
              {config.title}
            </h3>
            <p className="text-[0.65rem] text-[var(--muted)]">{config.subtitle}</p>
          </div>
        </div>

        {/* Event card */}
        <Link
          href={portalSlug ? `/${portalSlug}/events/${event.id}` : `/events/${event.id}`}
          className="block mx-3 mb-3 p-3 rounded-xl bg-[var(--card-bg)] border border-[var(--twilight)] hover:border-[var(--neon-magenta)]/30 transition-all group card-atmospheric"
          style={{
            "--glow-color": categoryColor,
            borderLeftWidth: "3px",
            borderLeftColor: categoryColor,
          } as React.CSSProperties}
        >
          <div className="flex items-start gap-3">
            {/* Time block */}
            <div className="flex-shrink-0 w-12 text-center">
              <div className="font-mono text-xs text-[var(--soft)]">{time}</div>
              {period && <div className="font-mono text-[0.5rem] text-[var(--muted)]">{period}</div>}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {event.category && (
                  <CategoryIcon type={event.category} size={14} className="opacity-70" />
                )}
                <span className="font-medium text-sm text-[var(--cream)] group-hover:text-[var(--neon-magenta)] transition-colors line-clamp-1">
                  {event.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[0.65rem] text-[var(--muted)] font-mono">
                <span>{getSmartDate(event.start_date)}</span>
                {event.venue && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="truncate">{event.venue.name}</span>
                  </>
                )}
                {event.is_free && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="text-[var(--neon-green)]">Free</span>
                  </>
                )}
              </div>
            </div>

            {/* Arrow */}
            <svg className="w-4 h-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>

      {/* Decorative line */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-3 w-12 h-px bg-gradient-to-r from-transparent via-[var(--twilight)] to-transparent" />
    </div>
  );
}

// Helper to select a random serendipity type
export function getRandomSerendipityType(event: SerendipityEvent): SerendipityType {
  if (event.is_free) {
    return Math.random() > 0.5 ? "free_finds" : "hidden_gem";
  }
  const types: SerendipityType[] = ["hidden_gem", "try_something_new", "neighborhood_spotlight"];
  return types[Math.floor(Math.random() * types.length)];
}
