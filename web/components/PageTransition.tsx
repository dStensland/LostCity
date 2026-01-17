"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type PageTransitionProps = {
  children: ReactNode;
};

const variants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

/**
 * Wraps page content with smooth fade/slide transitions.
 * Use in layout.tsx or template.tsx to animate page changes.
 */
export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={variants}
        initial="initial"
        animate="enter"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Staggered children animation wrapper.
 * Wrap a list of items to animate them in sequence.
 */
export function StaggerContainer({
  children,
  className = "",
  staggerDelay = 0.05,
}: {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="initial"
      animate="enter"
      variants={{
        initial: {},
        enter: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Individual item for stagger animation.
 */
export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={{
        initial: { opacity: 0, y: 12 },
        enter: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.25, 0.1, 0.25, 1] as const,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Fade in animation wrapper.
 */
export function FadeIn({
  children,
  className = "",
  delay = 0,
  duration = 0.4,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: [0.25, 0.1, 0.25, 1] as const }}
    >
      {children}
    </motion.div>
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
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.1, 0.25, 1] as const,
      }}
    >
      {children}
    </motion.div>
  );
}
