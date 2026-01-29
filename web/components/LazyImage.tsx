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
        className={`transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"} ${fill ? "object-contain" : ""}`}
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
