"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getCategoryColor } from "./CategoryIcon";
import { formatGenre } from "@/lib/series-utils";

export interface ActivityChipProps {
  label: string;
  type: "tag" | "category";
  value: string;
  count?: number;
  portalSlug?: string;
  size?: "sm" | "md";
  selected?: boolean;
  onClick?: () => void;
}

// Activity definitions with vector icon types (maps to CategoryIcon)
export const POPULAR_ACTIVITIES = [
  { label: "Music", value: "music", type: "category" as const, iconType: "music" },
  { label: "Comedy", value: "comedy", type: "category" as const, iconType: "comedy" },
  { label: "Nightlife", value: "nightlife", type: "category" as const, iconType: "club" },
  { label: "Art", value: "art", type: "category" as const, iconType: "art" },
  { label: "Food & Drink", value: "food_drink", type: "category" as const, iconType: "food_drink" },
  { label: "Community", value: "community", type: "category" as const, iconType: "community" },
] as const;

// Helper to get icon color
export function getActivityColor(iconType: string): string {
  return getCategoryColor(iconType) || "#F97068";
}

// Build URL for activity filter
function buildActivityUrl(
  type: "tag" | "category",
  value: string,
  portalSlug?: string,
  existingParams?: URLSearchParams
): string {
  const params = new URLSearchParams(existingParams?.toString() || "");

  // Clear any existing activity filters to avoid conflicts
  params.delete("tags");
  params.delete("categories");

  // Set the appropriate filter (use plural param names to match convention)
  if (type === "tag") {
    params.set("tags", value);
  } else if (type === "category") {
    params.set("categories", value);
  }

  // Keep the find view active
  params.set("view", "find");
  params.set("type", "events");

  const queryString = params.toString();
  const basePath = portalSlug ? `/${portalSlug}` : "";
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export default function ActivityChip({
  label,
  type,
  value,
  count,
  portalSlug,
  size = "md",
  selected = false,
  onClick,
}: ActivityChipProps) {
  const searchParams = useSearchParams();

  // Check if this chip is currently active
  const isActive = selected || (() => {
    if (type === "tag") {
      return searchParams.get("tags")?.split(",").includes(value);
    } else if (type === "category") {
      return searchParams.get("categories")?.split(",").includes(value);
    }
    return false;
  })();

  const href = buildActivityUrl(type, value, portalSlug, searchParams);

  const sizeClasses = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
  };

  const baseClasses = `
    inline-flex items-center gap-1.5 rounded-full font-medium transition-all btn-press
    focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)]
    ${sizeClasses[size]}
  `;

  const activeClasses = isActive
    ? "bg-[var(--coral)]/20 text-[var(--coral)] border border-[var(--coral)]/30"
    : "bg-[var(--twilight)] text-[var(--soft)] hover:text-[var(--cream)] hover:bg-[var(--dusk)] border border-transparent";

  const content = (
    <>
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span className={`
          font-mono text-[0.65rem] px-1.5 rounded-full
          ${isActive ? "bg-[var(--coral)]/30 text-[var(--coral)]" : "bg-[var(--night)] text-[var(--muted)]"}
        `}>
          {count}
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className={`${baseClasses} ${activeClasses}`}
        aria-pressed={isActive}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={`${baseClasses} ${activeClasses}`}
      aria-current={isActive ? "page" : undefined}
    >
      {content}
    </Link>
  );
}


// Compact genre chip for inline use (e.g., on EventCard — uses button to avoid nested <a> inside card links)
export function GenreChip({
  genre,
  category,
  portalSlug,
}: {
  genre: string;
  category?: string | null;
  portalSlug?: string;
}) {
  const router = useRouter();
  const params = new URLSearchParams();
  params.set("view", "find");
  params.set("type", "events");
  if (category) params.set("categories", category);
  params.set("genres", genre);
  const basePath = portalSlug ? `/${portalSlug}` : "";
  const href = `${basePath}?${params.toString()}`;

  return (
    <button
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.65rem] font-mono
        bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)]
        transition-colors border border-[var(--twilight)]"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        router.push(href);
      }}
    >
      {formatGenre(genre)}
    </button>
  );
}

