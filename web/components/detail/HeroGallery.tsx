"use client";

import { useState, useCallback, useRef } from "react";
import SmartImage from "@/components/SmartImage";

interface HeroGalleryProps {
  images: string[];
  fallbackImage?: string | null;
  placeName: string;
  placeType: string;
}

export function HeroGallery({ images, fallbackImage, placeName, placeType: _placeType }: HeroGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(index);
  }, []);

  // Determine which images to show
  const displayImages = images.length > 0
    ? images
    : fallbackImage
      ? [fallbackImage]
      : [];

  if (displayImages.length === 0) {
    return (
      <div className="h-[220px] bg-gradient-to-b from-[var(--dusk)] to-[var(--night)] flex items-center justify-center" />
    );
  }

  // Single image — no scroll/dots needed
  if (displayImages.length === 1) {
    return (
      <div className="relative h-[220px] w-full overflow-hidden">
        <SmartImage
          src={displayImages[0]}
          alt={`${placeName} photo`}
          fill
          className="object-cover brightness-[0.85] contrast-[1.05]"
          sizes="100vw"
          priority
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 30%, var(--void) 100%)" }}
        />
      </div>
    );
  }

  return (
    <div className="relative h-[220px] w-full overflow-hidden">
      {/* Scrollable gallery strip */}
      <div
        ref={scrollRef}
        className="flex h-full snap-x snap-mandatory overflow-x-auto scrollbar-hide"
        onScroll={handleScroll}
      >
        {displayImages.map((url, i) => (
          <div key={i} className="h-full w-full flex-shrink-0 snap-center relative">
            <SmartImage
              src={url}
              alt={`${placeName} photo ${i + 1}`}
              fill
              className="object-cover brightness-[0.85] contrast-[1.05]"
              sizes="100vw"
              priority={i === 0}
              loading={i > 1 ? "lazy" : "eager"}
            />
          </div>
        ))}
      </div>

      {/* Gradient overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to bottom, transparent 30%, var(--void) 100%)" }}
      />

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {displayImages.map((_, i) => (
          <div
            key={i}
            className={`rounded-full transition-all duration-200 ${
              i === activeIndex
                ? "h-1.5 w-1.5 bg-white"
                : "h-1 w-1 bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export type { HeroGalleryProps };
