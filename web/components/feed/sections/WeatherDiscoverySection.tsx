"use client";

/**
 * Weather Discovery section — venue recommendations matched to current weather.
 *
 * Design: Contextual header (changes with weather), horizontal scroll of
 * glass-card venue cards with accent glow, venue image + name + contextual
 * label + open-now badge.
 */

import Link from "next/link";
import type { CityPulseSection } from "@/lib/city-pulse/types";
import Image from "@/components/SmartImage";
import { Sun, CloudRain, Snowflake, ArrowRight, MapPin } from "@phosphor-icons/react";

interface Props {
  section: CityPulseSection;
  portalSlug: string;
}

function getWeatherTitle(section: CityPulseSection): { title: string; icon: typeof Sun } {
  const subtitle = section.subtitle?.toLowerCase() || "";
  if (subtitle.includes("rain") || subtitle.includes("indoor")) {
    return { title: "Best Indoor Spots", icon: CloudRain };
  }
  if (subtitle.includes("snow") || subtitle.includes("cold")) {
    return { title: "Cozy Spots Nearby", icon: Snowflake };
  }
  return { title: section.title || "Perfect Day Outside", icon: Sun };
}

export default function WeatherDiscoverySection({
  section,
  portalSlug,
}: Props) {
  const destinations = section.items.filter(
    (i) => i.item_type === "destination",
  );

  if (destinations.length === 0) return null;

  const accentColor = section.accent_color || "var(--gold)";
  const { title, icon: WeatherTitleIcon } = getWeatherTitle(section);

  return (
    <section>
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <WeatherTitleIcon
            weight="duotone"
            className="w-3.5 h-3.5"
            style={{ color: accentColor }}
          />
          <h2
            className="font-mono text-xs font-bold tracking-[0.12em] uppercase"
            style={{ color: accentColor }}
          >
            {title}
          </h2>
        </div>
        <Link
          href={`/${portalSlug}?view=find&lane=places`}
          className="text-xs flex items-center gap-1 transition-colors hover:opacity-80"
          style={{ color: accentColor }}
        >
          All spots <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Carousel */}
      <div className="relative">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1 snap-x snap-mandatory">
        {destinations.map((item) => {
          if (item.item_type !== "destination") return null;
          const venue = item.destination.venue;
          const imageUrl = venue.image_url;
          const label = item.destination.contextual_label;

          return (
            <Link
              key={`weather-${venue.id}`}
              href={`/${portalSlug}?spot=${venue.slug}`}
              scroll={false}
              className="shrink-0 w-56 snap-start rounded-xl overflow-hidden glass-card group transition-all duration-200 hover:border-white/20"
            >
              {/* Image */}
              <div className="relative h-32">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={venue.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="224px"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(145deg, color-mix(in srgb, ${accentColor} 12%, var(--dusk)), var(--night))`,
                    }}
                  />
                )}
                {/* Gradient fade */}
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[rgba(0,0,0,0.6)] to-transparent" />

                {/* Open badge */}
                {item.destination.is_open && (
                  <div className="absolute top-2 right-2">
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-2xs font-bold uppercase tracking-wider bg-[var(--void)]/70 backdrop-blur-sm text-[var(--neon-green)]">
                      <span className="w-1 h-1 rounded-full bg-[var(--neon-green)]" />
                      Open
                    </span>
                  </div>
                )}
              </div>

              {/* Card body */}
              <div className="px-3 pb-3 -mt-1 relative">
                <h3 className="text-sm font-semibold text-[var(--cream)] leading-snug truncate group-hover:text-[var(--coral)] transition-colors">
                  {venue.name}
                </h3>

                {label && (
                  <p
                    className="text-xs font-medium mt-0.5 leading-tight"
                    style={{ color: accentColor }}
                  >
                    {label}
                  </p>
                )}

                {venue.neighborhood && (
                  <p className="flex items-center gap-1 text-2xs text-[var(--muted)] mt-1">
                    <MapPin weight="fill" className="w-2.5 h-2.5 shrink-0 opacity-50" />
                    <span className="truncate">{venue.neighborhood}</span>
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
      {/* Scroll fade hint */}
      <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-[var(--void)] pointer-events-none lg:hidden" />
      </div>
    </section>
  );
}
