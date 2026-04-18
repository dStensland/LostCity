import Link from "next/link";

/**
 * Minimalist neighborhood card for the /atlanta/neighborhoods index grid.
 *
 * Color dot carries neighborhood identity through to the map and detail page.
 * Status line is CORAL ("N tonight · N places") when events are active today,
 * else MUTED ("N places"). Uniform sizing across tiers — no color-tinted
 * background, no activity-score opacity, no category icons (per Pencil atom
 * `eoLUe` / rework per `NeighborhoodIndexCard` spec in
 * docs/plans/neighborhoods-elevate-2026-04-18.md).
 */
interface NeighborhoodIndexCardProps {
  name: string;
  slug: string;
  portalSlug: string;
  color: string; // from getNeighborhoodColor(name)
  eventsTodayCount: number;
  eventsWeekCount: number;
  venueCount: number;
}

export default function NeighborhoodIndexCard({
  name,
  slug,
  portalSlug,
  color,
  eventsTodayCount,
  venueCount,
}: NeighborhoodIndexCardProps) {
  const isActive = eventsTodayCount > 0;

  return (
    <Link
      href={`/${portalSlug}/neighborhoods/${slug}`}
      className="block p-4 rounded-card border border-[var(--twilight)] bg-[var(--night)] transition-colors hover:border-[var(--muted)]"
    >
      <div className="flex items-center gap-2">
        <span
          className="w-[7px] h-[7px] rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="text-base font-semibold text-[var(--cream)] leading-tight line-clamp-1">
          {name}
        </span>
      </div>
      <div className="mt-2">
        {isActive ? (
          <span className="font-mono text-xs text-[var(--coral)] tabular-nums">
            {eventsTodayCount} tonight · {venueCount}{" "}
            {venueCount === 1 ? "place" : "places"}
          </span>
        ) : (
          <span className="font-mono text-xs text-[var(--muted)] tabular-nums">
            {venueCount} {venueCount === 1 ? "place" : "places"}
          </span>
        )}
      </div>
    </Link>
  );
}
