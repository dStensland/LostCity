"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface SwipeAction {
  icon: React.ReactNode;
  label: string;
  color: string;
  onAction: () => void;
}

interface UseSwipeGestureOptions {
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  threshold?: number;
  maxSwipe?: number;
  disabled?: boolean;
}

interface UseSwipeGestureReturn {
  swipeOffset: number;
  isSwipingLeft: boolean;
  isSwipingRight: boolean;
  isSwiping: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  contentStyle: React.CSSProperties;
  leftActionRevealed: boolean;
  rightActionRevealed: boolean;
  reset: () => void;
}

export function useSwipeGesture({
  leftAction,
  rightAction,
  threshold = 80,
  maxSwipe = 100,
  disabled = false,
}: UseSwipeGestureOptions): UseSwipeGestureReturn {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const reset = useCallback(() => {
    setSwipeOffset(0);
    setIsSwiping(false);
    isHorizontalSwipeRef.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled) return;

      startXRef.current = e.touches[0].clientX;
      startYRef.current = e.touches[0].clientY;
      currentXRef.current = e.touches[0].clientX;
      isHorizontalSwipeRef.current = null;
      setIsSwiping(true);
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isSwiping || disabled) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - startXRef.current;
      const diffY = currentY - startYRef.current;

      // Determine swipe direction on first significant movement
      if (isHorizontalSwipeRef.current === null) {
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
          isHorizontalSwipeRef.current = Math.abs(diffX) > Math.abs(diffY);
        }
      }

      // Only track horizontal swipes
      if (isHorizontalSwipeRef.current === true) {
        currentXRef.current = currentX;

        // Apply resistance and limits
        let offset = diffX;

        // Check if action exists for this direction
        if (offset > 0 && !rightAction) {
          offset = offset * 0.2; // Heavy resistance when no action
        } else if (offset < 0 && !leftAction) {
          offset = offset * 0.2; // Heavy resistance when no action
        }

        // Apply resistance curve for natural feel
        const resistance = 0.6;
        const clampedOffset = Math.max(-maxSwipe, Math.min(maxSwipe, offset * resistance));
        setSwipeOffset(clampedOffset);

        // Prevent vertical scroll during horizontal swipe
        e.preventDefault();
      }
    },
    [isSwiping, disabled, leftAction, rightAction, maxSwipe]
  );

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping) return;

    setIsSwiping(false);

    // Check if threshold was met
    if (swipeOffset <= -threshold && leftAction) {
      // Swipe left - trigger action
      leftAction.onAction();
      // Animate to action position briefly, then reset
      setSwipeOffset(-maxSwipe);
      setTimeout(reset, 200);
    } else if (swipeOffset >= threshold && rightAction) {
      // Swipe right - trigger action
      rightAction.onAction();
      // Animate to action position briefly, then reset
      setSwipeOffset(maxSwipe);
      setTimeout(reset, 200);
    } else {
      // Snap back
      reset();
    }

    isHorizontalSwipeRef.current = null;
  }, [isSwiping, swipeOffset, threshold, leftAction, rightAction, maxSwipe, reset]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || disabled) return;

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
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, disabled]);

  const contentStyle: React.CSSProperties = {
    transform: `translateX(${swipeOffset}px)`,
    transition: isSwiping ? "none" : "transform 0.3s ease-out",
  };

  return {
    swipeOffset,
    isSwipingLeft: swipeOffset < -10,
    isSwipingRight: swipeOffset > 10,
    isSwiping,
    containerRef,
    contentStyle,
    leftActionRevealed: swipeOffset <= -threshold,
    rightActionRevealed: swipeOffset >= threshold,
    reset,
  };
}
