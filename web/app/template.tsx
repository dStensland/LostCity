"use client";

import { ReactNode } from "react";

/**
 * Template component for page transitions.
 * Re-renders on every navigation, enabling smooth animations.
 * Uses CSS animations instead of framer-motion for better performance.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="animate-page-enter">
      {children}
    </div>
  );
}
