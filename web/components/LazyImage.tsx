"use client";

import { useState } from "react";
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
      />
    </div>
  );
}
