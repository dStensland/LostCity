"use client";

import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategoryColor } from "@/lib/category-config";
import { useGallery } from "@/lib/detail/use-gallery";
import type { HeroConfig } from "@/lib/detail/types";

type DetailHeroProps = HeroConfig;

// ─── Legacy Hero (exact original code) ──────────────────────────────────────
// Preserved verbatim for backward compat. Used when `tier` is not set.

function LegacyHero({
  imageUrl,
  aspectClass,
  galleryEnabled,
  galleryUrls,
  category,
  isLive,
  overlaySlot,
  mobileMaxHeight,
}: DetailHeroProps) {
  const {
    images, currentImage, galleryIndex, imgLoaded,
    setImgLoaded, setImgError, handlePrev, handleNext, setGalleryIndex,
  } = useGallery({ imageUrl, galleryEnabled, galleryUrls });
  const categoryColor = getCategoryColor(category);

  // Fallback: no image
  if (!currentImage) {
    return (
      <div
        className={`relative ${aspectClass ?? ""} ${mobileMaxHeight ?? ""} w-full overflow-hidden bg-gradient-to-b from-[var(--dusk)] to-[var(--night)] motion-fade-in`}
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
      className={`relative ${aspectClass ?? ""} ${mobileMaxHeight ?? ""} w-full overflow-hidden bg-[var(--night)] motion-fade-in`}
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

// ─── Expanded Tier (~55vh) ───────────────────────────────────────────────────

function ExpandedHero({
  imageUrl,
  galleryEnabled,
  galleryUrls,
  category,
  isLive,
  overlaySlot,
}: DetailHeroProps) {
  const {
    images, currentImage, galleryIndex, imgLoaded,
    setImgLoaded, setImgError, handlePrev, handleNext, setGalleryIndex,
  } = useGallery({ imageUrl, galleryEnabled, galleryUrls });
  const categoryColor = getCategoryColor(category);

  return (
    <div className="relative w-full h-[55vh] min-h-[400px] max-h-[700px] overflow-hidden bg-[var(--night)] motion-fade-in">
      {/* Skeleton */}
      {!imgLoaded && currentImage && (
        <div className="absolute inset-0 bg-[var(--twilight)] animate-pulse" />
      )}

      {/* Image or fallback */}
      {currentImage ? (
        <SmartImage
          src={currentImage}
          alt=""
          fill
          className={`object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          sizes="100vw"
          priority
        />
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-b from-[var(--dusk)] to-[var(--night)]"
          style={{ backgroundColor: `${categoryColor}05` }}
        >
          <CategoryIcon
            type={category ?? "other"}
            size={64}
            className="opacity-[0.35]"
            glow="none"
          />
        </div>
      )}

      {/* Bottom gradient fade — transparent → --void over last 30% */}
      <div
        className="absolute inset-x-0 bottom-0 h-[30%] pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--void))' }}
      />

      {/* LIVE badge */}
      {isLive && (
        <div className="absolute top-14 left-4 flex items-center gap-1 bg-[var(--coral)] rounded px-2 py-[3px]">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
          <span className="font-mono text-[9px] font-bold tracking-[1px] text-white">LIVE NOW</span>
        </div>
      )}

      {/* Gallery navigation */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
            aria-label="Previous image"
          >
            <ArrowLeft size={16} weight="bold" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:bg-black/60 transition-colors"
            aria-label="Next image"
          >
            <ArrowRight size={16} weight="bold" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1 flex gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setGalleryIndex(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === galleryIndex ? "bg-white" : "bg-white/40"}`}
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

// ─── Compact Tier (~200px) ───────────────────────────────────────────────────

function CompactHero({
  accentColor,
  isLive,
  overlaySlot,
}: DetailHeroProps) {
  const bandColor = accentColor ?? "var(--dusk)";

  return (
    <div
      className="relative w-full h-[200px] overflow-hidden motion-fade-in"
      style={{ background: `linear-gradient(135deg, ${bandColor}40 0%, var(--dusk) 60%, var(--void) 100%)` }}
    >
      {/* Bottom gradient fade to --void */}
      <div
        className="absolute inset-x-0 bottom-0 h-[40%] pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--void))' }}
      />

      {/* LIVE badge */}
      {isLive && (
        <div className="absolute top-14 left-4 flex items-center gap-1 bg-[var(--coral)] rounded px-2 py-[3px]">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
          <span className="font-mono text-[9px] font-bold tracking-[1px] text-white">LIVE NOW</span>
        </div>
      )}

      {overlaySlot}
    </div>
  );
}

// ─── Typographic Tier (~220px) ───────────────────────────────────────────────

function TypographicHero({
  category,
  accentColor,
  title,
  metadataLine,
  tags,
  overlaySlot,
}: DetailHeroProps) {
  const categoryColor = accentColor ?? getCategoryColor(category);

  return (
    <div
      className="relative w-full min-h-[220px] overflow-hidden motion-fade-in"
      style={{
        background: `linear-gradient(135deg, ${categoryColor}22 0%, var(--dusk) 50%, var(--void) 100%)`,
      }}
    >
      {/* Bottom gradient fade to --void */}
      <div
        className="absolute inset-x-0 bottom-0 h-[40%] pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--void))' }}
      />

      {overlaySlot}

      {/* Content — staggered fade-up */}
      <div className="relative z-10 flex flex-col items-start gap-3 px-5 pb-6 pt-16">
        {/* Category icon with glow */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center motion-fade-up"
          style={{
            backgroundColor: `${categoryColor}20`,
            boxShadow: `0 0 16px ${categoryColor}40`,
            animationDelay: '0.05s',
          }}
        >
          <CategoryIcon
            type={category ?? "other"}
            size={22}
            glow="subtle"
          />
        </div>

        {/* Title */}
        {title && (
          <h1
            className="text-3xl font-bold text-[var(--cream)] leading-tight motion-fade-up"
            style={{ animationDelay: '0.1s' }}
          >
            {title}
          </h1>
        )}

        {/* Metadata line */}
        {metadataLine && (
          <p
            className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)] motion-fade-up"
            style={{ animationDelay: '0.15s' }}
          >
            {metadataLine}
          </p>
        )}

        {/* Tag pills */}
        {tags && tags.length > 0 && (
          <div
            className="flex flex-wrap gap-1.5 motion-fade-up"
            style={{ animationDelay: '0.2s' }}
          >
            {tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full text-xs font-mono border"
                style={{
                  backgroundColor: `${categoryColor}15`,
                  borderColor: `${categoryColor}30`,
                  color: `${categoryColor}CC`,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Public export — branches on `tier` ─────────────────────────────────────

export function DetailHero(props: DetailHeroProps) {
  const { tier } = props;

  if (!tier) {
    return <LegacyHero {...props} />;
  }

  switch (tier) {
    case "expanded":
      return <ExpandedHero {...props} />;
    case "compact":
      return <CompactHero {...props} />;
    case "typographic":
      return <TypographicHero {...props} />;
  }
}
