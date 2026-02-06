"use client";

import { useRef, useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForLength } from "@/lib/css-utils";

interface ParallaxHeroProps {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export default function ParallaxHero({ src, alt, width, height }: ParallaxHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const heroHeight = `${(height / width) * 100}vw`;
  const heroHeightClass = createCssVarClassForLength("--hero-height", heroHeight, "parallax-hero");
  const offsetClass = createCssVarClassForLength("--parallax-offset", `${offset}px`, "parallax-offset");
  const prefersReducedMotion = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const handler = () => callback();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handler);
      } else {
        mediaQuery.addListener(handler);
      }
      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handler);
        } else {
          mediaQuery.removeListener(handler);
        }
      };
    },
    () => {
      if (typeof window === "undefined" || !window.matchMedia) return false;
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
    () => false
  );

  useEffect(() => {
    if (prefersReducedMotion) return;

    const handleScroll = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const scrolled = window.scrollY;
      const containerTop = rect.top + scrolled;
      const containerHeight = rect.height;

      if (scrolled < containerTop + containerHeight) {
        const parallaxOffset = scrolled * 0.25;
        setOffset(parallaxOffset);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden max-h-[65vh] min-h-[300px] parallax-hero ${
        heroHeightClass?.className ?? ""
      }`}
    >
      <ScopedStyles css={heroHeightClass?.css} />
      {/* Parallax image container */}
      <div
        className={`absolute inset-0 w-full h-[130%] top-[-15%] parallax-layer will-change-transform ${
          offsetClass?.className ?? ""
        }`}
      >
        <ScopedStyles css={offsetClass?.css} />
        <Image
          src={src}
          alt={alt}
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
      </div>

      {/* Atmospheric color overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10 mix-blend-overlay opacity-30 bg-[linear-gradient(135deg,_rgba(0,229,255,0.2)_0%,_transparent_50%,_rgba(255,107,157,0.2)_100%)]"
      />

      {/* Bottom fade - deeper, more dramatic */}
      <div
        className="absolute bottom-0 left-0 right-0 h-40 z-10 pointer-events-none bg-[linear-gradient(to_top,_#08080c_0%,_rgba(8,8,12,0.8)_40%,_transparent_100%)]"
      />

      {/* Top subtle fade */}
      <div
        className="absolute top-0 left-0 right-0 h-20 z-10 pointer-events-none bg-[linear-gradient(to_bottom,_rgba(8,8,12,0.4)_0%,_transparent_100%)]"
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-10 home-hero-vignette"
      />
    </div>
  );
}
