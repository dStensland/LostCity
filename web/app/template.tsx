"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Template component for page transitions.
 * Re-renders on every navigation, enabling smooth animations.
 * Uses CSS animations instead of framer-motion for better performance.
 * Server component - CSS animation doesn't need client-side JS.
 */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-page-enter">
      {children}
    </div>
  );
}
