"use client";

import Image from "next/image";
import Link from "next/link";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import CategoryIcon from "@/components/CategoryIcon";

export type PlaybookItemData = {
  item_type: "event" | "special" | "exhibit" | "festival";
  id: number;
  title: string;
  subtitle: string;
  time_label: string;
  start_time: string | null;
  date: string;
  venue: {
    id: number;
    name: string;
    slug: string;
    lat: number | null;
    lng: number | null;
    neighborhood: string | null;
  };
  image_url: string | null;
  category: string | null;
  is_active_now: boolean;
  going_count?: number;
  active_special?: { title: string; type: string } | null;
};

interface PlaybookCardProps {
  item: PlaybookItemData;
  portalSlug: string;
  onPlanAround?: (item: PlaybookItemData) => void;
}

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  event: { label: "Event", className: "bg-[var(--coral)]/20 text-[var(--coral)]" },
  special: { label: "Special", className: "bg-amber-500/20 text-amber-400" },
  exhibit: { label: "On View", className: "bg-violet-500/20 text-violet-400" },
  festival: { label: "Festival", className: "bg-emerald-500/20 text-emerald-400" },
};

function getItemHref(item: PlaybookItemData, portalSlug: string): string {
  if (item.item_type === "event" || item.item_type === "exhibit") {
    return `/${portalSlug}/events/${item.id}`;
  }
  if (item.item_type === "festival") {
    return `/${portalSlug}/festivals/${item.venue.slug}`;
  }
  // special → link to venue
  return `/${portalSlug}/spots/${item.venue.slug}`;
}

export default function PlaybookCard({ item, portalSlug, onPlanAround }: PlaybookCardProps) {
  const badge = TYPE_BADGES[item.item_type] || TYPE_BADGES.event;
  const href = getItemHref(item, portalSlug);
  const imgSrc = item.image_url ? getProxiedImageSrc(item.image_url) : null;

  return (
    <div className="group relative flex gap-3 p-3 rounded-xl border border-[var(--twilight)]/50 bg-[var(--void)]/30 hover:bg-[var(--twilight)]/20 hover:border-[var(--twilight)]/80 transition-all">
      {/* Image */}
      <Link href={href} className="shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-[var(--twilight)]/30">
        {imgSrc ? (
          <Image
            src={typeof imgSrc === "string" ? imgSrc : ""}
            alt={item.title}
            width={80}
            height={80}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--muted)]/40">
            <CategoryIcon type={item.category || item.item_type} size={24} />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${badge.className}`}>
                {badge.label}
              </span>
              {item.is_active_now && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Now
                </span>
              )}
            </div>
            <Link href={href} className="block">
              <h3 className="text-sm font-medium text-[var(--cream)] truncate group-hover:text-[var(--gold)] transition-colors">
                {item.title}
              </h3>
            </Link>
          </div>
          <span className="shrink-0 text-xs font-mono text-[var(--muted)] mt-0.5">
            {item.time_label}
          </span>
        </div>

        <p className="text-xs text-[var(--muted)] truncate">
          {item.subtitle}
          {item.venue.neighborhood && (
            <span className="text-[var(--muted)]/60"> · {item.venue.neighborhood}</span>
          )}
        </p>

        {/* Special badge for venues with active specials */}
        {item.active_special && item.item_type !== "special" && (
          <span className="inline-flex self-start px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-medium">
            {item.active_special.title}
          </span>
        )}

        {/* Social proof */}
        {item.going_count != null && item.going_count > 0 && (
          <span className="text-[10px] text-[var(--muted)]/70 font-mono">
            {item.going_count} going
          </span>
        )}
      </div>

      {/* Plan around this button */}
      {onPlanAround && (item.item_type === "event" || item.item_type === "exhibit") && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPlanAround(item);
          }}
          className="absolute bottom-2 right-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity px-2 py-1 rounded-lg bg-[var(--gold)]/90 text-[var(--void)] text-[10px] font-semibold hover:bg-[var(--gold)] shadow-md"
          title="Plan an outing around this"
        >
          Plan around this
        </button>
      )}
    </div>
  );
}
