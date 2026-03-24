"use client";

import Link from "next/link";
import type { ArtistExhibition } from "@/lib/artists";
import { formatDateRange } from "@/lib/types/exhibitions";

interface ArtistExhibitionTimelineProps {
  exhibitions: ArtistExhibition[];
  portalSlug: string;
}

export function ArtistExhibitionTimeline({
  exhibitions,
  portalSlug,
}: ArtistExhibitionTimelineProps) {
  if (exhibitions.length === 0) return null;

  // Group exhibitions by year
  const byYear = new Map<number, ArtistExhibition[]>();
  for (const ex of exhibitions) {
    const year = ex.opening_date
      ? new Date(ex.opening_date + "T12:00:00").getFullYear()
      : new Date().getFullYear();
    const group = byYear.get(year) ?? [];
    group.push(ex);
    byYear.set(year, group);
  }

  // Sort years descending
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      {years.map((year) => (
        <div key={year}>
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--action-primary)] mb-3">
            {year}
          </div>
          <div className="space-y-2 pl-4 border-l border-[var(--twilight)]">
            {byYear.get(year)!.map((ex) => (
              <div
                key={ex.id}
                className="relative pl-4"
              >
                {/* Timeline dot */}
                <div className="absolute -left-[calc(0.25rem+0.5px)] top-2 w-2 h-2 rounded-full bg-[var(--twilight)] border border-[var(--action-primary)]/40" />

                <Link
                  href={`/${portalSlug}/exhibitions/${ex.slug}`}
                  className="block group py-1.5"
                >
                  <span className="font-[family-name:var(--font-playfair-display)] italic text-base text-[var(--cream)] group-hover:text-[var(--action-primary)] transition-colors">
                    {ex.title}
                  </span>
                  <span className="font-mono text-sm text-[var(--soft)] ml-2">
                    {ex.venue ? `${ex.venue.name}` : ""}
                  </span>
                  <div className="font-mono text-xs text-[var(--muted)] mt-0.5">
                    {formatDateRange(ex.opening_date, ex.closing_date)}
                    {ex.exhibition_type && (
                      <span className="ml-2 uppercase tracking-wider">
                        · {ex.exhibition_type}
                      </span>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
