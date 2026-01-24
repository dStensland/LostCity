"use client";

import { useScrollReveal } from "@/hooks/useScrollReveal";
import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  delay?: number; // Stagger delay in ms
  direction?: "up" | "down" | "left" | "right" | "fade";
  threshold?: number;
  as?: "div" | "section" | "article";
}

const directionClasses = {
  up: { hidden: "translate-y-8", visible: "translate-y-0" },
  down: { hidden: "-translate-y-8", visible: "translate-y-0" },
  left: { hidden: "translate-x-8", visible: "translate-x-0" },
  right: { hidden: "-translate-x-8", visible: "translate-x-0" },
  fade: { hidden: "", visible: "" },
};

export default function ScrollReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
  threshold = 0.1,
  as: Component = "div",
}: Props) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>({ threshold });
  const dirClass = directionClasses[direction];

  return (
    <Component
      ref={ref}
      className={`transition-all duration-500 ease-out ${
        isVisible
          ? `opacity-100 ${dirClass.visible}`
          : `opacity-0 ${dirClass.hidden}`
      } ${className}`}
      style={{ transitionDelay: isVisible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </Component>
  );
}

/**
 * Wrapper for staggered children reveals
 */
interface StaggerProps {
  children: ReactNode[];
  className?: string;
  staggerDelay?: number; // Delay between each child in ms
  direction?: "up" | "down" | "left" | "right" | "fade";
}

export function ScrollRevealStagger({
  children,
  className = "",
  staggerDelay = 100,
  direction = "up",
}: StaggerProps) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <ScrollReveal key={index} delay={index * staggerDelay} direction={direction}>
          {child}
        </ScrollReveal>
      ))}
    </div>
  );
}
