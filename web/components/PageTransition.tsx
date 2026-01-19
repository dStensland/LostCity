"use client";

import { ReactNode } from "react";

type PageTransitionProps = {
  children: ReactNode;
};

/**
 * Wraps page content with smooth fade/slide transitions.
 * Use in layout.tsx or template.tsx to animate page changes.
 * Uses CSS animations for better performance (no framer-motion dependency).
 */
export default function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="animate-page-enter">
      {children}
    </div>
  );
}

/**
 * Staggered children animation wrapper.
 * Wrap a list of items to animate them in sequence.
 */
export function StaggerContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

/**
 * Individual item for stagger animation.
 * Use with stagger-N classes for delays.
 */
export function StaggerItem({
  children,
  className = "",
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  // Cap at 10 for stagger classes
  const staggerClass = index > 0 && index <= 10 ? `stagger-${index}` : "";

  return (
    <div className={`animate-fade-in ${staggerClass} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Fade in animation wrapper.
 */
export function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const delayClass = delay > 0 ? `delay-${Math.round(delay * 1000)}` : "";

  return (
    <div
      className={`animate-fade-in ${delayClass} ${className}`}
      style={delay > 0 && delay % 0.1 !== 0 ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Slide up and fade in animation.
 */
export function SlideUp({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`animate-fade-up ${className}`}
      style={delay > 0 ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
