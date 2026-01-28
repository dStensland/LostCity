"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

// Category accent colors - vibrant neon palette
export const CATEGORY_COLORS = {
  food: "#FFD700", // gold
  drinks: "#FF6B6B", // coral/red
  nightlife: "#FF00FF", // magenta
  caffeine: "#FFA500", // orange/amber
  fun: "#00FFFF", // cyan
  events: "#FF6B6B", // coral
  venue: "#FF00FF", // magenta
} as const;

// Fun category labels with flair
const CATEGORY_LABELS: Record<string, string> = {
  food: "Grab a Bite",
  drinks: "Wet Your Whistle",
  nightlife: "Keep the Party Going",
  caffeine: "Fuel Up",
  fun: "Play Around",
  events: "Other Happenings",
  venue: "More Here",
};

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

  const color = accentColor || (category ? CATEGORY_COLORS[category] : "#FF6B6B");
  const displayTitle = category && CATEGORY_LABELS[category] ? CATEGORY_LABELS[category] : title;
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
    <div
      className="relative rounded-xl overflow-hidden transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, rgba(20,20,30,0.9) 0%, rgba(30,30,45,0.85) 100%)`,
        border: `1px solid ${color}${isOpen ? '40' : '20'}`,
        boxShadow: isOpen
          ? `0 0 20px ${color}25, inset 0 1px 0 ${color}15`
          : `0 0 8px ${color}10`,
      }}
    >

      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 transition-all duration-200 text-left group relative z-10"
      >
        {/* Left accent bar - subtle glow when open */}
        <div
          className="absolute left-0 top-2 bottom-2 w-1 rounded-full transition-all duration-300"
          style={{
            background: color,
            opacity: isOpen ? 1 : 0.6,
            boxShadow: isOpen ? `0 0 8px ${color}80` : 'none',
          }}
        />

        {/* Icon with subtle glow when open */}
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${color}${isOpen ? '30' : '20'} 0%, ${color}10 100%)`,
              boxShadow: isOpen ? `0 0 12px ${color}30` : 'none',
            }}
          >
            <span
              className="text-xl transition-all duration-300"
              style={{
                filter: isOpen ? `drop-shadow(0 0 4px ${color}80)` : 'none',
              }}
            >
              {icon}
            </span>
          </div>
        )}

        {/* Title and count */}
        <div className="flex-1 min-w-0 ml-1">
          <h3
            className="font-semibold text-sm tracking-wide transition-all duration-300"
            style={{
              color: isOpen ? color : 'var(--cream)',
              textShadow: isOpen ? `0 0 12px ${color}60` : 'none',
            }}
          >
            {displayTitle}
          </h3>
          {title !== displayTitle && (
            <p className="text-[0.65rem] text-[var(--muted)] font-mono uppercase tracking-wider mt-0.5">
              {title}
            </p>
          )}
        </div>

        {/* Count badge with subtle glow */}
        {count !== undefined && count > 0 && (
          <span
            className="px-2.5 py-1 rounded-full text-[0.7rem] font-bold font-mono transition-all duration-300"
            style={{
              background: `${color}${isOpen ? '25' : '15'}`,
              color: color,
              border: `1px solid ${color}${isOpen ? '50' : '30'}`,
              boxShadow: isOpen ? `0 0 8px ${color}40` : 'none',
            }}
          >
            {count}
          </span>
        )}

        {/* Animated chevron with glow */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
          <svg
            className="w-5 h-5 transition-all duration-300"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              color: isOpen ? color : 'var(--muted)',
              filter: isOpen ? `drop-shadow(0 0 3px ${color})` : 'none',
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          height: contentHeight !== undefined ? `${contentHeight}px` : "auto",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-4 pb-4 pt-0">
          {/* Subtle divider */}
          <div
            className="h-px mb-4"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${color}25 50%, transparent 100%)`,
            }}
          />

          {children}

          {/* See all link */}
          {hasMore && (
            <button
              onClick={handleSeeAll}
              className="mt-4 w-full py-2.5 text-center text-sm font-mono font-semibold tracking-wider uppercase transition-all duration-200 rounded-lg border hover:opacity-80"
              style={{
                color,
                borderColor: `${color}30`,
                background: `${color}08`,
              }}
            >
              See all {itemCount} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Category icons for use with CollapsibleSection - neon outline style
export const CategoryIcons = {
  // Food - Cloche / dome
  food: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <ellipse cx="12" cy="17" rx="9" ry="4" strokeWidth={1.5} />
      <path d="M4 15c0-6 4-10 8-10s8 4 8 10" strokeWidth={1.5} />
      <circle cx="12" cy="5" r="1" fill="currentColor" />
    </svg>
  ),
  // Drinks - Tilted glass with bubbles
  drinks: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M6 4h10l-2 15H8L6 4z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" transform="rotate(-10, 12, 12)" />
      <ellipse cx="11" cy="6" rx="4" ry="1.5" strokeWidth={1.5} transform="rotate(-10, 12, 12)" />
      <circle cx="10" cy="11" r="0.8" fill="currentColor" opacity={0.5} />
      <circle cx="12" cy="14" r="0.6" fill="currentColor" opacity={0.4} />
    </svg>
  ),
  // Nightlife - Disco ball
  nightlife: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="7" strokeWidth={1.5} />
      <path d="M5 12h14M12 5v14" strokeWidth={1.5} opacity={0.4} />
      <path d="M7 7l10 10M17 7L7 17" strokeWidth={1.5} opacity={0.25} />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  ),
  // Caffeine - Steaming cup
  caffeine: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M5 9h11v8a3 3 0 01-3 3H8a3 3 0 01-3-3V9z" strokeWidth={1.5} />
      <path d="M16 11h1.5a2.5 2.5 0 010 5H16" strokeWidth={1.5} />
      <path d="M8 4c0 2 2 3 2 5M12 4c0 2 2 3 2 5" strokeWidth={1.5} strokeLinecap="round" opacity={0.5} />
    </svg>
  ),
  // Fun - Game controller
  fun: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="3" y="7" width="18" height="10" rx="3" strokeWidth={1.5} />
      <path d="M7 10v4M5 12h4" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <circle cx="18" cy="13" r="1" fill="currentColor" opacity={0.6} />
    </svg>
  ),
  // Events - Calendar
  events: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth={1.5} />
      <path d="M3 10h18" strokeWidth={1.5} />
      <path d="M8 2v4M16 2v4" strokeWidth={1.5} strokeLinecap="round" />
      <circle cx="8" cy="15" r="1.5" fill="currentColor" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" opacity={0.6} />
      <circle cx="16" cy="15" r="1.5" fill="currentColor" opacity={0.4} />
    </svg>
  ),
  // Venue - Location pin
  venue: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 2C8 2 5 5.5 5 9c0 5 7 13 7 13s7-8 7-13c0-3.5-3-7-7-7z" strokeWidth={1.5} />
      <circle cx="12" cy="9" r="2.5" strokeWidth={1.5} />
    </svg>
  ),
};
