/**
 * Badge — Color-coded pill badge for status, categories, and metadata.
 *
 * Replaces 150+ inline badge implementations. Uses design system tokens
 * for consistent color treatment across light and dark modes.
 *
 * Usage:
 *   <Badge variant="success">Open Now</Badge>
 *   <Badge variant="accent" accentColor="var(--coral)">Music</Badge>
 *   <Badge variant="neutral" size="sm">3 events</Badge>
 */

import type { ReactNode } from "react";

export type BadgeVariant = "neutral" | "success" | "alert" | "info" | "accent";
export type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  /** Custom accent color (CSS value). Used when variant="accent". */
  accentColor?: string;
  size?: BadgeSize;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--twilight)] text-[var(--soft)]",
  success: "bg-[var(--neon-green)]/15 text-[var(--neon-green)] border border-[var(--neon-green)]/30",
  alert: "bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/30",
  info: "bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)] border border-[var(--neon-cyan)]/30",
  accent: "", // styled dynamically via accentColor prop
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "px-1.5 py-1 text-2xs",
  md: "px-2.5 py-1 text-xs",
};

export default function Badge({
  children,
  variant = "neutral",
  accentColor,
  size = "md",
  className = "",
}: BadgeProps) {
  const baseClasses = "inline-flex items-center gap-1 rounded-full font-mono font-bold tracking-[1.2px] uppercase";
  const variantClasses = variant === "accent" ? "" : VARIANT_CLASSES[variant];
  const sizeClasses = SIZE_CLASSES[size];

  if (variant === "accent" && accentColor) {
    return (
      <span
        className={`${baseClasses} border ${sizeClasses} ${className}`}
        style={{
          backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
          color: accentColor,
          borderColor: `color-mix(in srgb, ${accentColor} 30%, transparent)`,
        }}
      >
        {children}
      </span>
    );
  }

  return (
    <span className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}>
      {children}
    </span>
  );
}
