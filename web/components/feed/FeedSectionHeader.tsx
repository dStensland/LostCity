"use client";

import Link from "next/link";
import { ReactNode } from "react";

export type SectionPriority = "primary" | "secondary" | "tertiary";

export interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  priority: SectionPriority;
  accentColor?: string;
  icon?: ReactNode;
  badge?: string; // "Curated", "Seasonal", "HOT", etc.
  seeAllHref?: string;
  seeAllLabel?: string;
  className?: string;
}

// Star icon for primary sections
const StarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

export default function FeedSectionHeader({
  title,
  subtitle,
  priority,
  accentColor,
  icon,
  badge,
  seeAllHref,
  seeAllLabel = "See all",
  className = "",
}: SectionHeaderProps) {
  // Priority-based styling
  const getPriorityStyles = () => {
    switch (priority) {
      case "primary":
        return {
          titleClass: "section-header-primary text-2xl",
          subtitleClass: "font-mono text-xs text-[var(--muted)] mt-0.5",
          containerClass: "mb-5 pb-2",
          iconSize: "w-6 h-6",
          defaultAccent: "var(--gold)",
          showDefaultIcon: true,
        };
      case "secondary":
        return {
          titleClass: "section-header-secondary text-xl",
          subtitleClass: "font-mono text-[0.65rem] text-[var(--muted)] mt-0.5",
          containerClass: "mb-4",
          iconSize: "w-5 h-5",
          defaultAccent: accentColor || "var(--coral)",
          showDefaultIcon: false,
        };
      case "tertiary":
        return {
          titleClass: "section-header-tertiary text-lg",
          subtitleClass: "font-mono text-[0.6rem] text-[var(--muted)] mt-0.5 normal-case tracking-normal",
          containerClass: "mb-3",
          iconSize: "w-4 h-4",
          defaultAccent: "var(--muted)",
          showDefaultIcon: false,
        };
    }
  };

  const styles = getPriorityStyles();
  const effectiveAccent = accentColor || styles.defaultAccent;

  // Determine which icon to show
  const displayIcon = icon || (styles.showDefaultIcon ? <StarIcon className={styles.iconSize} /> : null);

  // Icon glow class based on priority
  const iconGlowClass = priority === "primary"
    ? "section-header-icon section-header-icon-primary"
    : "section-header-icon section-header-icon-secondary";

  // See-all button class based on priority
  const seeAllClass = priority === "primary"
    ? "section-header-see-all section-header-see-all-primary"
    : "section-header-see-all";

  return (
    <div
      className={`flex items-center justify-between ${styles.containerClass} ${className}`}
      style={{ "--section-accent": effectiveAccent } as React.CSSProperties}
    >
      <div className="flex items-center gap-3">
        {/* Icon with glow (for primary and secondary) */}
        {displayIcon && priority !== "tertiary" && (
          <div
            className={`flex items-center justify-center ${priority === "primary" ? "w-12 h-12" : "w-10 h-10"} rounded-lg ${iconGlowClass}`}
            style={{ color: effectiveAccent }}
          >
            {displayIcon}
          </div>
        )}

        <div>
          {/* Badge (above title for primary) */}
          {badge && priority === "primary" && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-mono font-medium uppercase tracking-wider mb-1"
              style={{
                backgroundColor: `color-mix(in srgb, ${effectiveAccent} 20%, transparent)`,
                color: effectiveAccent,
                border: `1px solid color-mix(in srgb, ${effectiveAccent} 30%, transparent)`,
              }}
            >
              {badge}
            </span>
          )}

          {/* Title */}
          <h3
            className={styles.titleClass}
            style={{
              color: priority === "tertiary" ? "var(--soft)" : accentColor || "var(--cream)",
              textShadow: priority === "primary" && accentColor
                ? `0 0 20px color-mix(in srgb, ${accentColor} 50%, transparent)`
                : undefined,
            }}
          >
            {title}
            {/* Inline badge for secondary/tertiary */}
            {badge && priority !== "primary" && (
              <span
                className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[0.55rem] font-mono font-medium uppercase"
                style={{
                  backgroundColor: `color-mix(in srgb, ${effectiveAccent} 20%, transparent)`,
                  color: effectiveAccent,
                }}
              >
                {badge}
              </span>
            )}
          </h3>

          {/* Subtitle */}
          {subtitle && (
            <p className={styles.subtitleClass}>{subtitle}</p>
          )}
        </div>
      </div>

      {/* See All link */}
      {seeAllHref && (
        <Link
          href={seeAllHref}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono transition-all group hover:scale-105 ${seeAllClass}`}
          style={{ color: effectiveAccent }}
        >
          {seeAllLabel}
          <svg
            className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
