"use client";

import { useState, useCallback, type ReactNode } from "react";
import Image from "next/image";
import CategoryPlaceholder from "../CategoryPlaceholder";

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
  children?: ReactNode;
}

export function DetailHero({
  mode,
  imageUrl,
  title,
  subtitle,
  category,
  categoryColor = "var(--coral)",
  categoryIcon,
  badge,
  isLive,
  children,
}: DetailHeroProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleImageLoad = useCallback(() => {
    setImgLoaded(true);
  }, []);

  // Determine effective mode (fallback if image error)
  const effectiveMode = !imageUrl || imgError ? "fallback" : mode;

  if (effectiveMode === "fallback") {
    return (
      <div className="relative w-full aspect-video sm:rounded-lg overflow-hidden">
        {/* Neon category placeholder */}
        <CategoryPlaceholder category={category} color={categoryColor} size="lg" />

        <HeroOverlay
          categoryColor={categoryColor}
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
      <div className="relative w-full sm:rounded-lg overflow-hidden bg-[var(--night)]">
        <div className="flex flex-col sm:flex-row gap-6 p-6">
          {/* Image (poster) */}
          <div className="relative w-full sm:w-[200px] aspect-square sm:aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden">
            {!imgLoaded && (
              <div
                className="absolute inset-0 skeleton-shimmer"
                style={{
                  background: `linear-gradient(135deg, ${categoryColor}10 0%, var(--dusk) 50%, ${categoryColor}05 100%)`,
                }}
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
                className={`object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                onError={() => setImgError(true)}
                onLoad={handleImageLoad}
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {badge && <div className="mb-3">{badge}</div>}

            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-[var(--cream)] leading-tight mb-2"
              style={{
                textShadow: `0 0 30px ${categoryColor}30`,
              }}
            >
              {title}
            </h1>

            {subtitle && (
              <p className="text-base text-[var(--soft)] font-serif mb-4">{subtitle}</p>
            )}

            {children}
          </div>
        </div>

        <div
          className="absolute bottom-0 left-0 right-0 h-[3px]"
          style={{
            background: `linear-gradient(to right, ${categoryColor}, ${categoryColor}80, transparent)`,
            boxShadow: `0 0 20px ${categoryColor}40, 0 0 40px ${categoryColor}20`,
          }}
        />
      </div>
    );
  }

  // Default: image mode (full 16:9 with overlay)
  return (
    <div className="relative w-full aspect-video sm:rounded-lg overflow-hidden">
      {!imgLoaded && (
        <div
          className="absolute inset-0 skeleton-shimmer"
          style={{
            background: `linear-gradient(135deg, ${categoryColor}10 0%, var(--dusk) 50%, ${categoryColor}05 100%)`,
          }}
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
          className={`object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
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

      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(to right, ${categoryColor}, ${categoryColor}80, transparent)`,
          boxShadow: `0 0 20px ${categoryColor}40, 0 0 40px ${categoryColor}20`,
        }}
      />
    </div>
  );
}

function HeroOverlay({
  categoryColor,
  title,
  subtitle,
  badge,
  isLive,
  children,
}: {
  categoryColor: string;
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  isLive?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 glass-wet"
      style={{
        background: `linear-gradient(to top, rgba(9, 9, 11, 0.98) 0%, rgba(9, 9, 11, 0.9) 40%, rgba(9, 9, 11, 0.6) 70%, transparent 100%)`,
      }}
    >
      <div className="px-4 sm:px-6 pb-5 pt-12">
        <div className="flex items-center gap-2 mb-2">
          {badge}
          {isLive && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider bg-[var(--neon-red)]/20 text-[var(--neon-red)] border border-[var(--neon-red)]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-red)] animate-pulse-glow" />
              Live
            </span>
          )}
        </div>

        <h1
          className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--cream)] leading-tight mb-1"
          style={{
            textShadow: `0 2px 4px rgba(0,0,0,0.8), 0 0 30px ${categoryColor}40`,
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            className="text-sm text-[var(--soft)] font-serif"
            style={{
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            }}
          >
            {subtitle}
          </p>
        )}

        {children}
      </div>
    </div>
  );
}
