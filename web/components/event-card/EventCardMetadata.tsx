"use client";

import Dot from "@/components/ui/Dot";

const DURATION_LABELS: Record<string, string> = {
  "short": "~1hr",
  "medium": "2-3hrs",
  "half-day": "Half Day",
  "full-day": "Full Day",
  "multi-day": "Multi-Day",
};
import SeriesBadge from "@/components/SeriesBadge";
import ReasonBadge, {
  getTopReasons,
  type RecommendationReason,
} from "@/components/ReasonBadge";
import type { Frequency, DayOfWeek } from "@/lib/recurrence";

interface PriceInfo {
  text: string;
  isFree: boolean;
  isEstimate: boolean;
}

interface SeriesInfo {
  id: string;
  title: string;
  series_type: string;
  image_url?: string | null;
  blurhash?: string | null;
  frequency?: Frequency;
  day_of_week?: DayOfWeek;
}

interface EventCardMetadataProps {
  venueName: string | null;
  venueNeighborhood: string | null;
  locationLabel: string | null;
  price: PriceInfo | null;
  series: SeriesInfo | null | undefined;
  isClass: boolean | undefined;
  instructorName: string | null;
  skillLevel: string | null | undefined;
  /** Reason badges row */
  reasons?: RecommendationReason[];
  /** Filter redundant badges based on section context */
  contextType?: "interests" | "venue" | "producer" | "neighborhood";
  portalSlug?: string;
  /** When true, reason badges are suppressed (friends going takes precedence) */
  hasFriendsGoing: boolean;
  duration?: string | null;
  bookingRequired?: boolean | null;
}

export function EventCardMetadata({
  venueName,
  venueNeighborhood,
  locationLabel,
  price,
  series,
  isClass,
  instructorName,
  skillLevel,
  reasons,
  contextType,
  portalSlug,
  hasFriendsGoing,
  duration,
  bookingRequired,
}: EventCardMetadataProps) {
  return (
    <>
      {/* Details row — venue and metadata with hierarchy */}
      {/* Mobile: show only venue + price; Desktop: show all metadata */}
      <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed flex-wrap">
        {venueName && (
          <>
            <span
              className="truncate max-w-[70%] sm:max-w-[45%] font-medium text-sm"
              title={venueName}
            >
              {venueName}
            </span>
            {venueNeighborhood && (
              <>
                <Dot />
                <span
                  className="truncate text-[var(--text-tertiary)]"
                  title={venueNeighborhood}
                >
                  {venueNeighborhood}
                </span>
              </>
            )}
            {locationLabel && (
              <>
                <Dot />
                <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-2xs uppercase tracking-[0.08em] bg-[var(--twilight)]/55 text-[var(--soft)] border border-[var(--twilight)]/75">
                  {locationLabel}
                </span>
              </>
            )}
          </>
        )}
        {price && price.text && (
          <>
            <Dot />
            {price.isFree ? (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-xs font-semibold ${
                  price.isEstimate
                    ? "bg-[var(--neon-green)]/15 text-[var(--neon-green)] border border-[var(--neon-green)]/25"
                    : "bg-[var(--neon-green)]/25 text-[var(--neon-green)] border border-[var(--neon-green)]/40 shadow-[0_0_8px_var(--neon-green)/15]"
                }`}
              >
                {price.text}
              </span>
            ) : (
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-mono text-xs font-medium ${
                  price.isEstimate
                    ? "bg-[var(--twilight)]/50 text-[var(--muted)]"
                    : "bg-[var(--twilight)] text-[var(--cream)] border border-[var(--twilight)]"
                }`}
              >
                {price.text}
              </span>
            )}
          </>
        )}
        {/* Series badge — desktop only */}
        {series && (
          <span className="hidden sm:contents">
            <Dot />
            <SeriesBadge
              seriesType={series.series_type}
              frequency={series.frequency}
              dayOfWeek={series.day_of_week}
              compact
            />
          </span>
        )}
        {/* Class badge — desktop only */}
        {isClass && (
          <span className="hidden sm:contents">
            <Dot />
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-mono text-xs font-semibold bg-[var(--neon-blue,#60a5fa)]/15 text-[var(--neon-blue,#60a5fa)] border border-[var(--neon-blue,#60a5fa)]/25">
              Class
            </span>
          </span>
        )}
        {/* Instructor — desktop only */}
        {instructorName && (
          <span className="hidden sm:contents">
            <Dot />
            <span
              className="truncate text-[var(--muted)] text-xs"
              title={instructorName}
            >
              w/ {instructorName}
            </span>
          </span>
        )}
        {/* Skill level — desktop only */}
        {skillLevel && (
          <span className="hidden sm:contents">
            <Dot />
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/40 capitalize">
              {skillLevel}
            </span>
          </span>
        )}
        {/* Duration — desktop only */}
        {duration && DURATION_LABELS[duration] && (
          <span className="hidden sm:contents">
            <Dot />
            <span className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/40">
              {DURATION_LABELS[duration]}
            </span>
          </span>
        )}
        {/* Booking required — desktop only */}
        {bookingRequired && (
          <span className="hidden sm:contents">
            <Dot />
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-2xs text-[var(--neon-cyan)] bg-[var(--neon-cyan)]/10 border border-[var(--neon-cyan)]/20">
              Book ahead
            </span>
          </span>
        )}
      </div>

      {/* Recommendation reasons — only shown when no friends going */}
      {!hasFriendsGoing && reasons && reasons.length > 0 && (
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {getTopReasons(
            reasons.filter((r) => {
              if (contextType === "venue" && r.type === "followed_venue")
                return false;
              if (
                contextType === "producer" &&
                r.type === "followed_organization"
              )
                return false;
              if (contextType === "interests" && r.type === "category")
                return false;
              if (contextType === "neighborhood" && r.type === "neighborhood")
                return false;
              return true;
            }),
            2,
          ).map((reason, idx) => (
            <ReasonBadge
              key={`${reason.type}-${idx}`}
              reason={reason}
              size="sm"
              portalSlug={portalSlug}
            />
          ))}
        </div>
      )}
    </>
  );
}
