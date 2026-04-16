"use client";

import type { ReactNode } from "react";
import { useScrollReveal } from "@/lib/hooks/useScrollReveal";
import { SectionHeader } from "./SectionHeader";
import type { SectionModule, EntityData } from "@/lib/detail/types";

interface SectionWrapperProps {
  module: SectionModule;
  data: EntityData;
  children: ReactNode;
  /** Position in the manifest — used to decide if above/below fold */
  index: number;
}

export function SectionWrapper({ module, data, children, index }: SectionWrapperProps) {
  const count = module.getCount?.(data) ?? null;

  // First 2 sections are above fold — reveal immediately; below-fold sections use IntersectionObserver
  const isAboveFold = index < 2;
  const { ref, isVisible } = useScrollReveal({ threshold: 0.1 });

  return (
    <section ref={isAboveFold ? undefined : ref}>
      <div className="w-full h-2 bg-[var(--night)]" />
      <div
        className={`px-4 lg:px-8 py-4 flex flex-col gap-3 ${
          isAboveFold
            ? "motion-fade-up"
            : isVisible
              ? "motion-fade-up"
              : "opacity-0"
        }`}
        style={
          isAboveFold
            ? { animationDelay: `${200 + index * 80}ms` }
            : undefined
        }
      >
        {!module.hideWrapperHeader && (
          <SectionHeader label={module.label} count={count} icon={module.icon} />
        )}
        <div>{children}</div>
      </div>
    </section>
  );
}
