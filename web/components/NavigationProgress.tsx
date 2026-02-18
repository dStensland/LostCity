"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const lastProgressRef = useRef(0);
  const isFirstRender = useRef(true);

  // Handle route completion when pathname/search changes
  useEffect(() => {
    // Skip the initial render - we don't want to complete on mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Route changed - complete the progress bar
    // Use requestAnimationFrame to defer state updates
    const frameId = requestAnimationFrame(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);

      // Hide bar after animation completes
      timeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 300);
    });

    return () => {
      cancelAnimationFrame(frameId);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pathname, searchParams]);

  // Handle click interception for navigation start
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Ignore modified clicks and prevented/default browser behaviors.
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const link = target?.closest("a");

      if (link) {
        if (
          link.target === "_blank" ||
          link.hasAttribute("download") ||
          link.dataset.noProgress === "true"
        ) {
          return;
        }

        const hrefAttr = link.getAttribute("href");
        if (!hrefAttr || hrefAttr.startsWith("#") || hrefAttr.startsWith("mailto:") || hrefAttr.startsWith("tel:")) {
          return;
        }

        const hrefUrl = new URL(hrefAttr, window.location.href);
        if (hrefUrl.origin !== window.location.origin) return;

        const currentUrl = new URL(window.location.href);

        // Ignore hash-only changes in the current document.
        if (
          hrefUrl.pathname === currentUrl.pathname &&
          hrefUrl.search === currentUrl.search &&
          hrefUrl.hash !== currentUrl.hash
        ) {
          return;
        }

        const nextPath = `${hrefUrl.pathname}${hrefUrl.search}`;
        const currentPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

        if (nextPath === currentPath || nextPath === pathname) return;

        // Start progress
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsNavigating(true);
        setProgress(0);

        // Clear any existing intervals
        if (intervalRef.current) clearInterval(intervalRef.current);

        // Animate progress from 0 to ~90%
        let currentProgress = 0;
        intervalRef.current = setInterval(() => {
          currentProgress += Math.random() * 15 + 5;
          if (currentProgress >= 90) {
            currentProgress = 90;
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
          setProgress(currentProgress);
        }, 150);
      }
    };

    document.addEventListener("click", handleClick);

    return () => {
      document.removeEventListener("click", handleClick);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!barRef.current) return;

    const prev = lastProgressRef.current / 100;
    const next = progress / 100;
    lastProgressRef.current = progress;

    animationRef.current?.cancel();
    animationRef.current = barRef.current.animate(
      [
        { transform: `scaleX(${prev})` },
        { transform: `scaleX(${next})` },
      ],
      { duration: 150, easing: "ease-out", fill: "forwards" }
    );
  }, [progress]);

  if (!isNavigating && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2px] z-[9999] pointer-events-none"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        ref={barRef}
        className={`h-full nav-progress-bar transition-opacity duration-200 ease-out ${
          progress === 100 ? "opacity-0 delay-150" : "opacity-100"
        }`}
      />
    </div>
  );
}
