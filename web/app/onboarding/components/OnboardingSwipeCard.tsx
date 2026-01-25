"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import type { OnboardingSwipeEvent } from "@/lib/types";

interface OnboardingSwipeCardProps {
  event: OnboardingSwipeEvent;
  onLike: () => void;
  onSkip: () => void;
  onTap: () => void;
  isTop: boolean;
  index: number;
}

export function OnboardingSwipeCard({
  event,
  onLike,
  onSkip,
  onTap,
  isTop,
  index,
}: OnboardingSwipeCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);

  const SWIPE_THRESHOLD = 100;
  const MAX_ROTATION = 15;

  const handleSwipeComplete = useCallback(
    (direction: "left" | "right") => {
      setIsExiting(true);
      setExitDirection(direction);

      setTimeout(() => {
        if (direction === "right") {
          onLike();
        } else {
          onSkip();
        }
      }, 300);
    },
    [onLike, onSkip]
  );

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isTop) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    setIsSwiping(true);
  }, [isTop]);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isSwiping || !isTop) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startXRef.current;
      const diffY = currentY - startYRef.current;

      // Determine direction on first significant movement
      if (isHorizontalRef.current === null) {
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
          isHorizontalRef.current = Math.abs(diffX) > Math.abs(diffY);
        }
      }

      if (isHorizontalRef.current) {
        e.preventDefault();
        setSwipeOffset(diffX);
      }
    },
    [isSwiping, isTop]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;
    setIsSwiping(false);

    if (Math.abs(swipeOffset) >= SWIPE_THRESHOLD) {
      handleSwipeComplete(swipeOffset > 0 ? "right" : "left");
    } else {
      // Check if it was a tap (minimal movement)
      if (Math.abs(swipeOffset) < 10) {
        onTap();
      }
      setSwipeOffset(0);
    }

    isHorizontalRef.current = null;
  }, [isSwiping, swipeOffset, handleSwipeComplete, onTap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isTop) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, isTop]);

  // Calculate transforms
  const rotation = (swipeOffset / SWIPE_THRESHOLD) * MAX_ROTATION;
  const likeOpacity = Math.min(Math.max(swipeOffset / SWIPE_THRESHOLD, 0), 1);
  const skipOpacity = Math.min(Math.max(-swipeOffset / SWIPE_THRESHOLD, 0), 1);

  // Exit animation
  const exitX = exitDirection === "right" ? 400 : -400;

  // Stack effect for cards below
  const stackScale = 1 - index * 0.05;
  const stackY = index * 8;

  const cardStyle: React.CSSProperties = isExiting
    ? {
        transform: `translateX(${exitX}px) rotate(${exitDirection === "right" ? 30 : -30}deg)`,
        opacity: 0,
        transition: "transform 0.3s ease-out, opacity 0.3s ease-out",
      }
    : {
        transform: `translateX(${swipeOffset}px) rotate(${rotation}deg) scale(${stackScale}) translateY(${stackY}px)`,
        transition: isSwiping ? "none" : "transform 0.3s ease-out",
        zIndex: 10 - index,
      };

  // Format date
  const eventDate = new Date(event.start_date);
  const dateStr = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={cardStyle}
    >
      <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[var(--dusk)] shadow-xl">
        {/* Background image */}
        {event.image_url && (
          <Image
            src={event.image_url}
            alt={event.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 400px"
            priority={isTop}
          />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {/* Like indicator */}
        <div
          className="absolute top-6 right-6 px-4 py-2 rounded-lg border-4 border-green-500 text-green-500 font-bold text-xl transform rotate-12"
          style={{ opacity: likeOpacity }}
        >
          LIKE
        </div>

        {/* Skip indicator */}
        <div
          className="absolute top-6 left-6 px-4 py-2 rounded-lg border-4 border-[var(--muted)] text-[var(--muted)] font-bold text-xl transform -rotate-12"
          style={{ opacity: skipOpacity }}
        >
          SKIP
        </div>

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          {/* Category badge */}
          {event.category && (
            <span className="inline-block px-3 py-1 bg-[var(--coral)]/90 text-[var(--void)] text-xs font-mono rounded-full mb-3">
              {event.category.replace("_", " ")}
            </span>
          )}

          {/* Title */}
          <h3 className="text-2xl font-semibold text-white mb-2 line-clamp-2">
            {event.title}
          </h3>

          {/* Details */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
            <span>{dateStr}</span>
            {event.start_time && (
              <>
                <span className="text-white/40">|</span>
                <span>{event.start_time.slice(0, 5)}</span>
              </>
            )}
            {event.venue && (
              <>
                <span className="text-white/40">|</span>
                <span className="truncate">{event.venue.name}</span>
              </>
            )}
          </div>

          {/* Price */}
          <div className="mt-2 text-sm">
            {event.is_free ? (
              <span className="text-green-400">Free</span>
            ) : event.price_min ? (
              <span className="text-white/70">${event.price_min}+</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
