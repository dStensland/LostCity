"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import type { Destination } from "@/lib/forth-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import HotelCarousel from "../../hotel/HotelCarousel";

interface HappyHourRailProps {
  destinations: Destination[];
  portalSlug: string;
}

function formatRemaining(minutes: number | null): string {
  if (minutes === null) return "";
  if (minutes <= 60) return `${minutes} min left`;
  const h = Math.floor(minutes / 60);
  return `${h}h left`;
}

export default function HappyHourRail({ destinations, portalSlug }: HappyHourRailProps) {
  if (destinations.length === 0) return null;

  return (
    <section className="relative -mx-4 md:-mx-6 px-4 md:px-6 py-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/50">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl" role="img" aria-label="cocktail">{"\u{1F378}"}</span>
        <div>
          <h2 className="font-display text-xl md:text-2xl text-[var(--hotel-charcoal)]">Happy Hour</h2>
          <p className="text-xs font-body text-[var(--hotel-stone)]">
            Drink specials happening right now
          </p>
        </div>
      </div>

      <HotelCarousel>
        {destinations.map((dest) => {
          const imgSrc = dest.venue.image_url ? getProxiedImageSrc(dest.venue.image_url) : null;
          const resolvedImg = typeof imgSrc === "string" ? imgSrc : dest.venue.image_url;

          return (
            <div key={dest.venue.id} className="snap-start shrink-0 w-[220px] md:w-[240px]">
              <Link
                href={`/${portalSlug}?spot=${dest.venue.slug}`}
                className="group block rounded-xl overflow-hidden bg-white border border-amber-200/50 shadow-sm hover:shadow-md transition-all"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  {resolvedImg && (
                    <img
                      src={resolvedImg}
                      alt={dest.venue.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  {dest.top_special?.remaining_minutes != null && (
                    <div className="absolute top-2 right-2">
                      <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-semibold">
                        {formatRemaining(dest.top_special.remaining_minutes)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-display text-sm text-[var(--hotel-charcoal)] truncate">{dest.venue.name}</h3>
                  {dest.top_special && (
                    <p className="text-xs text-amber-700 font-medium truncate mt-0.5">{dest.top_special.title}</p>
                  )}
                  <p className="text-[10px] text-[var(--hotel-stone)] mt-1">{dest.proximity_label}</p>
                </div>
              </Link>
            </div>
          );
        })}
      </HotelCarousel>
    </section>
  );
}
