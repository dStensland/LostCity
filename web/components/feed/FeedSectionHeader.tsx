"use client";

import Link from "next/link";
import { ReactNode } from "react";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

export type SectionPriority = "primary" | "secondary" | "tertiary";

export type SectionVariant =
  | "lineup"
  | "cinema"
  | "destinations"
  | "horizon"
  | "regulars"
  | "meta"
  | "featured"
  | "gameday";

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
  /** Optional action button next to "See all" (e.g. gear icon for customization) */
  actionIcon?: ReactNode;
  onAction?: () => void;
  actionActive?: boolean;
  actionLabel?: string;
  /** Visual variant — overrides priority-based styling when set */
  variant?: SectionVariant;
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
  actionIcon,
  onAction,
  actionActive,
  actionLabel = "Customize",
  variant,
}: SectionHeaderProps) {
  // Priority-based styling
  const getPriorityStyles = () => {
    switch (priority) {
      case "primary":
        return {
          titleClass: "section-header-primary text-2xl",
          subtitleClass: "font-mono text-sm text-[var(--soft)] mt-0.5",
          containerClass: "mb-3 sm:mb-5 pb-2",
          iconSize: "w-6 h-6",
          defaultAccent: "var(--gold)",
          showDefaultIcon: true,
        };
      case "secondary":
        return {
          titleClass: "font-mono text-xs font-bold tracking-[0.1em] uppercase",
          subtitleClass: "font-mono text-xs text-[var(--soft)] mt-0.5 normal-case tracking-normal",
          containerClass: "mb-4 py-1",
          iconSize: "w-3.5 h-3.5",
          defaultAccent: accentColor || "var(--coral)",
          showDefaultIcon: false,
        };
      case "tertiary":
        return {
          titleClass: "section-header-tertiary text-base",
          subtitleClass: "font-mono text-xs text-[var(--soft)] mt-0.5 normal-case tracking-normal",
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
  const seeAllClass = priority === "primary"
    ? "section-header-see-all section-header-see-all-primary"
    : "";

  // ── Variant rendering (overrides priority-based layout) ──────────────────
  if (variant) {
    const seeAll = seeAllHref ? (
      <Link
        href={seeAllHref}
        className="flex items-center gap-1 text-xs font-mono transition-all group hover:opacity-80 text-accent shrink-0"
      >
        {seeAllLabel}
        <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    ) : null;

    const variantContent = (() => {
      switch (variant) {
        case "lineup":
          return (
            <>
              <div className="flex items-end justify-between">
                <h3 className="section-header-lineup">{title}</h3>
                {seeAll}
              </div>
              <div className="section-header-lineup-underline mt-2" />
            </>
          );

        case "cinema":
          return (
            <div className="flex items-center justify-between">
              <h3 className="section-header-cinema">{title}</h3>
              {seeAll}
            </div>
          );

        case "destinations":
          return (
            <div className="flex items-center gap-3">
              {displayIcon && (
                <span className="text-[var(--section-accent)] [&>svg]:w-[18px] [&>svg]:h-[18px]">{displayIcon}</span>
              )}
              <h3 className="section-header-destinations">{title}</h3>
              <div className="flex-1" />
              {seeAll}
            </div>
          );

        case "horizon":
          return (
            <div className="flex items-end justify-between">
              <h3 className="section-header-horizon">{title}</h3>
              {seeAll}
            </div>
          );

        case "regulars":
          return (
            <div className="flex items-center gap-3">
              {displayIcon && (
                <span className="text-[var(--section-accent)] [&>svg]:w-[18px] [&>svg]:h-[18px]">{displayIcon}</span>
              )}
              <h3 className="section-header-regulars">{title}</h3>
              <div className="flex-1" />
              {seeAll}
            </div>
          );

        case "meta":
          return (
            <>
              <div className="h-px bg-[var(--twilight)] mb-3" />
              <div className="flex items-center justify-between">
                <h3 className="section-header-meta">{title}</h3>
                {seeAll}
              </div>
            </>
          );

        case "featured":
          return (
            <div className="flex items-center gap-3">
              {badge && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-accent-20 border border-accent-40">
                  {displayIcon && (
                    <span className="text-[var(--section-accent)] [&>svg]:w-[14px] [&>svg]:h-[14px]">{displayIcon}</span>
                  )}
                  <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-accent">{badge}</span>
                </span>
              )}
              <h3 className="section-header-featured">{title}</h3>
              <div className="flex-1" />
              {seeAll}
            </div>
          );

        case "gameday":
          return (
            <div className="flex items-end justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-7 rounded-full bg-[var(--section-accent)]" />
                <h3 className="section-header-gameday">{title}</h3>
              </div>
              {seeAll}
            </div>
          );
      }
    })();

    return (
      <div
        className={`section-accent ${className} mb-4 ${accentClass?.className ?? ""}`}
      >
        <ScopedStyles css={accentClass?.css} />
        {variantContent}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between section-accent ${styles.containerClass} ${className} ${
        accentClass?.className ?? ""
      }`}
    >
      <ScopedStyles css={accentClass?.css} />
      <div className={`flex items-center ${priority === "secondary" ? "gap-2.5" : "gap-3"}`}>
        {priority === "tertiary" && (
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-1 rounded-full bg-[var(--section-accent)] shadow-[0_0_10px_var(--section-accent)]"
          />
        )}
        {/* Icon — tinted box for secondary, boxed+glow for primary */}
        {displayIcon && priority === "secondary" && (
          <div
            className="flex items-center justify-center w-5 h-5 rounded-md text-[var(--section-accent)] [&>svg]:w-3.5 [&>svg]:h-3.5"
            style={{ backgroundColor: `color-mix(in srgb, var(--section-accent) 12%, transparent)` }}
          >
            {displayIcon}
          </div>
        )}
        {displayIcon && priority === "primary" && (
          <div
            className={`flex items-center justify-center w-12 h-12 rounded-lg ${iconGlowClass} text-[var(--section-accent)]`}
          >
            {displayIcon}
          </div>
        )}

        <div>
          {/* Badge (above title for primary) */}
          {badge && priority === "primary" && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium uppercase tracking-wider mb-1 bg-accent-20 text-accent border border-accent-40"
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
                className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-mono font-medium uppercase bg-accent-20 text-accent"
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

      {/* Right side: action icon + See All link */}
      <div className="flex items-center gap-2">
        {actionIcon && onAction && (
          <button
            onClick={onAction}
            className={`p-1.5 rounded-lg transition-colors ${
              actionActive
                ? "text-[var(--section-accent)]"
                : "text-[var(--muted)] hover:text-[var(--soft)]"
            }`}
            aria-label={actionLabel}
            title={actionLabel}
          >
            {actionIcon}
          </button>
        )}
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className={`flex items-center gap-1 ${priority === "secondary" ? "text-xs" : "px-3 py-1.5 rounded-full text-xs"} font-mono transition-all group hover:scale-105 ${seeAllClass} text-accent`}
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
    </div>
  );
}
