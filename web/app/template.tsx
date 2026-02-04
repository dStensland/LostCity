import { ReactNode } from "react";

/**
 * Template component for page transitions.
 * Re-renders on every navigation, enabling smooth animations.
 * Uses CSS animations instead of framer-motion for better performance.
 * Server component - CSS animation doesn't need client-side JS.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <div className="animate-page-enter">
      {children}
    </div>
  );
}
