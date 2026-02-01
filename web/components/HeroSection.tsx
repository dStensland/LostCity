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
      style={{
        height: heightValue,
        contain: "layout style paint",
      }}
    >
      {/* Background Image - optimized for performance */}
      <div className="absolute inset-0">
        <Image
          src={imageUrl}
          alt={title || "Hero background"}
          fill
          priority
          quality={90}
          className="object-cover transition-transform duration-700 hover:scale-105"
          sizes="100vw"
          style={{ willChange: "transform" }}
        />
      </div>

      {/* Gradient Overlay - smoother gradient for better visual depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, rgba(0, 0, 0, ${overlayOpacity * 0.2}) 0%, rgba(0, 0, 0, ${overlayOpacity * 0.6}) 40%, rgba(0, 0, 0, ${overlayOpacity * 0.8}) 70%, rgba(9, 9, 11, 1) 100%)`,
        }}
      />

      {/* Content - with improved typography and animations */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 animate-content-reveal">
        {/* Centered Logo */}
        {logoUrl && (
          <div className="mb-6 animate-fade-in stagger-1">
            <Image
              src={logoUrl}
              alt={title || "Logo"}
              width={200}
              height={80}
              className="h-16 md:h-20 lg:h-24 w-auto object-contain drop-shadow-2xl"
              priority
            />
          </div>
        )}

        {/* Title */}
        {title && !logoUrl && (
          <h1 className="text-4xl md:text-5xl lg:text-7xl font-display font-bold text-white drop-shadow-2xl mb-4 animate-fade-in stagger-2 tracking-tight">
            {title}
          </h1>
        )}

        {/* Tagline */}
        {tagline && (
          <p className="text-lg md:text-xl lg:text-2xl text-white/90 max-w-2xl drop-shadow-lg font-medium animate-fade-in stagger-3">
            {tagline}
          </p>
        )}

        {/* Scroll indicator - subtle and elegant */}
        {height === "full" && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-6 h-6 text-white"
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
              <span className="text-xs font-mono text-white/80 uppercase tracking-wider">Scroll</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
