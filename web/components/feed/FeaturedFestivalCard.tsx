"use client";

import { useState } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import CountdownBadge from "@/components/CountdownBadge";
import CategoryPlaceholder from "@/components/CategoryPlaceholder";
import type { FestivalMoment } from "@/lib/moments-utils";
import { formatFestivalDates } from "@/lib/moments-utils";

interface FeaturedFestivalCardProps {
  moment: FestivalMoment;
  portalSlug: string;
  variant: "hero" | "card" | "compact";
}

function HeroVariant({ moment, portalSlug }: Omit<FeaturedFestivalCardProps, "variant">) {
  const { festival, countdown } = moment;
  const dates = formatFestivalDates(festival.announced_start, festival.announced_end);

  return (
    <Link
      href={`/${portalSlug}/festivals/${festival.slug}`}
      className="block relative rounded-2xl overflow-hidden group festival-glass-hero"
    >
      {/* Image area */}
      <div className="relative h-[280px] w-full">
        {festival.image_url ? (
          <SmartImage
            src={festival.image_url}
            alt={festival.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 700px"
          />
        ) : (
          <CategoryPlaceholder
            category={festival.categories?.[0]}
            size="lg"
            variant="featured"
            className="w-full h-full"
          />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
      </div>

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <CountdownBadge countdown={countdown} size="lg" />
        <h3 className="text-2xl font-bold text-[var(--cream)] mt-2 leading-tight">
          {festival.name}
        </h3>
        {dates && (
          <p className="text-sm font-mono text-[var(--soft)] mt-1">{dates}</p>
        )}
        {festival.location && (
          <p className="text-xs text-[var(--muted)] mt-0.5">{festival.location}</p>
        )}
      </div>
    </Link>
  );
}

function CardVariant({ moment, portalSlug }: Omit<FeaturedFestivalCardProps, "variant">) {
  const { festival, countdown } = moment;
  const dates = formatFestivalDates(festival.announced_start, festival.announced_end);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <Link
      href={`/${portalSlug}/festivals/${festival.slug}`}
      className="flex-shrink-0 w-[240px] rounded-xl overflow-hidden border border-[#65E8FF]/35 bg-[var(--void)] hover:border-[#8CF1FF]/70 hover:shadow-[0_0_20px_rgba(101,232,255,0.24)] hover:-translate-y-0.5 transition-all duration-200 group festival-glass-card"
    >
      {/* Image */}
      <div className="relative h-[140px] w-full overflow-hidden">
        {!imgLoaded && <div className="absolute inset-0 skeleton-shimmer" />}
        {festival.image_url ? (
          <SmartImage
            src={festival.image_url}
            alt={festival.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="240px"
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <CategoryPlaceholder
            category={festival.categories?.[0]}
            size="md"
            className="w-full h-full"
          />
        )}
        {/* Badge overlay */}
        <div className="absolute top-2 left-2">
          <CountdownBadge countdown={countdown} size="sm" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h4 className="text-sm font-bold text-[var(--cream)] leading-tight line-clamp-2">
          {festival.name}
        </h4>
        {dates && (
          <p className="text-[0.7rem] font-mono text-[var(--soft)] mt-1">{dates}</p>
        )}
      </div>
    </Link>
  );
}

function CompactVariant({ moment, portalSlug }: Omit<FeaturedFestivalCardProps, "variant">) {
  const { festival, countdown } = moment;
  const dates = formatFestivalDates(festival.announced_start, festival.announced_end);

  return (
    <Link
      href={`/${portalSlug}/festivals/${festival.slug}`}
      className="flex items-center gap-3 flex-shrink-0 w-[280px] rounded-lg border border-[#65E8FF]/30 bg-[var(--void)] hover:border-[#8CF1FF]/60 hover:shadow-[0_0_12px_rgba(101,232,255,0.2)] hover:-translate-y-0.5 transition-all duration-200 p-2 group festival-glass-compact"
    >
      {/* Thumbnail */}
      <div className="relative w-14 h-14 rounded-md overflow-hidden flex-shrink-0">
        {festival.image_url ? (
          <SmartImage
            src={festival.image_url}
            alt={festival.name}
            fill
            className="object-cover"
            sizes="56px"
          />
        ) : (
          <CategoryPlaceholder
            category={festival.categories?.[0]}
            size="sm"
            className="w-full h-full"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-[var(--cream)] leading-tight truncate">
          {festival.name}
        </h4>
        {dates && (
          <p className="text-[0.6rem] font-mono text-[var(--muted)] mt-0.5">{dates}</p>
        )}
        <div className="mt-1">
          <CountdownBadge countdown={countdown} size="sm" />
        </div>
      </div>
    </Link>
  );
}

export default function FeaturedFestivalCard({
  moment,
  portalSlug,
  variant,
}: FeaturedFestivalCardProps) {
  switch (variant) {
    case "hero":
      return <HeroVariant moment={moment} portalSlug={portalSlug} />;
    case "card":
      return <CardVariant moment={moment} portalSlug={portalSlug} />;
    case "compact":
      return <CompactVariant moment={moment} portalSlug={portalSlug} />;
  }
}
