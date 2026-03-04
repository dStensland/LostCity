"use client";

import { SectionHeader } from "./SectionHeader";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";
import { BeerBottle } from "@phosphor-icons/react";
import Badge from "@/components/ui/Badge";

export type VenueSpecial = {
  id: number;
  title: string;
  type: string;
  description: string | null;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
  price_note: string | null;
  image_url: string | null;
  source_url: string | null;
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDays(days: number[] | null): string | null {
  if (!days || days.length === 0) return null;
  if (days.length === 7) return "Every day";
  const sorted = [...days].sort();
  // Check for Mon-Fri
  if (
    sorted.length === 5 &&
    sorted[0] === 1 &&
    sorted[4] === 5
  )
    return "Mon\u2013Fri";
  // Check for Sat-Sun
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6)
    return "Weekends";
  return sorted.map((d) => DAY_LABELS[d] ?? "").join(", ");
}

function formatTimeWindow(
  start: string | null,
  end: string | null
): string | null {
  if (!start) return null;
  const fmt = (t: string) => {
    const [h, m] = t.split(":");
    const hour = parseInt(h, 10);
    const period = hour >= 12 ? "pm" : "am";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return m === "00" ? `${displayHour}${period}` : `${displayHour}:${m}${period}`;
  };
  if (!end) return fmt(start);
  return `${fmt(start)}\u2013${fmt(end)}`;
}

function isActiveNow(special: VenueSpecial): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  if (special.days_of_week && !special.days_of_week.includes(currentDay))
    return false;
  if (!special.time_start) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = special.time_start.split(":").map(Number);
  const startMin = sh * 60 + (sm || 0);
  if (special.time_end) {
    const [eh, em] = special.time_end.split(":").map(Number);
    const endMin = eh * 60 + (em || 0);
    return nowMinutes >= startMin && nowMinutes <= endMin;
  }
  // No end time — active within 3 hours of start
  return nowMinutes >= startMin && nowMinutes <= startMin + 180;
}

const TYPE_LABELS: Record<string, string> = {
  happy_hour: "Happy Hour",
  daily_special: "Daily Special",
  brunch: "Brunch",
  drink_special: "Drink Special",
  food_special: "Food Special",
  late_night: "Late Night",
  recurring_deal: "Deal",
};

interface VenueSpecialsSectionProps {
  specials: VenueSpecial[];
}

export default function VenueSpecialsSection({
  specials,
}: VenueSpecialsSectionProps) {
  if (!specials || specials.length === 0) return null;

  const colorClass = createCssVarClass(
    "--specials-accent",
    "var(--gold)",
    "specials-section"
  );

  return (
    <div className="mt-6">
      <ScopedStyles css={colorClass?.css} />
      <SectionHeader title="Deals & Specials" count={specials.length} />
      <div className="space-y-3">
        {specials.map((special) => {
          const active = isActiveNow(special);
          const days = formatDays(special.days_of_week);
          const time = formatTimeWindow(special.time_start, special.time_end);
          const typeLabel =
            TYPE_LABELS[special.type] ?? special.type?.replace(/_/g, " ");

          return (
            <div
              key={special.id}
              className={`flex items-start gap-3 p-4 rounded-xl border border-[var(--twilight)]/60 bg-[var(--night)] border-l-2 transition-all ${colorClass?.className ?? ""} ${active ? "bg-[var(--gold)]/[0.03]" : ""}`}
              style={{ borderLeftColor: "var(--gold)" }}
            >
              <BeerBottle
                size={20}
                weight="light"
                className="flex-shrink-0 mt-0.5 text-[var(--specials-accent)]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[var(--cream)] leading-tight">
                    {special.title}
                  </h3>
                  {active && (
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--neon-green)] opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--neon-green)]" />
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {typeLabel && (
                    <span className="text-2xs font-mono uppercase tracking-wider text-[var(--soft)]">
                      {typeLabel}
                    </span>
                  )}
                  {active && (
                    <Badge variant="success" size="sm">
                      Active Now
                    </Badge>
                  )}
                </div>

                {/* Days + time */}
                {(days || time) && (
                  <p className="text-sm text-[var(--soft)] mt-1.5">
                    {days}
                    {days && time && " \u00B7 "}
                    {time}
                  </p>
                )}

                {special.description && (
                  <p className="text-sm text-[var(--soft)] mt-1.5 leading-relaxed line-clamp-2">
                    {special.description}
                  </p>
                )}

                {special.price_note && (
                  <p className="text-xs text-[var(--gold)] mt-1 font-mono font-bold uppercase tracking-wider">
                    {special.price_note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
