"use client";

import Link from "next/link";
import { ReactNode } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

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

// Electric bolt icon for featured sections - punk energy, not corporate star
const FeaturedIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    {/* Main lightning bolt */}
    <path
      d="M13 2L4 14h7l-2 8 11-12h-7l2-8z"
      fill="currentColor"
      className="section-icon-glow"
    />
    {/* Electric crackle accents */}
    <path
      d="M18 5l2-2M20 9l2-1M6 18l-2 1M4 14l-2-1"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.6"
    />
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
          subtitleClass: "font-mono text-[0.78rem] text-[var(--soft)] mt-0.5",
          containerClass: "mb-3 sm:mb-5 pb-2",
          iconSize: "w-6 h-6",
          defaultAccent: "var(--gold)",
          showDefaultIcon: true,
        };
      case "secondary":
        return {
          titleClass: "section-header-secondary text-xl",
          subtitleClass: "font-mono text-[0.72rem] text-[var(--soft)] mt-0.5",
          containerClass: "mb-2 sm:mb-4",
          iconSize: "w-5 h-5",
          defaultAccent: accentColor || "var(--coral)",
          showDefaultIcon: false,
        };
      case "tertiary":
        return {
          titleClass: "section-header-tertiary text-[1.02rem]",
          subtitleClass: "font-mono text-[0.68rem] text-[var(--soft)] mt-0.5 normal-case tracking-normal",
          containerClass: "mb-2.5 sm:mb-3.5",
          iconSize: "w-4 h-4",
          defaultAccent: "var(--muted)",
          showDefaultIcon: false,
        };
    }
  };

  const styles = getPriorityStyles();
  const effectiveAccent = accentColor || styles.defaultAccent;
  const accentClass = createCssVarClass("--section-accent", effectiveAccent, "section-accent");
  const titleColorClass = priority === "tertiary"
    ? "text-[var(--cream)]/90"
    : accentColor
    ? "text-[var(--section-accent)]"
    : "text-[var(--cream)]";
  const titleGlowClass = priority === "primary" && accentColor ? "section-title-glow" : "";

  // Determine which icon to show
  const displayIcon = icon || (styles.showDefaultIcon ? <FeaturedIcon className={styles.iconSize} /> : null);

  // Icon glow class based on priority
  const iconGlowClass = priority === "primary"
    ? "section-header-icon section-header-icon-primary"
    : "section-header-icon section-header-icon-secondary";

  // See-all button class
  const seeAllClass = "section-header-see-all section-header-see-all-primary";

  return (
    <div
      className={`flex items-center justify-between section-accent ${styles.containerClass} ${className} ${
        accentClass?.className ?? ""
      }`}
    >
      <ScopedStyles css={accentClass?.css} />
      <div className="flex items-center gap-3">
        {priority === "tertiary" && (
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-1 rounded-full bg-[var(--section-accent)] shadow-[0_0_10px_var(--section-accent)]"
          />
        )}
        {/* Icon with glow (for primary and secondary) */}
        {displayIcon && priority !== "tertiary" && (
          <div
            className={`flex items-center justify-center ${priority === "primary" ? "w-12 h-12" : "w-10 h-10"} rounded-lg ${iconGlowClass} text-[var(--section-accent)]`}
          >
            {displayIcon}
          </div>
        )}

        <div>
          {/* Badge (above title for primary) */}
          {badge && priority === "primary" && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-mono font-medium uppercase tracking-wider mb-1 bg-accent-20 text-accent border border-accent-40"
            >
              {badge}
            </span>
          )}

          {/* Title */}
          <h3
            className={`${styles.titleClass} ${titleColorClass} ${titleGlowClass}`}
          >
            {title}
            {/* Inline badge for secondary/tertiary */}
            {badge && priority !== "primary" && (
              <span
                className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[0.55rem] font-mono font-medium uppercase bg-accent-20 text-accent"
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
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-mono transition-all group hover:scale-105 ${seeAllClass} text-accent`}
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
