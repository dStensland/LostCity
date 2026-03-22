"use client";

import { forwardRef } from "react";

export type FilterChipVariant =
  | "default"      // Gray/muted
  | "search"       // Action-primary (coral on Atlanta, portal-themed elsewhere)
  | "category"     // Cream
  | "genre"        // Coral
  | "date"         // Gold
  | "vibe"         // Lavender
  | "access"       // Cyan
  | "special"      // Gold
  | "free";        // Green

export interface FilterChipProps {
  label: string;
  variant?: FilterChipVariant;
  active?: boolean;
  removable?: boolean;
  size?: "sm" | "md";
  count?: number;        // Optional count badge
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}

// Variant color configurations with glow classes
const VARIANT_STYLES: Record<FilterChipVariant, { active: string; inactive: string; glowClass: string }> = {
  default: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--soft)]",
    active: "bg-[var(--twilight)] text-[var(--cream)] border-[var(--soft)]",
    glowClass: "",
  },
  search: {
    inactive: "border-[var(--action-primary)]/40 text-[var(--action-primary)] hover:border-[var(--action-primary)]",
    active: "bg-[var(--action-primary)]/15 text-[var(--action-primary)] border-[var(--action-primary)]/50",
    glowClass: "chip-glow-coral",
  },
  category: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--cream)]/50",
    active: "bg-[var(--cream)] text-[var(--void)] border-[var(--cream)]",
    glowClass: "chip-glow-cream",
  },
  genre: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--coral)] hover:border-[var(--coral)]/50",
    active: "bg-[var(--coral)] text-[var(--void)] border-[var(--coral)]",
    glowClass: "chip-glow-coral",
  },
  date: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/50",
    active: "bg-[var(--gold)] text-[var(--void)] border-[var(--gold)]",
    glowClass: "chip-glow-gold",
  },
  vibe: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--vibe)] hover:border-[var(--vibe)]/50",
    active: "bg-[var(--mood-active)] text-[var(--cream)] border-[var(--mood-active)]",
    glowClass: "chip-glow-vibe",
  },
  access: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--coral)] hover:border-[var(--coral)]/50",
    active: "bg-[var(--coral)] text-[var(--void)] border-[var(--coral)]",
    glowClass: "chip-glow-coral",
  },
  special: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/50",
    active: "bg-[var(--gold)] text-[var(--void)] border-[var(--gold)]",
    glowClass: "chip-glow-gold",
  },
  free: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--neon-green)] hover:border-[var(--neon-green)]/50",
    active: "bg-[var(--neon-green)] text-[var(--void)] border-[var(--neon-green)]",
    glowClass: "chip-glow-green",
  },
};

const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ label, variant = "default", active = false, removable = false, size = "md", count, onClick, onRemove, className = "" }, ref) => {
    const sizeClasses = size === "sm"
      ? "min-h-[44px] sm:min-h-[32px] px-3 sm:px-2.5 py-2 sm:py-1 text-2xs"
      : "min-h-[44px] sm:min-h-[36px] px-3.5 sm:px-3 py-2.5 sm:py-1.5 text-xs";

    const styles = VARIANT_STYLES[variant];
    const variantClasses = active ? styles.active : styles.inactive;
    const glowClasses = active ? styles.glowClass : "";

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onRemove) {
        onRemove();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={`
          inline-flex items-center gap-1.5 rounded-full border font-mono font-medium
          transition-all duration-150 ease-out active:scale-95
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--night)]
          touch-action-manipulation
          ${sizeClasses}
          ${variantClasses}
          ${glowClasses}
          ${className}
        `}
        style={{ touchAction: 'manipulation' }}
        aria-pressed={active}
      >
        <span className="whitespace-nowrap">{label}</span>
        {/* Count badge */}
        {count !== undefined && count > 0 && (
          <span
            className={`
              flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-2xs font-bold
              ${active ? "bg-black/20 text-inherit" : "bg-[var(--twilight)] text-[var(--muted)]"}
            `}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
        {removable && active && (
          <span
            role="button"
            tabIndex={0}
            onClick={handleRemove}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleRemove(e as unknown as React.MouseEvent);
              }
            }}
            className="relative z-10 flex items-center justify-center w-5 h-5 -mr-1 rounded-full hover:bg-black/20 transition-colors cursor-pointer"
            aria-label={`Remove ${label} filter`}
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </span>
        )}
      </button>
    );
  }
);

FilterChip.displayName = "FilterChip";

export default FilterChip;

// Helper to determine variant from tag group
export function getTagVariant(tagValue: string): FilterChipVariant {
  // Import TAG_GROUPS dynamically to avoid circular deps
  const vibeValues = ["date-night", "chill", "high-energy", "intimate"];
  const accessValues = ["free", "all-ages", "18+", "21+", "family-friendly", "accessible", "outdoor"];

  if (vibeValues.includes(tagValue)) return "vibe";
  if (accessValues.includes(tagValue)) return "access";
  return "special";
}
