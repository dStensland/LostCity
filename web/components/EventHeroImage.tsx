"use client";

import { useState } from "react";
import Image from "next/image";
import CategoryIcon, { getCategoryColor } from "./CategoryIcon";

interface EventHeroImageProps {
  src: string;
  alt: string;
  category?: string | null;
}

export default function EventHeroImage({ src, alt, category }: EventHeroImageProps) {
  const [imgError, setImgError] = useState(false);
  const categoryColor = category ? getCategoryColor(category) : "var(--coral)";

  if (imgError) {
    // Fallback: Category icon on gradient background
    return (
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
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      className="object-cover"
      onError={() => setImgError(true)}
    />
  );
}
