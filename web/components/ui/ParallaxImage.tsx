"use client";

import { useRef, useEffect, useState, ReactNode } from "react";
import Image from "@/components/SmartImage";
import ScopedStyles from "@/components/ScopedStyles";
import { createCssVarClassForLength } from "@/lib/css-utils";
interface ParallaxImageProps {
  src: string;
  alt: string;
  className?: string;
  parallaxSpeed?: number; // 0.1 = subtle, 0.5 = dramatic
  children?: ReactNode;
}

export default function ParallaxImage({
  src,
  alt,
  className = "",
  parallaxSpeed = 0.15,
  children,
}: ParallaxImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial sync with browser API
    setIsReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (isReducedMotion) return;

    let ticking = false;

    const updateParallax = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // Only animate when element is in viewport
      if (rect.bottom < 0 || rect.top > windowHeight) return;

      // Calculate parallax offset based on scroll position
      const scrollProgress = (windowHeight - rect.top) / (windowHeight + rect.height);
      const parallaxOffset = (scrollProgress - 0.5) * 100 * parallaxSpeed;

      setOffset(parallaxOffset);
    };

    const handleScroll = () => {
      // Throttle with requestAnimationFrame to prevent jank
      if (!ticking) {
        requestAnimationFrame(() => {
          updateParallax();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    updateParallax(); // Initial calculation

    return () => window.removeEventListener("scroll", handleScroll);
  }, [parallaxSpeed, isReducedMotion]);

  const offsetClass = createCssVarClassForLength(
    "--parallax-offset",
    `${offset}px`,
    "parallax-offset"
  );

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      <ScopedStyles css={offsetClass?.css} />
      <div
        className={`absolute inset-0 transition-transform duration-100 ease-out ${
          isReducedMotion
            ? "parallax-layer-reduced"
            : `parallax-layer ${offsetClass?.className ?? ""}`
        }`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
        />
      </div>
      {children && (
        <div className="relative z-10">{children}</div>
      )}
    </div>
  );
}
