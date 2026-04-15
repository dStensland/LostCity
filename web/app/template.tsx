"use client";

import { ReactNode, useState, useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Template component for page transitions.
 * Re-renders on every navigation via key={pathname} for state isolation.
 * Suppresses CSS page-enter animation when View Transitions API is active
 * (VT handles its own crossfade).
 */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [supportsVT, setSupportsVT] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-once feature detection: supportsVT is not in deps ([]), so cascade is bounded. Must run in effect (not useState initializer) because document is undefined during SSR, and a lazy initializer would hydration-mismatch.
    setSupportsVT("startViewTransition" in document);
  }, []);

  return (
    <div key={pathname} className={supportsVT ? "" : "animate-page-enter"}>
      {children}
    </div>
  );
}
