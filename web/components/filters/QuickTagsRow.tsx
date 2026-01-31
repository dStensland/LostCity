"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import FilterChip, { getTagVariant } from "./FilterChip";

// Group configuration for visual separation
type TagGroup = "access" | "vibe" | "special";

const GROUP_ORDER: TagGroup[] = ["access", "vibe", "special"];

// Approximate average width of a filter chip for overflow calculation
const AVERAGE_CHIP_WIDTH = 90;

const GROUP_LABELS: Record<TagGroup, string> = {
  access: "Access",
  vibe: "Vibe",
  special: "Special",
};

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

// Group tags by their group
function groupTagsByType() {
  const groups: Record<TagGroup, typeof QUICK_TAGS[number][]> = {
    access: [],
    vibe: [],
    special: [],
  };
  for (const tag of QUICK_TAGS) {
    groups[tag.group].push(tag);
  }
  return groups;
}

interface QuickTagsRowProps {
  className?: string;
  showGroupLabels?: boolean;
}

export default function QuickTagsRow({ className = "", showGroupLabels = false }: QuickTagsRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowCount, setOverflowCount] = useState(0);

  // Get current active tags from URL
  const activeTags = useMemo(() => {
    const tagsParam = searchParams.get("tags");
    return tagsParam ? tagsParam.split(",").filter(Boolean) : [];
  }, [searchParams]);

  // Group tags by type
  const groupedTags = useMemo(() => groupTagsByType(), []);

  // Check for overflow
  useEffect(() => {
    const checkOverflow = () => {
      if (!scrollRef.current) return;
      const { scrollWidth, clientWidth, scrollLeft } = scrollRef.current;
      const isAtEnd = scrollLeft >= scrollWidth - clientWidth - 20;

      if (!isAtEnd && scrollWidth > clientWidth) {
        // Calculate approximate number of hidden items
        const hiddenWidth = scrollWidth - clientWidth - scrollLeft;
        const hidden = Math.max(0, Math.floor(hiddenWidth / AVERAGE_CHIP_WIDTH));
        setOverflowCount(hidden);
      } else {
        setOverflowCount(0);
      }
    };

    checkOverflow();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkOverflow, { passive: true });
      window.addEventListener("resize", checkOverflow);
      return () => {
        el.removeEventListener("scroll", checkOverflow);
        window.removeEventListener("resize", checkOverflow);
      };
    }
  }, []);

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

  // Divider component - enhanced visibility
  const GroupDivider = () => (
    <div className="shrink-0 flex items-center mx-2" aria-hidden="true">
      <div className="w-px h-6 bg-[var(--twilight)]" />
    </div>
  );

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Horizontal scrolling container - keyboard accessible */}
      <div
        ref={scrollRef}
        tabIndex={0}
        role="region"
        aria-label="Quick filter tags"
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:snap-none py-2 -mx-4 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-inset rounded-lg"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {GROUP_ORDER.map((groupKey, groupIdx) => {
          const tags = groupedTags[groupKey];
          if (tags.length === 0) return null;

          return (
            <div key={groupKey} className="contents">
              {/* Group divider (except for first group) */}
              {groupIdx > 0 && <GroupDivider />}

              {/* Optional group label */}
              {showGroupLabels && (
                <span className="shrink-0 font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-wider px-1">
                  {GROUP_LABELS[groupKey]}
                </span>
              )}

              {/* Tags in this group */}
              {tags.map((tag) => {
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
            </div>
          );
        })}
        {/* Spacer for right padding */}
        <div className="shrink-0 w-4" aria-hidden="true" />
      </div>

      {/* Overflow indicator with count - accessible */}
      {overflowCount > 0 && (
        <div
          className="absolute right-0 top-0 bottom-0 flex items-center pointer-events-none z-10"
          style={{
            background: "linear-gradient(to right, transparent, var(--night) 50%)",
            paddingLeft: "2rem",
            paddingRight: "0.5rem",
          }}
        >
          <span
            className="font-mono text-[0.6rem] text-[var(--soft)] bg-[var(--twilight)] px-2 py-1 rounded-full border border-[var(--muted)]/30"
            aria-live="polite"
            aria-atomic="true"
          >
            +{overflowCount} more
          </span>
        </div>
      )}

      {/* Fade gradient on right edge (when no overflow count shown, desktop only) */}
      {overflowCount === 0 && (
        <div
          className="hidden md:block absolute right-0 top-0 bottom-0 w-12 pointer-events-none z-10"
          style={{
            background: "linear-gradient(to right, transparent, var(--night))",
          }}
        />
      )}
    </div>
  );
}
