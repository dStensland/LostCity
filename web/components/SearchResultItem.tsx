"use client";

import Link from "next/link";
import type { SearchResult } from "@/lib/unified-search";

interface SearchResultItemProps {
  result: SearchResult;
  onClick?: () => void;
  portalSlug?: string;
  compact?: boolean;
}

/**
 * Type-aware search result display component.
 * Renders different icons, colors, and metadata based on result type.
 */
export default function SearchResultItem({
  result,
  onClick,
  portalSlug,
  compact = false,
}: SearchResultItemProps) {
  const config = getTypeConfig(result.type);
  const href = getPortalAwareHref(result, portalSlug);

  return (
    <Link
      href={href}
      scroll={false}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg hover:bg-[var(--twilight)] transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-inset ${
        compact ? "p-2" : "p-2.5"
      }`}
    >
      {/* Type Icon */}
      <div
        className={`flex items-center justify-center flex-shrink-0 rounded-lg ${config.bgClass} ${
          compact ? "w-8 h-8" : "w-10 h-10"
        }`}
      >
        <TypeIcon type={result.type} className={`${compact ? "w-4 h-4" : "w-5 h-5"} ${config.iconClass}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`font-medium text-[var(--cream)] truncate group-hover:${config.hoverClass} transition-colors ${
            compact ? "text-sm" : ""
          }`}
        >
          {result.title}
        </p>
        <p className={`text-[var(--soft)] truncate ${compact ? "text-xs" : "text-xs"}`}>
          {getSubtitle(result)}
        </p>
      </div>

      {/* Badge */}
      {getBadge(result) && (
        <span
          className={`text-[0.6rem] font-mono uppercase tracking-wide px-2 py-0.5 rounded-full flex-shrink-0 ${getBadgeClasses(
            result
          )}`}
        >
          {getBadge(result)}
        </span>
      )}
    </Link>
  );
}

/**
 * Standalone icon component for use in other contexts
 */
export function TypeIcon({ type, className = "" }: { type: SearchResult["type"]; className?: string }) {
  switch (type) {
    case "event":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      );
    case "venue":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    case "organizer":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      );
    case "series":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      );
    case "list":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      );
    case "neighborhood":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
      );
    case "category":
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      );
  }
}

// Type configuration for styling
interface TypeConfig {
  bgClass: string;
  iconClass: string;
  hoverClass: string;
}

function getTypeConfig(type: SearchResult["type"]): TypeConfig {
  switch (type) {
    case "event":
      return {
        bgClass: "bg-[var(--neon-magenta)]/10",
        iconClass: "text-[var(--neon-magenta)]",
        hoverClass: "text-[var(--neon-magenta)]",
      };
    case "venue":
      return {
        bgClass: "bg-[var(--coral)]/10",
        iconClass: "text-[var(--coral)]",
        hoverClass: "text-[var(--coral)]",
      };
    case "organizer":
      return {
        bgClass: "bg-[var(--coral)]/10",
        iconClass: "text-[var(--coral)]",
        hoverClass: "text-[var(--coral)]",
      };
    case "series":
      return {
        bgClass: "bg-[var(--gold)]/10",
        iconClass: "text-[var(--gold)]",
        hoverClass: "text-[var(--gold)]",
      };
    case "list":
      return {
        bgClass: "bg-[var(--neon-green)]/10",
        iconClass: "text-[var(--neon-green)]",
        hoverClass: "text-[var(--neon-green)]",
      };
    case "neighborhood":
      return {
        bgClass: "bg-[var(--soft)]/10",
        iconClass: "text-[var(--soft)]",
        hoverClass: "text-[var(--soft)]",
      };
    case "category":
      return {
        bgClass: "bg-[var(--muted)]/10",
        iconClass: "text-[var(--muted)]",
        hoverClass: "text-[var(--cream)]",
      };
    default:
      return {
        bgClass: "bg-[var(--twilight)]",
        iconClass: "text-[var(--muted)]",
        hoverClass: "text-[var(--cream)]",
      };
  }
}

