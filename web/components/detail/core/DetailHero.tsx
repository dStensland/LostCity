"use client";

import { useState, useCallback } from "react";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategoryColor } from "@/lib/category-config";
import type { HeroConfig } from "@/lib/detail/types";

type DetailHeroProps = HeroConfig;

export function DetailHero({
  imageUrl,
  aspectClass,
  galleryEnabled,
  galleryUrls,
  category,
  isLive,
  overlaySlot,
  mobileMaxHeight,
}: DetailHeroProps) {
  const [imgError, setImgError] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);

  const images = galleryEnabled && galleryUrls?.length
    ? galleryUrls
    : imageUrl && !imgError
      ? [imageUrl]
      : [];

  const currentImage = images[galleryIndex];
  const categoryColor = getCategoryColor(category);

  const handlePrev = useCallback(() => {
    setGalleryIndex((i) => (i > 0 ? i - 1 : images.length - 1));
  }, [images.length]);

  const handleNext = useCallback(() => {
    setGalleryIndex((i) => (i < images.length - 1 ? i + 1 : 0));
  }, [images.length]);

  // Fallback: no image
  if (!currentImage) {
    return (
      <div
        className={`relative ${aspectClass} ${mobileMaxHeight ?? ""} w-full overflow-hidden bg-gradient-to-b from-[var(--dusk)] to-[var(--night)]`}
      >
        <div
          className="absolute inset-0"
          style={{ backgroundColor: `${categoryColor}05` }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <CategoryIcon
            type={category ?? "other"}
            size={64}
            className="opacity-[0.35]"
            glow="none"
          />
          {category && (
            <span
              className="text-2xs font-mono uppercase tracking-wider"
              style={{ color: `${categoryColor}66` }}
            >
              {category}
            </span>
          )}
        </div>
        {overlaySlot}
      </div>
    );
  }

  return (
    <div
      className={`relative ${aspectClass} ${mobileMaxHeight ?? ""} w-full overflow-hidden bg-[var(--night)]`}
    >
      {/* Skeleton */}
      {!imgLoaded && (
        <div className="absolute inset-0 bg-[var(--twilight)] animate-pulse" />
      )}

      {/* Image */}
      <SmartImage
        src={currentImage}
        alt=""
        fill
        className={`object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setImgLoaded(true)}
        onError={() => setImgError(true)}
        sizes="(max-width: 1024px) 100vw, 340px"
        priority
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, transparent 30%, #09090BEE 100%)' }} /* #09090BEE tracks --void at ~93% opacity */ />

      {/* LIVE badge */}
      {isLive && (
        <div className="absolute top-3 left-4 flex items-center gap-1 bg-[var(--coral)] rounded px-2 py-[3px]">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
          <span className="font-mono text-[9px] font-bold tracking-[1px] text-white">LIVE NOW</span>
        </div>
      )}

      {/* Gallery controls */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
            aria-label="Previous image"
          >
            ‹
          </button>
          <button
            onClick={handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
            aria-label="Next image"
          >
            ›
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setGalleryIndex(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === galleryIndex ? "bg-white" : "bg-white/40"}`}
                aria-label={`Image ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}

      {overlaySlot}
    </div>
  );
}
