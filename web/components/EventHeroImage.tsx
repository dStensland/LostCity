"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";
import LiveIndicator from "./LiveIndicator";

interface EventHeroImageProps {
  src: string;
  alt: string;
  category?: string | null;
  // Overlay content props
  title?: string;
  venueName?: string | null;
  neighborhood?: string | null;
  isLive?: boolean;
  eventId?: number;
}

export default function EventHeroImage({
  src,
  alt,
  category,
  title,
  venueName,
  neighborhood,
  isLive,
  eventId,
}: EventHeroImageProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const categoryColor = category ? getCategoryColor(category) : "var(--coral)";

  const handleImageLoad = useCallback(() => {
    setImgLoaded(true);
  }, []);

  // Determine if we should show the overlay (title or venue present)
  const showOverlay = title || venueName;

  if (imgError) {
    // Fallback: Category icon on gradient background with glass overlay
    return (
      <div className="relative w-full h-full">
        <div
          className="w-full h-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${categoryColor}15 0%, ${categoryColor}05 100%)`,
          }}
        >
          <div className="flex flex-col items-center gap-3 opacity-60">
            {category ? (
              <CategoryIcon type={category} size={64} glow="subtle" />
            ) : (
              <svg className="w-16 h-16 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
        </div>

        {/* Glass overlay for fallback */}
        {showOverlay && (
          <HeroOverlay
            category={category}
            categoryColor={categoryColor}
            title={title}
            venueName={venueName}
            neighborhood={neighborhood}
            isLive={isLive}
            eventId={eventId}
          />
        )}

        {/* Category glow line */}
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

  return (
    <div className="relative w-full h-full">
      {/* Skeleton placeholder while image loads */}
      {!imgLoaded && (
        <div
          className="absolute inset-0 skeleton-shimmer"
          style={{
            background: `linear-gradient(135deg, ${categoryColor}10 0%, var(--dusk) 50%, ${categoryColor}05 100%)`,
          }}
        >
          {/* Category icon hint in skeleton */}
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            {category && <CategoryIcon type={category} size={48} />}
          </div>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
        onError={() => setImgError(true)}
        onLoad={handleImageLoad}
      />

      {/* Glass wet overlay at bottom */}
      {showOverlay && (
        <HeroOverlay
          category={category}
          categoryColor={categoryColor}
          title={title}
          venueName={venueName}
          neighborhood={neighborhood}
          isLive={isLive}
          eventId={eventId}
        />
      )}

      {/* Category glow line at bottom */}
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

// Separate overlay component for reuse
function HeroOverlay({
  category,
  categoryColor,
  title,
  venueName,
  neighborhood,
  isLive,
  eventId,
}: {
  category?: string | null;
  categoryColor: string;
  title?: string;
  venueName?: string | null;
  neighborhood?: string | null;
  isLive?: boolean;
  eventId?: number;
}) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 glass-wet"
      style={{
        background: `linear-gradient(to top, rgba(9, 9, 11, 0.98) 0%, rgba(9, 9, 11, 0.9) 40%, rgba(9, 9, 11, 0.6) 70%, transparent 100%)`,
      }}
    >
      <div className="px-4 sm:px-6 pb-5 pt-12">
        {/* Top row: Category + Live indicator */}
        <div className="flex items-center gap-2 mb-2">
          {category && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono uppercase tracking-wider backdrop-blur-sm"
              style={{
                backgroundColor: `${categoryColor}30`,
                color: categoryColor,
                border: `1px solid ${categoryColor}50`,
              }}
            >
              <CategoryIcon type={category} size={14} glow="subtle" />
              {category}
            </span>
          )}
          {isLive && eventId && (
            <LiveIndicator eventId={eventId} initialIsLive={true} size="md" />
          )}
        </div>

        {/* Title with strong text shadow for legibility */}
        {title && (
          <h1
            className="text-xl sm:text-2xl md:text-3xl font-bold text-[var(--cream)] leading-tight mb-1"
            style={{
              textShadow: `0 2px 4px rgba(0,0,0,0.8), 0 0 30px ${categoryColor}40`,
            }}
          >
            {title}
          </h1>
        )}

        {/* Venue only - date/time shown in EventQuickActions below */}
        {(venueName || neighborhood) && (
          <p
            className="text-sm text-[var(--soft)] font-serif"
            style={{
              textShadow: "0 1px 3px rgba(0,0,0,0.8)",
            }}
          >
            {venueName}
            {neighborhood && (
              <span className="text-[var(--muted)]"> · {neighborhood}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
