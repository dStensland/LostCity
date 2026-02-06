"use client";

import ScopedStyles from "@/components/ScopedStyles";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";

interface NeonDividerProps {
  className?: string;
  variant?: "cyan" | "pink" | "gradient";
}

/**
 * Animated neon line divider that draws in on scroll
 */
export default function NeonDivider({ className = "", variant = "gradient" }: NeonDividerProps) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold: 0.5 });

  const styles = `
    .neon-divider-line {
      transform: scaleX(0);
      transform-origin: center;
      opacity: 0;
      transition: transform 1s ease-out, opacity 1s ease-out, box-shadow 1s ease-out;
    }
    .neon-divider-line.neon-divider-visible {
      transform: scaleX(1);
      opacity: 0.6;
    }
    .neon-divider-line[data-variant="cyan"] {
      background: #00e5ff;
    }
    .neon-divider-line[data-variant="pink"] {
      background: #ff6b9d;
    }
    .neon-divider-line[data-variant="gradient"] {
      background: linear-gradient(90deg, transparent 0%, #00e5ff 20%, #ff6b9d 80%, transparent 100%);
    }
    .neon-divider-line.neon-divider-visible[data-variant="cyan"] {
      box-shadow: 0 0 20px rgba(0, 229, 255, 0.5);
    }
    .neon-divider-line.neon-divider-visible[data-variant="pink"] {
      box-shadow: 0 0 20px rgba(255, 107, 157, 0.5);
    }
    .neon-divider-line.neon-divider-visible[data-variant="gradient"] {
      box-shadow: 0 0 20px rgba(0, 229, 255, 0.3), 0 0 40px rgba(255, 107, 157, 0.2);
    }
  `;

  return (
    <div ref={ref} className={`relative h-px overflow-hidden ${className}`}>
      <ScopedStyles css={styles} />
      <div
        data-variant={variant}
        className={`absolute inset-0 neon-divider-line ${isVisible ? "neon-divider-visible" : ""}`}
      />
    </div>
  );
}
