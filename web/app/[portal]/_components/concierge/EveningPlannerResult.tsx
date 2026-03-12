"use client";
/* eslint-disable @next/next/no-img-element */

import { useMemo } from "react";
import type { BuiltEveningResponse, EveningStop } from "@/lib/concierge/evening-vibes";
import { VIBE_MAP } from "@/lib/concierge/evening-vibes";

interface EveningPlannerResultProps {
  result: BuiltEveningResponse;
  portalSlug: string;
  onSwapStop: (stopIndex: number) => void;
  onRemoveStop: (stopIndex: number) => void;
}

function formatTimeParts(hhmm: string): { hour: string; minutes: string; period: string } | null {
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return { hour: String(hour12), minutes: m.toString().padStart(2, "0"), period };
}

function formatTime(hhmm: string): string {
  const parts = formatTimeParts(hhmm);
  if (!parts) return "TBA";
  return `${parts.hour}:${parts.minutes} ${parts.period}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function buildGoogleMapsUrl(stops: EveningStop[]): string | null {
  if (stops.length < 2) return null;
  const origin = `${stops[0].venue.lat},${stops[0].venue.lng}`;
  const destination = `${stops[stops.length - 1].venue.lat},${stops[stops.length - 1].venue.lng}`;
  const waypoints = stops
    .slice(1, -1)
    .map((s) => `${s.venue.lat},${s.venue.lng}`)
    .join("|");

  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=walking`;
  if (waypoints) url += `&waypoints=${waypoints}`;
  return url;
}

export default function EveningPlannerResult({
  result,
  portalSlug: _portalSlug,
  onSwapStop,
  onRemoveStop,
}: EveningPlannerResultProps) {
  void _portalSlug; // Reserved for Save to Playbook navigation
  const vibeConfig = useMemo(() => VIBE_MAP.get(result.vibe), [result.vibe]);
  const mapsUrl = useMemo(() => buildGoogleMapsUrl(result.stops), [result.stops]);

  const handleShare = async () => {
    if (!navigator.share) return;
    const stopList = result.stops
      .map((s) => `${formatTime(s.time)} - ${s.event?.title || s.venue.name}`)
      .join("\n");

    try {
      await navigator.share({
        title: `My ${vibeConfig?.label || ""} Evening`,
        text: `${formatDate(result.date)}\n\n${stopList}`,
      });
    } catch {
      // User cancelled share
    }
  };

  if (result.stops.length === 0) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="font-display text-xl text-[var(--hotel-charcoal)]">
          No stops found
        </p>
        <p className="text-sm font-body text-[var(--hotel-stone)]">
          Try a different vibe or date for more options.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h3 className="font-display text-2xl text-[var(--hotel-charcoal)]">
          Your Evening
        </h3>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {vibeConfig && (
            <span className="text-xs font-body px-3 py-1 rounded-full bg-[var(--hotel-champagne)]/10 border border-[var(--hotel-champagne)]/30 text-[var(--hotel-charcoal)]">
              {vibeConfig.emoji} {vibeConfig.label}
            </span>
          )}
          <span className="text-sm font-body text-[var(--hotel-stone)]">
            {formatDate(result.date)}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {result.stops.map((stop, idx) => {
          const timeParts = formatTimeParts(stop.time);
          const hasImage = !!(stop.event?.image_url || stop.venue.image_url);
          const imageUrl = stop.event?.image_url || stop.venue.image_url || "";

          return (
            <div key={`${stop.slot}-${stop.venue.id}`}>
              {/* Walk connector */}
              {stop.walkFromPrevious && stop.walkFromPrevious.minutes > 0 && (
                <div className="flex items-center gap-2 py-2 pl-[68px]">
                  <div className="absolute left-[31px] w-px border-l-2 border-dashed border-[var(--hotel-sand)] h-8" />
                  <span className="text-xs font-body text-[var(--hotel-stone)]">
                    🚶 {stop.walkFromPrevious.minutes} min walk
                  </span>
                </div>
              )}

              {/* Stop row */}
              <div className="flex gap-4 mb-3">
                {/* Time rail */}
                <div className="flex-shrink-0 w-[60px] flex flex-col items-end pt-2">
                  {timeParts ? (
                    <div className="text-right">
                      <div className="font-display text-xl font-bold text-[var(--hotel-charcoal)] leading-none">
                        {timeParts.hour}:{timeParts.minutes}
                      </div>
                      <div className="font-body text-2xs font-medium uppercase tracking-[0.12em] text-[var(--hotel-stone)] mt-0.5">
                        {timeParts.period}
                      </div>
                    </div>
                  ) : (
                    <div className="font-display text-xl font-bold text-[var(--hotel-charcoal)]">
                      TBA
                    </div>
                  )}
                  {/* Timeline dot */}
                  <div className="relative flex justify-end mt-2">
                    <div className="w-3 h-3 rounded-full bg-[var(--hotel-champagne)] border-2 border-[var(--hotel-ivory)] shadow-sm flex-shrink-0" />
                    {idx < result.stops.length - 1 && (
                      <div className="absolute top-3 right-[5px] w-px bg-[var(--hotel-sand)] h-[calc(100%+3rem)]" />
                    )}
                  </div>
                </div>

                {/* Card */}
                <div className="flex-1 rounded-xl border border-[var(--hotel-sand)] bg-white overflow-hidden shadow-sm">
                  {/* Image strip */}
                  {hasImage && (
                    <div className="h-24 relative overflow-hidden">
                      <img
                        src={imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    </div>
                  )}

                  <div className="p-3 space-y-1">
                    {/* Stop label */}
                    <span className="font-body text-2xs font-bold uppercase tracking-[0.15em] text-[var(--hotel-champagne)]">
                      {stop.label}
                    </span>

                    {/* Venue / event name */}
                    <h4 className="font-display text-lg font-semibold text-[var(--hotel-charcoal)] leading-tight">
                      {stop.event?.title || stop.venue.name}
                    </h4>

                    {/* Venue attribution when event is shown */}
                    {stop.event && (
                      <p className="font-body text-sm text-[var(--hotel-stone)] italic">
                        at {stop.venue.name}
                        {stop.venue.neighborhood ? ` · ${stop.venue.neighborhood}` : ""}
                      </p>
                    )}

                    {/* Reason / editorial description */}
                    {stop.reason && !stop.event && (
                      <p className="font-body text-sm text-[var(--hotel-stone)] italic">
                        {stop.reason}
                      </p>
                    )}

                    {/* TODO: Re-enable Swap/Remove when outing-suggestions API is integrated */}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      <div className="space-y-3 pt-2">
        <button
          onClick={handleShare}
          className="w-full py-3 rounded-full border border-[var(--hotel-sand)] bg-white text-[var(--hotel-charcoal)] font-body font-medium text-sm hover:bg-[var(--hotel-cream)] transition-colors"
        >
          Share Plan
        </button>

        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-3 rounded-full bg-[var(--hotel-charcoal)] text-white font-body font-medium text-sm text-center hover:bg-[var(--hotel-ink)] transition-colors"
          >
            Get Walking Directions
          </a>
        )}
      </div>
    </div>
  );
}
