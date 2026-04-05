"use client";

import Link from "next/link";
import CategoryIcon from "@/components/CategoryIcon";
import type { FeedSectionData } from "./types";
import { buildExploreUrl } from "@/lib/find-url";

export function CategoryGrid({
  section,
  portalSlug,
  isFirst,
}: {
  section: FeedSectionData;
  portalSlug: string;
  isFirst?: boolean;
}) {
  const content = section.block_content as {
    categories?: Array<{
      id: string;
      label: string;
      icon: string;
      count?: number;
    }>;
  } | null;

  const categories = content?.categories || [];

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className={`mb-6 sm:mb-10 ${isFirst ? "" : "pt-2"}`}>
      {/* Header */}
      {section.title && (
        <h3 className="text-lg font-semibold tracking-tight text-[var(--cream)] mb-4">
          {section.title}
        </h3>
      )}

      {/* Grid with larger touch targets */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={buildExploreUrl({ portalSlug, lane: "events", categories: cat.id })}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--twilight)] hover:border-[var(--coral)]/50 transition-all group min-h-[80px] relative bg-[var(--card-bg)]"
          >
            <CategoryIcon
              type={cat.id}
              size={28}
              className="group-hover:scale-110 transition-transform"
            />
            <span className="font-mono text-xs text-[var(--muted)] group-hover:text-[var(--cream)] text-center leading-tight">
              {cat.label}
            </span>
            {/* Event count badge - rendered if count is provided */}
            {cat.count !== undefined && cat.count > 0 && (
              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-[var(--twilight)] text-[var(--muted)] text-2xs font-mono font-medium">
                {cat.count > 99 ? "99+" : cat.count}
              </span>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
