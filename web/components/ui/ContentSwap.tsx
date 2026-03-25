"use client";

import {
  useRef,
  useState,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from "react";
import { useMinSkeletonDelay } from "@/lib/hooks/useMinSkeletonDelay";

interface ContentSwapProps {
  children: ReactNode;
  /** Triggers crossfade when this value changes */
  swapKey: string | number;
  /** Triggers immediate error state crossfade */
  error?: Error | null;
  /** Minimum display time before swap (ms). Default 250 */
  minDisplayMs?: number;
  /** Crossfade duration (ms). Default 200 */
  duration?: number;
  /** Static min-height for CLS prevention (no runtime measurement) */
  minHeight?: number | string;
  className?: string;
}

export function ContentSwap({
  children,
  swapKey,
  error,
  minDisplayMs = 250,
  duration = 200,
  minHeight,
  className = "",
}: ContentSwapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latestChildrenRef = useRef(children);
  const latestKeyRef = useRef(swapKey);
  const [displayedKey, setDisplayedKey] = useState(swapKey);
  const [displayedChildren, setDisplayedChildren] = useState(children);
  const isFirstRender = useRef(true);

  // Always track latest children and key to avoid stale closures in animation callbacks
  latestChildrenRef.current = children;
  latestKeyRef.current = swapKey;

  const isSwapping = displayedKey !== swapKey;
  const delayReady = useMinSkeletonDelay(isSwapping, minDisplayMs);

  // Crossfade helper — fade out then swap then fade in
  function crossfade(el: HTMLDivElement) {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) {
      setDisplayedKey(latestKeyRef.current);
      setDisplayedChildren(latestChildrenRef.current);
      return;
    }

    const halfDuration = duration / 2;
    // Fade out — no fill:forwards to avoid stuck opacity
    const fadeOut = el.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: halfDuration,
      easing: "ease-out",
    });
    fadeOut.onfinish = () => {
      // Swap content using refs for latest values (avoids stale closure)
      setDisplayedKey(latestKeyRef.current);
      setDisplayedChildren(latestChildrenRef.current);
      // Fade in — rAF ensures React has committed the new content before animating
      requestAnimationFrame(() => {
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: halfDuration,
          easing: "ease-out",
        });
      });
    };
    return fadeOut;
  }

  // Handle error: immediate crossfade
  useEffect(() => {
    if (!error || !containerRef.current) return;
    const anim = crossfade(containerRef.current);
    return () => anim?.cancel();
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle normal swap: wait for min delay, then crossfade
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isSwapping && !delayReady) return;
    if (displayedKey === swapKey && !isSwapping) return;
    if (!containerRef.current) {
      setDisplayedKey(swapKey);
      setDisplayedChildren(children);
      return;
    }
    const anim = crossfade(containerRef.current);
    return () => anim?.cancel();
  }, [swapKey, delayReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const containerStyle: CSSProperties = {};
  if (minHeight) {
    containerStyle.minHeight =
      typeof minHeight === "number" ? `${minHeight}px` : minHeight;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={
        Object.keys(containerStyle).length > 0 ? containerStyle : undefined
      }
    >
      {displayedChildren}
    </div>
  );
}
