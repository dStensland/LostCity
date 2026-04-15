"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import Badge from "@/components/ui/Badge";
import type { SectionProps } from "@/lib/detail/types";
import type { VenueExhibitionRow } from "@/lib/spot-detail";

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (d: string) => {
    const date = new Date(d + "T12:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`;
  if (start) return fmt(start);
  if (end) return `Through ${fmt(end)}`;
  return null;
}

export function ExhibitionsSection({ data, portalSlug }: SectionProps) {
  if (data.entityType !== "place") return null;

  const exhibitions = data.payload.exhibitions as VenueExhibitionRow[];
  if (!exhibitions || exhibitions.length === 0) return null;

  const now = new Date();

  return (
    <div className="space-y-3">
      {exhibitions.map((ex) => {
        const daysLeft = ex.closing_date
          ? Math.ceil(
              (new Date(ex.closing_date + "T00:00:00").getTime() - now.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null;
        const dateRange = formatDateRange(ex.opening_date, ex.closing_date);

        return (
          <Link
            key={ex.id}
            href={
              ex.slug
                ? `/${portalSlug}/exhibitions/${ex.slug}`
                : ex.source_url || "#"
            }
            {...(!ex.slug && ex.source_url
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
            className="group flex gap-3 p-3 rounded-xl border border-[var(--twilight)]/40 hover:border-[var(--soft)]/30 transition-colors find-row-card-bg"
          >
            {ex.image_url && (
              <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
                <SmartImage
                  src={ex.image_url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-[var(--cream)] leading-snug line-clamp-2 group-hover:opacity-80 transition-opacity">
                {ex.title}
              </h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {dateRange && (
                  <p className="font-mono text-xs text-[var(--soft)]">{dateRange}</p>
                )}
                {ex.admission_type && ex.admission_type !== "included" && (
                  <Badge variant="accent" accentColor="var(--gold)" size="sm">
                    {ex.admission_type === "free"
                      ? "Free"
                      : ex.admission_type === "ticketed"
                        ? "Ticketed"
                        : ex.admission_type.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              {daysLeft !== null && daysLeft > 0 && daysLeft <= 30 && (
                <span
                  className={`inline-block mt-1.5 px-2 py-0.5 font-mono text-2xs font-bold uppercase tracking-wider rounded ${
                    daysLeft <= 7
                      ? "bg-[var(--coral)]/15 text-[var(--coral)]"
                      : "bg-[var(--gold)]/15 text-[var(--gold)]"
                  }`}
                >
                  {daysLeft <= 1 ? "Last day" : `${daysLeft}d left`}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
