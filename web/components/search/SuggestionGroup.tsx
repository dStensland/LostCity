"use client";

import { type SearchResult } from "@/lib/unified-search";
import { TypeIcon } from "../SearchResultItem";

// ============================================
// Types
// ============================================

export interface SuggestionGroupProps {
  /** Type of results in this group */
  type: SearchResult["type"];
  /** Results to display */
  results: (SearchResult & { personalizationReason?: string })[];
  /** Current search query for highlighting */
  query: string;
  /** Currently selected index in the flattened list */
  selectedIndex: number;
  /** Starting index of this group in the flattened list */
  startIndex: number;
  /** Called when a suggestion is selected */
  onSelect: (result: SearchResult) => void;
  /** Called when mouse enters a suggestion */
  onHover: (index: number) => void;
  /** Maximum items to show (default: 3) */
  maxItems?: number;
  /** Total count from facets (if available) */
  totalCount?: number;
  /** Called when "view all" is clicked */
  onViewAll?: () => void;
}

// ============================================
// Component
// ============================================

export default function SuggestionGroup({
  type,
  results,
  query,
  selectedIndex,
  startIndex,
  onSelect,
  onHover,
  maxItems = 3,
  totalCount,
  onViewAll,
}: SuggestionGroupProps) {
  if (results.length === 0) return null;

  const displayResults = results.slice(0, maxItems);
  const typeLabel = getTypeLabel(type);
  const typeColor = getTypeColor(type);
  const displayCount = totalCount ?? results.length;
  const hasMore = displayCount > maxItems;

  return (
    <div className="py-1">
      {/* Group header */}
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-1">
        <TypeIcon type={type} className={`h-3 w-3 ${typeColor}`} />
        <span
          className="text-[0.6rem] font-mono uppercase tracking-wider"
          style={{ color: getTypeAccent(type) }}
        >
          {typeLabel}
        </span>
        {displayCount > 0 && (
          <span className="text-[0.55rem] text-[var(--muted)]">
            ({displayCount})
          </span>
        )}
        {hasMore && onViewAll && (
          <button
            onMouseDown={onViewAll}
            className="text-[0.55rem] text-[var(--coral)] hover:text-[var(--rose)] transition-colors ml-auto font-mono"
          >
            view all
          </button>
        )}
      </div>

      {/* Results */}
      {displayResults.map((result, idx) => {
        const globalIndex = startIndex + idx;
        const isSelected = selectedIndex === globalIndex;

        return (
          <button
            key={`${result.type}-${result.id}`}
            id={`suggestion-${globalIndex}`}
            role="option"
            aria-selected={isSelected}
            onMouseDown={() => onSelect(result)}
            onMouseEnter={() => onHover(globalIndex)}
            className={`flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm rounded-lg transition-all mx-1 ${
              isSelected
                ? "bg-[var(--twilight)] text-[var(--cream)] translate-x-0.5"
                : "text-[var(--cream)] hover:bg-[var(--twilight)]/50"
            }`}
            style={{ width: "calc(100% - 8px)" }}
          >
            {/* Result icon */}
            <TypeIcon
              type={result.type}
              className={`h-3.5 w-3.5 flex-shrink-0 ${typeColor}`}
            />

            {/* Title with highlight */}
            <span className="flex-1 truncate">
              <HighlightMatch text={result.title} query={query} />
            </span>

            {/* Metadata */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Personalization badge */}
              {result.personalizationReason && (
                <span className="text-[0.5rem] font-medium px-1.5 py-0.5 rounded bg-[var(--coral)]/20 text-[var(--coral)]">
                  {result.personalizationReason}
                </span>
              )}

              {/* Subtitle/metadata */}
              {result.subtitle && (
                <span className="text-[0.65rem] text-[var(--muted)] max-w-[100px] truncate">
                  {result.subtitle}
                </span>
              )}

              {/* Date for events */}
              {result.type === "event" && result.metadata?.date && (
                <span className="text-[0.6rem] text-[var(--soft)]">
                  {formatEventDate(result.metadata.date)}
                </span>
              )}

              {/* Free badge */}
              {result.metadata?.isFree && (
                <span className="text-[0.5rem] font-medium px-1.5 py-0.5 rounded bg-[var(--neon-green)]/20 text-[var(--neon-green)]">
                  Free
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// Helper Functions
// ============================================

function getTypeLabel(type: SearchResult["type"]): string {
  const labels: Record<SearchResult["type"], string> = {
    event: "Events",
    venue: "Venues",
    organizer: "Organizers",
    series: "Series",
    list: "Lists",
    neighborhood: "Neighborhoods",
    category: "Categories",
  };
  return labels[type] || type;
}

function getTypeColor(type: SearchResult["type"]): string {
  const colors: Record<SearchResult["type"], string> = {
    event: "text-[var(--neon-magenta)]",
    venue: "text-[var(--coral)]",
    organizer: "text-[var(--coral)]",
    series: "text-[var(--gold)]",
    list: "text-[var(--neon-green)]",
    neighborhood: "text-[var(--soft)]",
    category: "text-[var(--muted)]",
  };
  return colors[type] || "text-[var(--muted)]";
}

function getTypeAccent(type: SearchResult["type"]): string {
  const colors: Record<SearchResult["type"], string> = {
    event: "var(--neon-magenta)",
    venue: "var(--coral)",
    organizer: "var(--coral)",
    series: "var(--gold)",
    list: "var(--neon-green)",
    neighborhood: "var(--soft)",
    category: "var(--muted)",
  };
  return colors[type] || "var(--muted)";
}

function formatEventDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.getTime() === today.getTime()) {
      return "Today";
    }
    if (date.getTime() === tomorrow.getTime()) {
      return "Tomorrow";
    }

    // Within this week, show day name
    const daysUntil = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil >= 0 && daysUntil < 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    }

    // Otherwise show short date
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <span className="text-[var(--coral)] font-medium">
        {text.slice(index, index + query.length)}
      </span>
      {text.slice(index + query.length)}
    </>
  );
}
