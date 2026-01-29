"use client";

import { useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FilterChip, { getTagVariant } from "./FilterChip";

// Curated quick tags in display order
// Access, Vibe, Special tags that are cross-cutting (work without category)
const QUICK_TAGS = [
  // Access tags
  { value: "outdoor", label: "Outdoor", group: "access" as const },
  { value: "21+", label: "21+", group: "access" as const },
  { value: "all-ages", label: "All Ages", group: "access" as const },
  { value: "family-friendly", label: "Family", group: "access" as const },
  // Vibe tags
  { value: "date-night", label: "Date Night", group: "vibe" as const },
  { value: "chill", label: "Chill", group: "vibe" as const },
  { value: "high-energy", label: "High Energy", group: "vibe" as const },
  // Special tags
  { value: "local-artist", label: "Local Artist", group: "special" as const },
  { value: "one-night-only", label: "One Night", group: "special" as const },
  { value: "holiday", label: "Holiday", group: "special" as const },
] as const;

interface QuickTagsRowProps {
  className?: string;
}

export default function QuickTagsRow({ className = "" }: QuickTagsRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get current active tags from URL
  const activeTags = useMemo(() => {
    const tagsParam = searchParams.get("tags");
    return tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // Toggle a tag on/off
  const toggleTag = useCallback(
    (tagValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const newTags = activeTags.includes(tagValue)
        ? activeTags.filter((t) => t !== tagValue)
        : [...activeTags, tagValue];

      if (newTags.length > 0) {
        params.set("tags", newTags.join(","));
      } else {
        params.delete("tags");
      }

      // Reset pagination when filters change
      params.delete("page");

      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [router, pathname, searchParams, activeTags]
  );

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Horizontal scrolling container */}
      <div
        ref={scrollRef}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:snap-none py-2 -mx-4 px-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {QUICK_TAGS.map((tag) => {
          const isActive = activeTags.includes(tag.value);
          const variant = getTagVariant(tag.value);

          return (
            <div key={tag.value} className="snap-start shrink-0">
              <FilterChip
                label={tag.label}
                variant={variant}
                active={isActive}
                size="md"
                onClick={() => toggleTag(tag.value)}
              />
            </div>
          );
        })}
        {/* Spacer for right padding */}
        <div className="shrink-0 w-4" aria-hidden="true" />
      </div>

      {/* Fade gradient on right edge (desktop only) */}
      <div
        className="hidden md:block absolute right-0 top-0 bottom-0 w-12 pointer-events-none z-10"
        style={{
          background: "linear-gradient(to right, transparent, var(--night))",
        }}
      />
    </div>
  );
}
