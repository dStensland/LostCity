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
    setSupportsVT("startViewTransition" in document);
  }, []);

  return (
    <div key={pathname} className={supportsVT ? "" : "animate-page-enter"}>
      {children}
    </div>
  );
}
