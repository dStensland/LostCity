"use client";

import Image from "next/image";
import { HERO_HEIGHT_VALUES, type HeroHeight } from "@/lib/visual-presets";

interface HeroSectionProps {
  /** Hero background image URL */
  imageUrl: string;
  /** Optional title to display */
  title?: string;
  /** Optional tagline/subtitle */
  tagline?: string;
  /** Hero height: sm (30vh), md (50vh), lg (70vh), full (100vh) */
  height?: HeroHeight;
  /** Overlay opacity (0-1) for text readability */
  overlayOpacity?: number;
  /** Optional logo URL (for centered logo display) */
  logoUrl?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Hero Section Component
 * Full-width hero image with optional title, tagline, and centered logo.
 * Used by immersive and branded header templates.
 */
export default function HeroSection({
  imageUrl,
  title,
  tagline,
  height = "lg",
  overlayOpacity = 0.5,
  logoUrl,
  className = "",
}: HeroSectionProps) {
  const heightValue = HERO_HEIGHT_VALUES[height];

  return (
    <section
      className={`relative w-full overflow-hidden ${className}`}
      style={{ height: heightValue }}
    >
      {/* Background Image */}
      <Image
        src={imageUrl}
        alt={title || "Hero background"}
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, rgba(0, 0, 0, ${overlayOpacity * 0.3}) 0%, rgba(0, 0, 0, ${overlayOpacity}) 50%, rgba(9, 9, 11, 1) 100%)`,
        }}
      />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
        {/* Centered Logo */}
        {logoUrl && (
          <div className="mb-6">
            <Image
              src={logoUrl}
              alt={title || "Logo"}
              width={200}
              height={80}
              className="h-16 md:h-20 w-auto object-contain drop-shadow-lg"
            />
          </div>
        )}

        {/* Title */}
        {title && !logoUrl && (
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white drop-shadow-lg mb-4">
            {title}
          </h1>
        )}

        {/* Tagline */}
        {tagline && (
          <p className="text-lg md:text-xl text-white/90 max-w-2xl drop-shadow-md">
            {tagline}
          </p>
        )}

        {/* Scroll indicator */}
        {height === "full" && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
            <svg
              className="w-6 h-6 text-white/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        )}
      </div>
    </section>
  );
}
