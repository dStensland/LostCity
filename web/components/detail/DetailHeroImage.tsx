"use client";

import { useState, type ReactNode } from "react";
import Image from "@/components/SmartImage";
import Skeleton from "@/components/Skeleton";
import CategoryIcon from "@/components/CategoryIcon";

interface DetailHeroImageProps {
  imageUrl: string | null;
  alt: string;
  /** Category for fallback icon */
  category?: string | null;
  /** Show live ring indicator */
  isLive?: boolean;
  /** Next.js Image priority loading */
  priority?: boolean;
  /** Overlay content (LIVE badge, source attribution) */
  overlay?: ReactNode;
  /** Aspect ratio class. Default: "aspect-video lg:aspect-[16/10]" */
  aspectClass?: string;
  /** Conditional ring class for live events */
  ringClass?: string;
}

export default function DetailHeroImage({
  imageUrl,
  alt,
  category,
  isLive = false,
  priority = false,
  overlay,
  aspectClass = "aspect-video lg:aspect-[16/10]",
  ringClass,
}: DetailHeroImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLowRes, setIsLowRes] = useState(false);

  const showImage = imageUrl && !imageError;
  const liveRing = ringClass || (isLive ? "ring-2 ring-[var(--coral)] ring-opacity-50" : "");

  if (showImage) {
    return (
      <div className={`${aspectClass} bg-[var(--night)] overflow-hidden relative ${liveRing}`}>
        {!imageLoaded && (
          <Skeleton className="absolute inset-0" />
        )}
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 340px"
          className={`${isLowRes ? "object-contain" : "object-cover"} brightness-[0.85] contrast-[1.05] transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
          onLoad={(e) => {
            setImageLoaded(true);
            if (e.currentTarget.naturalWidth < 600) setIsLowRes(true);
          }}
          onError={() => setImageError(true)}
          priority={priority}
        />
        {overlay}
      </div>
    );
  }

  return (
    <div className={`${aspectClass} bg-gradient-to-b from-[var(--dusk)] to-[var(--night)] flex items-center justify-center relative ${liveRing}`}>
      <CategoryIcon type={category || ""} size={40} className="opacity-20" />
      {overlay}
    </div>
  );
}
