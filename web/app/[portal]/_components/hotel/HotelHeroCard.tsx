import Link from "next/link";
import { format } from "date-fns";
import { getProxiedImageSrc } from "@/lib/image-proxy";

const DEFAULT_EVENT_IMAGE = "https://forthatlanta.com/hubfs/Forth/Website/Images/Club/hero-banner-club-faq-desktop.jpg";

/** Convert "HH:MM:SS" to "1:00 PM" style */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return minutes === "00" ? `${h12} ${ampm}` : `${h12}:${minutes} ${ampm}`;
}

function resolveEventHref(
  portalSlug: string,
  event: { id?: string | null; title: string; venue_name?: string | null }
): string {
  const id = typeof event.id === "string" ? event.id.trim() : "";
  if (id) return `/${portalSlug}/events/${id}`;
  const fallbackQuery = event.venue_name || event.title;
  return `/${portalSlug}?view=find&type=events&search=${encodeURIComponent(fallbackQuery)}`;
}

function formatEventDate(dateValue: string): string {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "Today";
  return format(parsed, "EEEE, MMM d");
}

interface HotelHeroCardProps {
  event: {
    id: string;
    title: string;
    start_date: string;
    start_time?: string | null;
    image_url?: string | null;
    description?: string | null;
    venue_name?: string | null;
    is_free?: boolean;
    price_min?: number | null;
  };
  portalSlug: string;
  contextLabel?: string;
}

/**
 * Full-width editorial hero card for tonight's top pick
 * 16:9 image with dark gradient overlay, serif title
 */
export default function HotelHeroCard({ event, portalSlug, contextLabel }: HotelHeroCardProps) {
  const eventUrl = resolveEventHref(portalSlug, event);
  const imageSrc = getProxiedImageSrc(event.image_url || DEFAULT_EVENT_IMAGE) as string;
  const fallbackImageSrc = getProxiedImageSrc(DEFAULT_EVENT_IMAGE) as string;

  return (
    <Link
      href={eventUrl}
      className="group isolate block relative rounded-xl overflow-hidden shadow-[var(--hotel-shadow-medium)] hover:shadow-[var(--hotel-shadow-strong)] transition-shadow duration-500"
    >
      {/* Image */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-[inherit] bg-[var(--hotel-sand)] [clip-path:inset(0_round_0.75rem)]">
        <img
          src={imageSrc}
          alt={event.title}
          className="absolute inset-0 block h-full w-full object-cover group-hover:scale-105 transition-transform duration-700 transform-gpu will-change-transform [backface-visibility:hidden]"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src !== fallbackImageSrc) {
              img.src = fallbackImageSrc;
            }
          }}
        />

        {/* Gradient overlay */}
        <div className="hotel-hero-gradient absolute inset-0" />

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          {/* Badge row */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-body uppercase tracking-[0.15em] text-white/80">
              {formatEventDate(event.start_date)}
              {event.start_time && ` \u00B7 ${formatTime(event.start_time)}`}
            </span>
            {contextLabel && (
              <span className="text-xs font-body uppercase tracking-[0.15em] text-white/85 bg-black/30 px-2 py-0.5 rounded">
                {contextLabel}
              </span>
            )}
            {(event.is_free || event.price_min === 0) && (
              <span className="text-xs font-body uppercase tracking-[0.15em] text-[var(--hotel-champagne)] bg-black/30 px-2 py-0.5 rounded">
                Complimentary
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="font-display font-semibold text-2xl md:text-3xl text-white tracking-tight leading-tight mb-2 line-clamp-2">
            {event.title}
          </h3>

          {/* Venue */}
          {event.venue_name && (
            <p className="text-sm font-body text-white/70">
              {event.venue_name}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
