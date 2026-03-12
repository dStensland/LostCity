"use client";
/* eslint-disable @next/next/no-img-element */

import {
  Calendar,
  Coffee,
  FlowerLotus,
  ForkKnife,
  MapPin,
  Martini,
  Moon,
  MusicNote,
  Sparkle,
  type Icon,
} from "@phosphor-icons/react";
import type { AmbientContext } from "@/lib/concierge/concierge-types";
import { getProxiedImageSrc } from "@/lib/image-proxy";

const QUICK_ACTION_ICONS: Record<string, Icon> = {
  calendar: Calendar,
  coffee: Coffee,
  glass: Martini,
  map: MapPin,
  moon: Moon,
  music: MusicNote,
  spa: FlowerLotus,
  sparkles: Sparkle,
  utensils: ForkKnife,
};

function QuickActionIcon({ name }: { name: string }) {
  const PhosphorIcon = QUICK_ACTION_ICONS[name];
  return PhosphorIcon
    ? <PhosphorIcon size={14} weight="duotone" className="opacity-60" />
    : <span className="text-xs opacity-60">{name}</span>;
}

interface DiscoverHeroProps {
  ambient: AmbientContext;
  onOpenPlanner: () => void;
}

function getCTALabel(dayPart: AmbientContext["dayPart"]): string {
  if (dayPart === "morning") return "Plan My Morning";
  if (dayPart === "afternoon") return "Plan My Afternoon";
  if (dayPart === "late_night") return "Plan Tomorrow";
  return "Plan Your Evening";
}

export function DiscoverHero({ ambient, onOpenPlanner }: DiscoverHeroProps) {
  const imgSrc = getProxiedImageSrc(ambient.heroPhoto);
  const resolvedSrc = typeof imgSrc === "string" ? imgSrc : ambient.heroPhoto;

  function handlePillClick(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      {/* Hero image with gradient overlay */}
      <div className="relative rounded-2xl overflow-hidden aspect-[16/7] min-h-[280px] md:aspect-[21/9] md:min-h-[360px]">
        <img
          src={resolvedSrc}
          alt={ambient.greeting.title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
        {/* Gradient: bottom-to-top, darken for text legibility without washing out photo */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

        {/* Text content anchored to bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 space-y-2">
          {ambient.weatherBadge && (
            <span className="inline-block text-xs font-body text-white/70 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1">
              {ambient.weatherBadge}
            </span>
          )}
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-white leading-tight">
            {ambient.greeting.title}
          </h1>
          <p className="font-display italic text-base text-white/80 max-w-xl">
            {ambient.greeting.subtitle}
          </p>
        </div>
      </div>

      {/* CTA + quick action pills */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <button
          onClick={onOpenPlanner}
          className="w-full md:w-auto px-8 py-3.5 rounded-full bg-[var(--hotel-champagne)] text-[var(--hotel-charcoal)] font-body font-semibold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <span aria-hidden="true">✨</span>
          {getCTALabel(ambient.dayPart)}
        </button>

        {ambient.quickActions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide md:overflow-visible md:flex-wrap">
            {ambient.quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handlePillClick(action.sectionId)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--hotel-sand)] bg-white/80 backdrop-blur-sm text-sm font-body text-[var(--hotel-stone)] hover:bg-[var(--hotel-cream)] transition-colors cursor-pointer"
              >
                <QuickActionIcon name={action.icon} />
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type { DiscoverHeroProps };
