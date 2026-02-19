"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { Destination } from "@/lib/forth-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import { trackConciergeResource } from "@/lib/analytics/concierge-tracking";

interface LiveNowStripProps {
  destinations: Destination[];
  portalSlug: string;
  /** When true, also show starting_soon destinations */
  demoMode?: boolean;
}

function formatRemaining(minutes: number | null): string {
  if (minutes === null) return "Live";
  if (minutes <= 60) return `${minutes}m left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
}

export default function LiveNowStrip({ destinations, portalSlug, demoMode = false }: LiveNowStripProps) {
  const live = destinations
    .filter((d) => d.special_state === "active_now" || (demoMode && d.special_state === "starting_soon"))
    .slice(0, 6);

  if (live.length === 0) return null;

  return (
    <section id="specials" className="relative">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <h2 className="font-display text-xl md:text-2xl text-[var(--hotel-charcoal)]">Live Now</h2>
        </div>
        <span className="text-xs font-body text-[var(--hotel-stone)]">{live.length} active specials nearby</span>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4 md:-mx-6 md:px-6 concierge-carousel-stagger">
        {live.map((dest) => {
          const imgSrc = dest.venue.image_url ? getProxiedImageSrc(dest.venue.image_url) : null;
          const resolvedImg = typeof imgSrc === "string" ? imgSrc : dest.venue.image_url;

          const destinationHref = `/${portalSlug}?spot=${dest.venue.slug}`;

          return (
            <Link
              key={dest.venue.id}
              href={destinationHref}
              onClick={() => {
                trackConciergeResource(portalSlug, {
                  sectionKey: "live_now_strip",
                  targetKind: "destination",
                  targetId: String(dest.venue.id),
                  targetLabel: dest.venue.name,
                  targetUrl: destinationHref,
                  metadata: {
                    special_state: dest.special_state,
                    proximity_tier: dest.proximity_tier,
                  },
                });
              }}
              className="group flex-none w-[200px] md:w-[220px]"
            >
              <div className="rounded-xl overflow-hidden border border-emerald-500/20 bg-[var(--hotel-cream)] shadow-sm hover:shadow-md hover:border-emerald-500/40 transition-all duration-300">
                <div className="relative aspect-[16/10] overflow-hidden">
                  {resolvedImg && (
                    <img
                      src={resolvedImg}
                      alt={dest.venue.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  {/* Live badge */}
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-semibold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      {formatRemaining(dest.top_special?.remaining_minutes ?? null)}
                    </span>
                  </div>
                  {/* Proximity */}
                  <div className="absolute bottom-2 right-2">
                    <span className="px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[10px]">
                      {dest.proximity_label}
                    </span>
                  </div>
                </div>
                <div className="p-3">
                  <h3 className="font-display text-sm text-[var(--hotel-charcoal)] truncate">{dest.venue.name}</h3>
                  {dest.top_special && (
                    <p className="text-xs text-[var(--hotel-champagne)] font-medium truncate mt-0.5">
                      {dest.top_special.title}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
