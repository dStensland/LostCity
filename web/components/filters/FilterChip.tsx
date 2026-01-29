"use client";

import { forwardRef } from "react";

export type FilterChipVariant =
  | "default"      // Gray/muted
  | "category"     // Cream
  | "subcategory"  // Coral
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
  onClick?: () => void;
  onRemove?: () => void;
  className?: string;
}

// Variant color configurations
const VARIANT_STYLES: Record<FilterChipVariant, { active: string; inactive: string }> = {
  default: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--soft)]",
    active: "bg-[var(--twilight)] text-[var(--cream)] border-[var(--soft)]",
  },
  category: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] hover:border-[var(--cream)]/50",
    active: "bg-[var(--cream)] text-[var(--void)] border-[var(--cream)]",
  },
  subcategory: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--coral)] hover:border-[var(--coral)]/50",
    active: "bg-[var(--coral)] text-[var(--void)] border-[var(--coral)] shadow-[0_0_8px_var(--coral)/25]",
  },
  date: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/50",
    active: "bg-[var(--gold)] text-[var(--void)] border-[var(--gold)]",
  },
  vibe: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[#C4B5FD] hover:border-[#C4B5FD]/50",
    active: "bg-[#C4B5FD] text-[var(--void)] border-[#C4B5FD]",
  },
  access: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--neon-cyan)] hover:border-[var(--neon-cyan)]/50",
    active: "bg-[var(--neon-cyan)] text-[var(--void)] border-[var(--neon-cyan)]",
  },
  special: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--gold)] hover:border-[var(--gold)]/50",
    active: "bg-[var(--gold)] text-[var(--void)] border-[var(--gold)]",
  },
  free: {
    inactive: "border-[var(--twilight)] text-[var(--muted)] hover:text-[var(--neon-green)] hover:border-[var(--neon-green)]/50",
    active: "bg-[var(--neon-green)] text-[var(--void)] border-[var(--neon-green)]",
  },
};

const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ label, variant = "default", active = false, removable = false, size = "md", onClick, onRemove, className = "" }, ref) => {
    const sizeClasses = size === "sm"
      ? "min-h-[32px] px-2.5 text-[0.6rem]"
      : "min-h-[36px] px-3 text-[0.65rem]";

    const styles = VARIANT_STYLES[variant];
    const variantClasses = active ? styles.active : styles.inactive;

    const handleClick = () => {
      if (onClick) {
        onClick();
      }
    };

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
        onClick={handleClick}
        className={`
          inline-flex items-center gap-1.5 rounded-full border font-mono font-medium
          transition-all duration-150 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--night)]
          ${sizeClasses}
          ${variantClasses}
          ${className}
        `}
        aria-pressed={active}
      >
        <span className="whitespace-nowrap">{label}</span>
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
            className="flex items-center justify-center w-3.5 h-3.5 -mr-1 rounded-full hover:bg-black/20 transition-colors"
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