// Build subtitle from metadata
function getSubtitle(result: SearchResult): string {
  const parts: string[] = [];

  if (result.subtitle) {
    parts.push(result.subtitle);
  }

  if (result.metadata) {
    const { date, neighborhood, orgType, eventCount, seriesType, itemCount, curatorName } = result.metadata;

    if (date) {
      parts.push(formatDate(date));
    }

    if (neighborhood && !result.subtitle?.includes(neighborhood)) {
      parts.push(neighborhood);
    }

    if (orgType) {
      parts.push(orgType);
    }

    if (seriesType) {
      parts.push(seriesType);
    }

    if (curatorName) {
      parts.push(`by ${curatorName}`);
    }

    if (eventCount !== undefined && eventCount > 0) {
      parts.push(`${eventCount} event${eventCount !== 1 ? "s" : ""}`);
    }

    if (itemCount !== undefined && itemCount > 0) {
      parts.push(`${itemCount} item${itemCount !== 1 ? "s" : ""}`);
    }
  }

  return parts.join(" · ");
}

// Format date for display
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if today
    if (date.toDateString() === now.toDateString()) {
      return "Today";
    }

    // Check if tomorrow
    if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow";
    }

    // Check if within the next 7 days
    const daysAway = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysAway > 0 && daysAway <= 7) {
      return date.toLocaleDateString("en-US", { weekday: "short" });
    }

    // Default format
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

// Get badge text for result
function getBadge(result: SearchResult): string | null {
  if (result.metadata?.isFree) {
    return "Free";
  }

  if (result.metadata?.category) {
    return result.metadata.category;
  }

  if (result.type === "series" && result.metadata?.eventCount) {
    return `${result.metadata.eventCount} dates`;
  }

  if (result.type === "list" && result.metadata?.itemCount) {
    return `${result.metadata.itemCount} items`;
  }

  return null;
}

// Get badge classes
function getBadgeClasses(result: SearchResult): string {
  if (result.metadata?.isFree) {
    return "bg-[var(--neon-green)]/20 text-[var(--neon-green)] border border-[var(--neon-green)]/30";
  }

  if (result.metadata?.category) {
    return "bg-[var(--dusk)] text-[var(--soft)] border border-[var(--twilight)]";
  }

  if (result.type === "series") {
    return "bg-[var(--gold)]/20 text-[var(--gold)] border border-[var(--gold)]/30";
  }

  if (result.type === "list") {
    // Use soft/neutral color to distinguish from "Free" badge
    return "bg-[var(--soft)]/20 text-[var(--soft)] border border-[var(--soft)]/30";
  }

  return "bg-[var(--dusk)] text-[var(--soft)] border border-[var(--twilight)]";
}

// Build portal-aware href
function getPortalAwareHref(result: SearchResult, portalSlug?: string): string {
  if (!portalSlug) return result.href;

  // Map based on type - use ?param=value format for in-page detail views
  if (result.type === "event") {
    return `/${portalSlug}?event=${result.id}`;
  } else if (result.type === "venue") {
    const slug = result.href.split("/").pop();
    return `/${portalSlug}?spot=${slug}`;
  } else if (result.type === "organizer") {
    const slug = result.href.split("/").pop();
    return `/${portalSlug}?org=${slug}`;
  } else if (result.type === "series") {
    const slug = result.href.split("/").pop();
    return `/${portalSlug}?series=${slug}`;
  } else if (result.type === "list") {
    // Lists stay as full path
    return result.href;
  }

  return result.href;
}

/**
 * Section header for grouped results
 */
export function SearchResultSection({
  type,
  count,
  shownCount,
  onSeeMore,
  children,
}: {
  type: SearchResult["type"];
  count?: number;
  shownCount?: number;
  onSeeMore?: () => void;
  children: React.ReactNode;
}) {
  const labels: Record<string, string> = {
    event: "Events",
    venue: "Venues",
    organizer: "Organizers",
    series: "Series",
    list: "Lists",
    neighborhood: "Neighborhoods",
    category: "Categories",
  };

  const config = getTypeConfig(type);
  const hasMore = count !== undefined && shownCount !== undefined && count > shownCount;

  return (
    <div className="p-3">
      <h3 className="flex items-center gap-2 text-xs font-mono font-semibold text-[var(--muted)] uppercase tracking-wider mb-2 px-2">
        <TypeIcon type={type} className={`w-3.5 h-3.5 ${config.iconClass}`} />
        {labels[type] || type}
        {count !== undefined && <span className="text-[var(--muted)]/60">({count})</span>}
      </h3>
      <div className="space-y-0.5">{children}</div>
      {hasMore && onSeeMore && (
        <button
          onClick={onSeeMore}
          className={`w-full mt-2 px-3 py-2 text-xs font-mono rounded-lg transition-colors hover:bg-[var(--twilight)] ${config.iconClass}`}
        >
          See {count - shownCount} more {labels[type]?.toLowerCase() || type}
        </button>
      )}
    </div>
  );
}
