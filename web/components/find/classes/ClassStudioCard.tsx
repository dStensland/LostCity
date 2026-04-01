"use client";

import { memo } from "react";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import Dot from "@/components/ui/Dot";
import { getCategoryMeta, toUiCategory } from "@/lib/class-categories";

export interface StudioSummary {
  venueId: number;
  venueSlug: string;
  name: string;
  neighborhood: string | null;
  imageUrl: string | null;
  primaryCategory: string | null;
  classCount: number;
  nextClassName: string | null;
  nextClassDate: string | null;
  nextClassTime: string | null;
}

export interface ClassStudioCardProps {
  studio: StudioSummary;
  portalSlug: string;
}

export const ClassStudioCard = memo(function ClassStudioCard({
  studio,
  portalSlug,
}: ClassStudioCardProps) {
  const uiCategory = toUiCategory(studio.primaryCategory);
  const categoryMeta = getCategoryMeta(uiCategory);
  const CategoryIcon = categoryMeta?.icon ?? null;

  const scheduleHref = `/${portalSlug}/venues/${studio.venueSlug}?tab=classes`;

  return (
    <div className="rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 p-3 sm:p-4 flex items-start gap-3 sm:gap-4 hover:border-[var(--twilight)]/70 transition-colors">
      {/* Venue image / fallback */}
      <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden relative">
        {studio.imageUrl ? (
          <SmartImage
            src={studio.imageUrl}
            alt={studio.name}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{
              background: "color-mix(in srgb, #C9874F 15%, transparent)",
            }}
          >
            {CategoryIcon && (
              <CategoryIcon
                size={28}
                weight="duotone"
                className="text-[var(--soft)]"
              />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Name + neighborhood */}
        <h3 className="text-base font-semibold text-[var(--cream)] leading-snug truncate">
          {studio.name}
        </h3>
        <div className="flex items-center gap-1.5 mt-0.5">
          {studio.neighborhood && (
            <span className="font-mono text-xs text-[var(--muted)] uppercase tracking-[0.06em] truncate">
              {studio.neighborhood}
            </span>
          )}
          {studio.neighborhood && studio.classCount > 0 && (
            <Dot className="text-[var(--muted)]/40 flex-shrink-0" />
          )}
          {studio.classCount > 0 && (
            <span className="text-xs text-[var(--soft)] flex-shrink-0">
              {studio.classCount} {studio.classCount === 1 ? "class" : "classes"}
            </span>
          )}
        </div>

        {/* Next class teaser */}
        {studio.nextClassName && (
          <p className="mt-1.5 text-sm text-[var(--soft)] truncate">
            <span className="text-[var(--muted)] text-xs">Next:</span>{" "}
            <span>{studio.nextClassName}</span>
            {(studio.nextClassDate || studio.nextClassTime) && (
              <>
                <Dot className="mx-1 text-[var(--muted)]/40" />
                <span className="text-xs text-[var(--muted)]">
                  {[studio.nextClassDate, studio.nextClassTime]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </>
            )}
          </p>
        )}

        {/* Link */}
        <Link
          href={scheduleHref}
          className="inline-block mt-2 text-xs font-medium text-[var(--coral)] hover:text-[var(--coral)]/80 transition-colors"
        >
          See schedule →
        </Link>
      </div>
    </div>
  );
});

export type { StudioSummary as ClassStudio };
