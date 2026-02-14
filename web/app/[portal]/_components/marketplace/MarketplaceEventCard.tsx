import Image from "next/image";
import Link from "next/link";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface MarketplaceEventCardProps {
  id: number;
  title: string;
  startDate: string;
  startTime: string | null;
  imageUrl: string | null;
  venueName: string | null;
  category: string | null;
  tags?: string[];
  portalSlug: string;
}

function formatShortDate(isoDate: string): string {
  const utcMidday = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcMidday);
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const hour = Number(time.slice(0, 2));
  const minute = time.slice(3, 5);
  if (Number.isNaN(hour)) return time;
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${normalizedHour}:${minute} ${period}`;
}

export default function MarketplaceEventCard({
  id,
  title,
  startDate,
  startTime,
  imageUrl,
  venueName,
  category,
  tags = [],
  portalSlug,
}: MarketplaceEventCardProps) {
  const href = `/${portalSlug}/events/${id}`;
  const dateLabel = formatShortDate(startDate);
  const timeLabel = formatTime(startTime);
  const isBeltLine = tags.some((t) => t.toLowerCase().includes("beltline"));

  return (
    <Link
      href={href}
      className="group flex gap-3 rounded-xl border border-[var(--mkt-sand)] bg-white p-3 transition-all hover:border-[var(--mkt-brick)]/30 hover:shadow-[var(--mkt-shadow-medium)]"
    >
      {/* Image */}
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-[var(--mkt-cream)]">
        {imageUrl ? (
          <Image
            src={getProxiedImageSrc(imageUrl)}
            alt={title}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-2xl text-[var(--mkt-steel)]/40">
              {category === "music" ? "🎵" : category === "art" ? "🎨" : "📅"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <h3 className="font-body text-sm font-semibold text-[var(--mkt-charcoal)] line-clamp-2 group-hover:text-[var(--mkt-brick)] transition-colors">
          {title}
        </h3>
        <p className="mt-0.5 text-xs font-label text-[var(--mkt-steel)]">
          {dateLabel}
          {timeLabel && <span className="ml-1">· {timeLabel}</span>}
        </p>
        {venueName && (
          <p className="mt-0.5 text-xs text-[var(--mkt-steel)]/70 truncate">
            {venueName}
          </p>
        )}
        {isBeltLine && (
          <span className="mt-1 inline-block self-start px-1.5 py-0.5 rounded text-[9px] font-label uppercase tracking-[0.08em] mkt-beltline-tag">
            BeltLine
          </span>
        )}
      </div>
    </Link>
  );
}
