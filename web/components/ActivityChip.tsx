"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";

export interface ActivityChipProps {
  label: string;
  type: "subcategory" | "tag" | "category";
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
  type: "subcategory" | "tag" | "category",
  value: string,
  portalSlug?: string,
  existingParams?: URLSearchParams
): string {
  const params = new URLSearchParams(existingParams?.toString() || "");

  // Clear any existing activity filters to avoid conflicts
  params.delete("subcategories");
  params.delete("tags");
  params.delete("categories");

  // Set the appropriate filter (use plural param names to match convention)
  if (type === "subcategory") {
    params.set("subcategories", value);
  } else if (type === "tag") {
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
    if (type === "subcategory") {
      return searchParams.get("subcategories")?.split(",").includes(value);
    } else if (type === "tag") {
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
    inline-flex items-center gap-1.5 rounded-full font-medium transition-all
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

// Compact version for inline use (e.g., on EventCard)
export function SubcategoryChip({
  label,
  value,
  portalSlug,
}: {
  label: string;
  value: string;
  portalSlug?: string;
}) {
  const href = buildActivityUrl("subcategory", value, portalSlug);

  return (
    <Link
      href={href}
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.65rem] font-mono
        bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--dusk)]
        transition-colors border border-[var(--twilight)]"
      onClick={(e) => e.stopPropagation()}
    >
      {label}
    </Link>
  );
}

// Get display label for a subcategory value
export function getSubcategoryLabel(subcategory: string): string | null {
  const labels: Record<string, string> = {
    // Nightlife
    "nightlife.trivia": "Trivia",
    "nightlife.dj": "DJ Night",
    "nightlife.karaoke": "Karaoke",
    "nightlife.open_mic": "Open Mic",
    "nightlife.drag": "Drag Show",
    "nightlife.happy_hour": "Happy Hour",
    "nightlife.dance_party": "Dance Party",
    "nightlife.burlesque": "Burlesque",
    // Comedy
    "comedy.standup": "Stand-Up",
    "comedy.improv": "Improv",
    "comedy.sketch": "Sketch",
    "comedy.open_mic": "Comedy Open Mic",
    // Music
    "music.jazz": "Jazz",
    "music.electronic": "Electronic",
    "music.hip_hop": "Hip Hop",
    "music.rock": "Rock",
    "music.indie": "Indie",
    "music.classical": "Classical",
    "music.country": "Country",
    "music.r_and_b": "R&B",
    "music.open_mic": "Open Mic",
    // Art
    "art.opening": "Art Opening",
    "art.gallery": "Gallery",
    "art.workshop": "Workshop",
    // Community
    "community.meetup": "Meetup",
    "community.networking": "Networking",
    "community.workshop": "Workshop",
    // Food & Drink
    "food_drink.tasting": "Tasting",
    "food_drink.brunch": "Brunch",
    "food_drink.dinner": "Dinner",
    "food_drink.popup": "Pop-Up",
    // Fitness
    "fitness.yoga": "Yoga",
    "fitness.running": "Running",
    "fitness.cycling": "Cycling",
    "fitness.dance": "Dance",
  };

  return labels[subcategory] || null;
}

// Check if a subcategory should be displayed (adds useful info)
export function shouldShowSubcategory(subcategory: string | null, category: string | null): boolean {
  if (!subcategory) return false;

  // Skip generic subcategories that don't add info
  const skipList = [
    "music.live", // redundant for music category
    "nightlife.bar", // too generic
    "community.general", // too generic
  ];

  if (skipList.includes(subcategory)) return false;

  // Skip subcategories that are redundant with the category
  // e.g., don't show "Jazz" for a music event since category already indicates music
  if (category && subcategory.startsWith(`${category}.`)) {
    // Only skip if it's just the basic type, not a specific activity
    const specificPart = subcategory.replace(`${category}.`, "");
    // Activities like trivia, dj, karaoke are valuable to show
    const valueAddSubtypes = ["trivia", "dj", "karaoke", "open_mic", "drag", "happy_hour", "standup", "improv"];
    if (!valueAddSubtypes.includes(specificPart)) {
      return false;
    }
  }

  // Check if we have a display label for it
  return getSubcategoryLabel(subcategory) !== null;
}
