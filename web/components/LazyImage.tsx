"use client";

import { useState, useMemo } from "react";
import Image from "next/image";

interface LazyImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  sizes?: string;
  className?: string;
  priority?: boolean;
  onError?: () => void;
  placeholderColor?: string;
  /** How to fit the image: 'cover' fills container (crops), 'contain' fits inside (letterbox) */
  objectFit?: "cover" | "contain";
}

// Check if a src string is a usable image URL
function isValidImageSrc(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("/") || src.startsWith("data:")) return true;
  try {
    new URL(src);
    return true;
  } catch {
    return false;
  }
}

// Check if URL is external (not from our domain or configured remotePatterns)
function isExternalUrl(src: string): boolean {
  if (!src) return false;
  // Relative URLs are internal
  if (src.startsWith("/")) return false;
  // Data URLs are internal
  if (src.startsWith("data:")) return false;

  try {
    const url = new URL(src);
    // Supabase storage is configured in next.config.js
    if (url.hostname.endsWith(".supabase.co")) return false;
    // Our own domain
    if (url.hostname === "lostcity.ai" || url.hostname.endsWith(".lostcity.ai")) return false;
    // Everything else is external
    return true;
  } catch {
    return false;
  }
}

/**
 * LazyImage component that wraps Next/Image with a shimmer placeholder.
 * Uses Next/Image's native lazy loading instead of custom IntersectionObserver.
 */
export default function LazyImage({
  src,
  alt,
  fill,
  width,
  height,
  sizes,
  className = "",
  priority = false,
  onError,
  placeholderColor = "var(--twilight)",
  objectFit = "cover",
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Use unoptimized for external URLs to avoid hostname configuration errors
  const unoptimized = useMemo(() => isExternalUrl(src), [src]);
  const validSrc = useMemo(() => isValidImageSrc(src), [src]);

  // If src is not a valid URL, render placeholder only
  if (!validSrc) {
    return (
      <div
        className={`relative overflow-hidden ${className}`}
        style={{ backgroundColor: placeholderColor }}
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        backgroundColor: placeholderColor,
      }}
    >
      {/* Shimmer placeholder - visible until image loads */}
      {!isLoaded && (
        <div
          className="absolute inset-0 skeleton-shimmer"
          style={{ backgroundColor: placeholderColor }}
        />
      )}

      {/* Image with native lazy loading */}
      <Image
        src={src}
        alt={alt}
        fill={fill}
        width={!fill ? width : undefined}
        height={!fill ? height : undefined}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        className={`transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"} ${fill ? (objectFit === "cover" ? "object-cover object-center" : "object-contain object-center") : ""}`}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setIsLoaded(true);
          onError?.();
        }}
        priority={priority}
        unoptimized={unoptimized}
      />
    </div>
  );
}
