"use client";

import { useState, useEffect, useRef } from "react";
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
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "100px", // Start loading 100px before entering viewport
        threshold: 0,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView]);

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        backgroundColor: placeholderColor,
      }}
    >
      {/* Shimmer placeholder */}
      {!isLoaded && (
        <div
          className="absolute inset-0 skeleton-shimmer"
          style={{ backgroundColor: placeholderColor }}
        />
      )}

      {/* Actual image - only render when in view */}
      {isInView && (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          width={!fill ? width : undefined}
          height={!fill ? height : undefined}
          sizes={sizes}
          className={`transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"} ${fill ? "object-cover" : ""}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setIsLoaded(true);
            onError?.();
          }}
          priority={priority}
        />
      )}
    </div>
  );
}
