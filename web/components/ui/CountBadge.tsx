/**
 * CountBadge — Notification count indicator.
 *
 * Replaces 8+ inline implementations of the coral notification dot/count.
 * Supports two placement modes:
 *   - "inline": Flows with text, for use in filter bars
 *   - "overlay": Absolutely positioned, for icons/buttons
 *
 * Usage:
 *   <div className="relative">
 *     <BellIcon />
 *     <CountBadge count={3} placement="overlay" />
 *   </div>
 *
 *   <button>
 *     Filters <CountBadge count={2} placement="inline" />
 *   </button>
 */

interface CountBadgeProps {
  count: number;
  /** "overlay" positions absolute top-right, "inline" flows with text */
  placement?: "overlay" | "inline";
  /** Max count before showing "N+" (default 99) */
  max?: number;
  className?: string;
}

export default function CountBadge({
  count,
  placement = "inline",
  max = 99,
  className = "",
}: CountBadgeProps) {
  if (count <= 0) return null;

  const display = count > max ? `${max}+` : String(count);

  const baseClasses =
    "flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--coral)] text-[var(--void)] text-2xs font-bold leading-none";

  const placementClasses =
    placement === "overlay"
      ? "absolute -top-0.5 -right-0.5"
      : "inline-flex";

  return (
    <span className={`${baseClasses} ${placementClasses} ${className}`}>
      {display}
    </span>
  );
}
