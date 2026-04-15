"use client";

import { useRef, useEffect, useState, type ReactNode } from "react";

interface TransitionContainerProps {
  /** Whether a transition is pending (from useTransition) */
  isPending: boolean;
  children: ReactNode;
  /** Scroll content area to top on transition start (for tab switches) */
  scrollToTopOnPending?: boolean;
  className?: string;
}

export function TransitionContainer({
  isPending,
  children,
  scrollToTopOnPending = false,
  className = "",
}: TransitionContainerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-once matchMedia detection. Cascade bounded — reducedMotion is not in the dep array ([]). A useState initializer is unsafe because window.matchMedia is undefined during SSR.
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    if (!isPending) return;
    // Scroll to top of content area on transition start (Pattern B tab switches only)
    if (scrollToTopOnPending && ref.current) {
      ref.current.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
    }
    // Move focus to container so keyboard users don't interact with stale content
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.focus({ preventScroll: true });
    }
  }, [isPending, scrollToTopOnPending]);

  // When reduced motion is preferred, only apply pointer-events change
  const pendingStyle: React.CSSProperties = isPending
    ? reducedMotion
      ? { pointerEvents: "none" }
      : {
          opacity: 0.55,
          filter: "blur(1px)",
          pointerEvents: "none",
          transition: "opacity 150ms ease-out, filter 150ms ease-out",
        }
    : reducedMotion
      ? {}
      : {
          opacity: 1,
          filter: "none",
          transition: "opacity 150ms ease-out, filter 150ms ease-out",
        };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className={className}
      style={{ outline: "none", ...pendingStyle }}
    >
      {children}
    </div>
  );
}

export type { TransitionContainerProps };
