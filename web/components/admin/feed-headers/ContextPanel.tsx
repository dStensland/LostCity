"use client";

/**
 * ContextPanel — Shows city pulse data for the selected day × slot.
 * Gives editorial context for writing headlines.
 */

import { useState, useEffect } from "react";
import { Lightning, TrendUp } from "@phosphor-icons/react";

interface ContextPanelProps {
  portalSlug: string;
  day: string;
  slot: string;
}

interface CityPulseStats {
  total_events: number;
  trending_event: string | null;
  top_categories: string[];
  weather?: {
    temperature_f: number;
    condition: string;
  } | null;
  active_holidays: string[];
  active_festivals: string[];
  day_theme?: string;
}

export default function ContextPanel({
  portalSlug,
  day,
  slot,
}: ContextPanelProps) {
  const [stats, setStats] = useState<CityPulseStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/portals/${portalSlug}/city-pulse?day=${day}&time_slot=${slot}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setStats({
          total_events: data.events_pulse?.total_active ?? 0,
          trending_event: data.events_pulse?.trending_event ?? null,
          top_categories: data.context?.top_categories ?? [],
          weather: data.context?.weather ?? null,
          active_holidays:
            data.context?.active_holidays?.map(
              (h: { title: string }) => h.title
            ) ?? [],
          active_festivals:
            data.context?.active_festivals?.map(
              (f: { name: string }) => f.name
            ) ?? [],
          day_theme: data.context?.day_theme,
        });
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [portalSlug, day, slot]);

  const slotLabel = slot.replace(/_/g, " ");
  const dayLabel = day.charAt(0).toUpperCase() + day.slice(1);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] p-4">
        <h3 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)] mb-3">
          City Context
        </h3>
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin w-5 h-5 border-2 border-[var(--coral)] border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] p-4">
      <h3 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)] mb-3">
        City Context
      </h3>
      <p className="font-mono text-xs text-[var(--soft)] mb-3">
        {dayLabel} {slotLabel}
      </p>

      {stats ? (
        <div className="space-y-3">
          {/* Event pulse */}
          <div className="flex items-center gap-2">
            <Lightning weight="fill" className="w-4 h-4 text-[var(--coral)]" />
            <span className="font-mono text-sm text-[var(--cream)]">
              {stats.total_events}
            </span>
            <span className="font-mono text-xs text-[var(--muted)]">
              active events
            </span>
          </div>

          {/* Trending */}
          {stats.trending_event && (
            <div className="flex items-start gap-2">
              <TrendUp weight="bold" className="w-4 h-4 text-[var(--gold)] mt-0.5" />
              <span className="font-mono text-xs text-[var(--soft)] line-clamp-2">
                {stats.trending_event}
              </span>
            </div>
          )}

          {/* Day theme */}
          {stats.day_theme && (
            <div>
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
                Theme
              </span>
              <p className="font-mono text-xs text-[var(--cream)] mt-0.5">
                {stats.day_theme.replace(/_/g, " ")}
              </p>
            </div>
          )}

          {/* Weather */}
          {stats.weather && (
            <div>
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
                Weather
              </span>
              <p className="font-mono text-xs text-[var(--cream)] mt-0.5">
                {Math.round(stats.weather.temperature_f)}°F — {stats.weather.condition}
              </p>
            </div>
          )}

          {/* Holidays / Festivals */}
          {stats.active_holidays.length > 0 && (
            <div>
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
                Holidays
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {stats.active_holidays.map((h) => (
                  <span
                    key={h}
                    className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-2xs"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {stats.active_festivals.length > 0 && (
            <div>
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
                Festivals
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {stats.active_festivals.map((f) => (
                  <span
                    key={f}
                    className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-2xs"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top categories */}
          {stats.top_categories.length > 0 && (
            <div>
              <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
                Top Categories
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {stats.top_categories.slice(0, 5).map((cat) => (
                  <span
                    key={cat}
                    className="px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--soft)] font-mono text-2xs"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="font-mono text-xs text-[var(--muted)] italic">
          No context data available
        </p>
      )}
    </div>
  );
}
