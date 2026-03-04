"use client";

import { useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  className?: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
  className = "",
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={className}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between group min-h-[44px] focus-ring"
      >
        <h2 className="font-mono text-xs font-bold text-[var(--muted)] uppercase tracking-[0.14em] group-hover:text-[var(--soft)] transition-colors">
          {title}
        </h2>
        <CaretDown
          size={16}
          weight="bold"
          className={`text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>
      {expanded && <div className="mt-3">{children}</div>}
    </div>
  );
}
