"use client";

import { useState, useCallback, type ReactNode } from "react";
import Image from "@/components/SmartImage";
import CategoryPlaceholder from "../CategoryPlaceholder";
import BackButton from "../headers/BackButton";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClass } from "@/lib/css-utils";

export interface DetailHeroProps {
  mode: "image" | "poster" | "fallback";
  imageUrl?: string | null;
  title: string;
  subtitle?: string;
  category?: string | null;
  categoryColor?: string;
  categoryIcon?: ReactNode;
  badge?: ReactNode;
  isLive?: boolean;
  /** @deprecated Use `portrait` instead */
  tall?: boolean;
  /** Use taller (4:3) ratio for event/festival imagery. Default is landscape (16:9). */
  portrait?: boolean;
  /** When provided, renders a floating back button over the hero. */
  backFallbackHref?: string;
  children?: ReactNode;
}

const BACK_BUTTON_CLASS =
  "absolute top-3 left-3 sm:top-4 sm:left-4 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm text-white/90 hover:bg-black/70 hover:text-white transition-colors";

export function DetailHero({
  mode,
  imageUrl,
  title,
  subtitle,
  category,
  categoryColor = "var(--action-primary)",
  categoryIcon,
  badge,
  isLive,
  tall,
  portrait,
  backFallbackHref,
  children,
}: DetailHeroProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isLowRes, setIsLowRes] = useState(false);
  const heroAccentClass = createCssVarClass("--hero-accent", categoryColor, "hero-accent");

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setImgLoaded(true);
    if (e.currentTarget.naturalWidth < 600) setIsLowRes(true);
  }, []);

  // Determine effective mode (fallback if image error)
  const effectiveMode = !imageUrl || imgError ? "fallback" : mode;
  const aspectClass = (portrait || tall) ? "aspect-[4/3]" : "aspect-video";

  if (effectiveMode === "fallback") {
    return (
      <div className={`relative w-full ${aspectClass} sm:rounded-lg overflow-hidden bg-gradient-to-br from-[var(--dusk)] via-[var(--night)] to-[var(--void)] ${heroAccentClass?.className ?? ""}`}>
        <ScopedStyles css={heroAccentClass?.css} />
        {backFallbackHref && (
          <BackButton fallbackHref={backFallbackHref} label="Back" className={BACK_BUTTON_CLASS} iconOnly />
        )}
        {/* Neon category placeholder */}
        <CategoryPlaceholder category={category} color={categoryColor} size="lg" />

        <HeroOverlay
          title={title}
          subtitle={subtitle}
          badge={badge}
          isLive={isLive}
        >
          {children}
        </HeroOverlay>
      </div>
    );
  }

  if (effectiveMode === "poster") {
    return (
      <div className={`relative w-full sm:rounded-lg overflow-hidden bg-[var(--night)] ${heroAccentClass?.className ?? ""}`}>
        <ScopedStyles css={heroAccentClass?.css} />
        {backFallbackHref && (
          <BackButton fallbackHref={backFallbackHref} label="Back" className={BACK_BUTTON_CLASS} iconOnly />
        )}
        <div className="flex flex-col sm:flex-row gap-6 p-6">
          {/* Image (poster) */}
          <div className="relative w-full sm:w-[200px] aspect-square sm:aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden">
            {!imgLoaded && (
              <div
                className="absolute inset-0 skeleton-shimmer detail-hero-skeleton"
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  {categoryIcon}
                </div>
              </div>
            )}
            {imageUrl && (
              <Image
                src={imageUrl}
                alt={title}
                fill
                className={`${isLowRes ? "object-contain" : "object-cover"} transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                onError={() => setImgError(true)}
                onLoad={handleImageLoad}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {badge && <div className="mb-3">{badge}</div>}

            <h1
              className="text-2xl sm:text-3xl md:text-[2rem] font-semibold text-[var(--cream)] tracking-tight leading-[1.08] mb-2 max-w-[24ch] line-clamp-3 detail-hero-title-glow"
            >
              {title}
            </h1>

            {subtitle && (
              <p className="text-base text-[var(--soft)] mb-4 line-clamp-2">{subtitle}</p>
            )}

            {children}
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-[3px] detail-hero-bar" />
      </div>
    );
  }

  // Default: image mode (full-width with overlay)
  return (
    <div className={`relative w-full ${aspectClass} sm:rounded-lg overflow-hidden ${heroAccentClass?.className ?? ""}`}>
      <ScopedStyles css={heroAccentClass?.css} />
      {backFallbackHref && (
        <BackButton fallbackHref={backFallbackHref} label="Back" className={BACK_BUTTON_CLASS} iconOnly />
      )}
      {!imgLoaded && (
        <div
          className="absolute inset-0 skeleton-shimmer detail-hero-skeleton"
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            {categoryIcon}
          </div>
        </div>
      )}
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={title}
          fill
          className={`object-cover brightness-[0.85] contrast-[1.05] transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          onError={() => setImgError(true)}
          onLoad={handleImageLoad}
        />
      )}

      <HeroOverlay
        categoryColor={categoryColor}
        title={title}
        subtitle={subtitle}
        badge={badge}
        isLive={isLive}
      >
        {children}
      </HeroOverlay>

      <div className="absolute bottom-0 left-0 right-0 h-[3px] detail-hero-bar" />
    </div>
  );
}

function HeroOverlay({
  title,
  subtitle,
  badge,
  isLive,
  children,
}: {
  categoryColor?: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  isLive?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 glass-wet detail-hero-overlay"
    >
      <div className="px-4 sm:px-6 pb-4 sm:pb-5 pt-14">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {badge}
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider bg-[var(--state-live-bg)] text-[var(--state-live)] border border-[var(--state-live-border)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--state-live)] animate-pulse-glow" />
              Live
            </span>
          )}
        </div>

        <h1
          className="text-xl sm:text-3xl md:text-[2rem] font-semibold tracking-tight text-[var(--cream)] leading-[1.06] mb-1 max-w-[22ch] line-clamp-3 detail-hero-title-shadow"
        >
          {title}
        </h1>

        {subtitle && (
          <p
            className="text-sm text-[var(--soft)] line-clamp-2 detail-hero-subtitle-shadow"
          >
            {subtitle}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
