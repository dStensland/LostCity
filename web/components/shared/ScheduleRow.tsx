import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { buildEventUrl } from "@/lib/entity-urls";
import { decodeHtmlEntities } from "@/lib/formats";

/**
 * ScheduleRow — prominent time-first row used on chronological surfaces
 * (neighborhood detail, venue detail, series detail). Implements Pencil
 * atom `t5jrF`.
 *
 * Typography constants — LOCKED per product-designer review. Do not
 * override during implementation:
 *   - time column: text-xl font-bold font-mono tabular-nums text-[var(--cream)] leading-none
 *   - period (AM/PM): text-2xs font-mono text-[var(--muted)] tracking-[0.14em]
 *   - accent bar: neighborhood color at ≤70% opacity, 3×48px
 *
 * Category chip uses the existing data-category attribute system, NOT the
 * accentColor prop — prevents a third competing accent on each row.
 *
 * Docs: docs/plans/neighborhoods-elevate-2026-04-18.md § ScheduleRow
 */

export interface ScheduleRowEvent {
  id: number | string;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day?: boolean | null;
  place?: { name: string; slug?: string } | null;
  category_id?: string | null;
  image_url?: string | null;
}

interface ScheduleRowProps {
  event: ScheduleRowEvent;
  accentColor: string;
  portalSlug: string;
  context: "page" | "feed";
}

function formatTimeParts(
  time: string | null,
  isAllDay?: boolean | null,
): { main: string; period: string } | null {
  if (isAllDay) return { main: "ALL", period: "DAY" };
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const main = m === 0 ? `${hr}:00` : `${hr}:${m.toString().padStart(2, "0")}`;
  return { main, period };
}

export default function ScheduleRow({
  event,
  accentColor,
  portalSlug,
  context,
}: ScheduleRowProps) {
  const timeParts = formatTimeParts(event.start_time, event.is_all_day);
  const href = buildEventUrl(Number(event.id), portalSlug, context);

  return (
    <Link
      href={href}
      className="group flex items-stretch gap-5 py-4 px-5 rounded-card border border-[var(--twilight)]/75 bg-[var(--night)] transition-colors hover:bg-[var(--dusk)]"
    >
      <div className="w-20 flex-shrink-0 flex flex-col items-end justify-center gap-0.5">
        {timeParts ? (
          <>
            <span className="text-xl font-bold font-mono tabular-nums text-[var(--cream)] leading-none">
              {timeParts.main}
            </span>
            <span className="text-2xs font-mono text-[var(--muted)] tracking-[0.14em] font-semibold">
              {timeParts.period}
            </span>
          </>
        ) : (
          <span className="text-2xs font-mono text-[var(--muted)] tracking-[0.14em]">
            TBD
          </span>
        )}
      </div>

      <div
        className="w-[3px] self-center rounded-sm flex-shrink-0"
        style={{ backgroundColor: accentColor, opacity: 0.7, height: 48 }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1 flex flex-col justify-center gap-1">
        <p className="text-base font-semibold text-[var(--cream)] leading-snug line-clamp-1 group-hover:text-white transition-colors">
          {decodeHtmlEntities(event.title)}
        </p>
        <div className="flex items-center gap-2">
          {event.place?.name && (
            <span className="text-sm text-[var(--soft)] truncate">
              {event.place.name}
            </span>
          )}
          {event.category_id && (
            <span
              data-category={event.category_id}
              className="text-2xs font-mono font-bold text-category tracking-[0.12em] uppercase flex-shrink-0"
            >
              {event.category_id.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      {event.image_url && (
        <div className="w-[72px] h-[56px] flex-shrink-0 rounded-lg overflow-hidden border border-[var(--twilight)] bg-[var(--dusk)] relative">
          <SmartImage src={event.image_url} alt="" fill sizes="72px" />
        </div>
      )}
    </Link>
  );
}
