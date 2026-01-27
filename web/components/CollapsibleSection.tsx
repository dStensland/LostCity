"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

// Category accent colors from neon rain aesthetic
const CATEGORY_COLORS = {
  food: "var(--gold)",
  drinks: "var(--coral)",
  nightlife: "var(--neon-magenta)",
  caffeine: "var(--neon-amber)",
  fun: "var(--neon-cyan)",
  events: "var(--coral)",
  venue: "var(--neon-magenta)",
} as const;

type CategoryKey = keyof typeof CATEGORY_COLORS;

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  icon?: ReactNode;
  category?: CategoryKey;
  accentColor?: string;
  children: ReactNode;
  maxItems?: number;
  totalItems?: number;
  onSeeAll?: () => void;
}

export default function CollapsibleSection({
  title,
  count,
  defaultOpen = false,
  icon,
  category,
  accentColor,
  children,
  maxItems = 5,
  totalItems,
  onSeeAll,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  const color = accentColor || (category ? CATEGORY_COLORS[category] : "var(--coral)");
  const itemCount = totalItems ?? count ?? 0;
  const hasMore = itemCount > maxItems && !showAll;

  // Update content height when isOpen changes
  useEffect(() => {
    if (contentRef.current) {
      if (isOpen) {
        setContentHeight(contentRef.current.scrollHeight);
      } else {
        setContentHeight(0);
      }
    }
  }, [isOpen, showAll, children]);

  // Watch for content changes
  useEffect(() => {
    if (isOpen && contentRef.current) {
      const observer = new ResizeObserver(() => {
        if (contentRef.current) {
          setContentHeight(contentRef.current.scrollHeight);
        }
      });
      observer.observe(contentRef.current);
      return () => observer.disconnect();
    }
  }, [isOpen]);

  const handleSeeAll = () => {
    if (onSeeAll) {
      onSeeAll();
    } else {
      setShowAll(true);
    }
  };

  return (
    <div className="border border-[var(--twilight)] rounded-xl overflow-hidden bg-[var(--dusk)]">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 transition-colors hover:bg-[var(--twilight)]/30 text-left group"
        style={{
          borderLeft: `3px solid ${color}`,
          boxShadow: isOpen ? `inset 0 0 20px ${color}10` : undefined,
        }}
      >
        {/* Icon */}
        {icon && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${color}20` }}
          >
            <span style={{ color }}>{icon}</span>
          </div>
        )}

        {/* Title and count */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[var(--cream)] font-medium text-sm group-hover:text-[var(--cream)] transition-colors">
            {title}
          </h3>
        </div>

        {/* Count badge */}
        {count !== undefined && count > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-[0.65rem] font-mono"
            style={{
              backgroundColor: `${color}20`,
              color: color,
            }}
          >
            {count}
          </span>
        )}

        {/* Chevron */}
        <svg
          className="w-5 h-5 text-[var(--muted)] transition-transform duration-200 flex-shrink-0"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          height: contentHeight !== undefined ? `${contentHeight}px` : "auto",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="p-4 pt-0">
          {children}

          {/* See all link */}
          {hasMore && (
            <button
              onClick={handleSeeAll}
              className="mt-3 w-full py-2 text-center text-sm font-mono transition-colors rounded-lg hover:bg-[var(--twilight)]/50"
              style={{ color }}
            >
              See all ({itemCount})
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Category icons for use with CollapsibleSection
export const CategoryIcons = {
  food: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
    </svg>
  ),
  drinks: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  nightlife: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  caffeine: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  fun: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  events: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  venue: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};
