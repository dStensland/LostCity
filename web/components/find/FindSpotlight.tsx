"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import type { FindSpotlight as FindSpotlightType } from "@/lib/find-data";

interface FindSpotlightProps {
  spotlight: FindSpotlightType;
  portalSlug: string;
}

export function FindSpotlight({ spotlight, portalSlug }: FindSpotlightProps) {
  return (
    <div>
      {/* Editorial header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span
            className="font-mono text-xs font-bold tracking-[0.12em] uppercase"
            style={{ color: spotlight.color }}
          >
            {spotlight.label}
          </span>
          <p className="text-sm text-[var(--soft)] mt-0.5">{spotlight.reason}</p>
        </div>
        <Link
          href={`/${portalSlug}${spotlight.href}`}
          className="font-mono text-xs font-bold tracking-[0.08em] uppercase transition-opacity hover:opacity-70"
          style={{ color: spotlight.color }}
        >
          See all →
        </Link>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {spotlight.items.map((item) => (
          <Link
            key={item.id}
            href={`/${portalSlug}?${item.entity_type === "place" ? "spot" : "event"}=${item.entity_type === "place" ? item.slug : item.id}`}
            className="group"
          >
            {/* Hero image */}
            <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[var(--dusk)] relative">
              {item.image_url ? (
                <SmartImage
                  src={item.image_url}
                  alt={item.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 170px, 200px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${spotlight.color}20` }}
                  >
                    <span className="text-lg" style={{ color: spotlight.color }}>
                      ✦
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Name */}
            <p className="text-sm font-semibold text-[var(--cream)] leading-tight mt-2 line-clamp-2 group-hover:text-[var(--coral)] transition-colors">
              {item.name}
            </p>

            {/* Metadata */}
            <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
              {item.place_type}
              {item.neighborhood ? ` · ${item.neighborhood}` : ""}
            </p>

            {/* Event count badge */}
            {item.event_count && item.event_count > 0 && (
              <span
                className="inline-block mt-1 font-mono text-2xs font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: `${spotlight.color}1A`,
                  color: spotlight.color,
                }}
              >
                {item.event_count} events
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
