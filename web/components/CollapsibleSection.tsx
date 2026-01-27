"use client";

import { useState, useRef, useEffect, ReactNode } from "react";

// Category accent colors - vibrant neon palette
const CATEGORY_COLORS = {
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
        background: isOpen
          ? `linear-gradient(135deg, rgba(20,20,30,0.95) 0%, rgba(30,30,45,0.9) 100%)`
          : `linear-gradient(135deg, rgba(15,15,25,0.8) 0%, rgba(25,25,40,0.7) 100%)`,
        boxShadow: isOpen
          ? `0 0 20px ${color}30, inset 0 1px 0 ${color}20`
          : `0 0 0 1px rgba(255,255,255,0.05)`,
      }}
    >
      {/* Neon border glow effect */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isOpen ? 1 : 0,
          background: `linear-gradient(90deg, ${color}40 0%, transparent 50%, ${color}40 100%)`,
          maskImage: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          padding: '1px',
        }}
      />

      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 transition-all duration-200 text-left group relative z-10"
      >
        {/* Glowing left accent bar */}
        <div
          className="absolute left-0 top-2 bottom-2 w-1 rounded-full transition-all duration-300"
          style={{
            background: color,
            boxShadow: isOpen ? `0 0 12px ${color}, 0 0 24px ${color}60` : `0 0 4px ${color}60`,
          }}
        />

        {/* Icon with glow */}
        {icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-2 transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${color}30 0%, ${color}10 100%)`,
              boxShadow: isOpen ? `0 0 16px ${color}40` : 'none',
            }}
          >
            <span
              className="text-xl transition-transform duration-300"
              style={{
                filter: isOpen ? `drop-shadow(0 0 6px ${color})` : 'none',
                transform: isOpen ? 'scale(1.1)' : 'scale(1)',
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
              textShadow: isOpen ? `0 0 20px ${color}80` : 'none',
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

        {/* Count badge with neon style */}
        {count !== undefined && count > 0 && (
          <span
            className="px-2.5 py-1 rounded-full text-[0.7rem] font-bold font-mono transition-all duration-300"
            style={{
              background: `linear-gradient(135deg, ${color}40 0%, ${color}20 100%)`,
              color: color,
              boxShadow: isOpen ? `0 0 12px ${color}50, inset 0 0 8px ${color}20` : 'none',
              border: `1px solid ${color}40`,
            }}
          >
            {count}
          </span>
        )}

        {/* Animated chevron */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 flex-shrink-0"
          style={{
            background: isOpen ? `${color}20` : 'transparent',
          }}
        >
          <svg
            className="w-5 h-5 transition-all duration-300"
            style={{
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              color: isOpen ? color : 'var(--muted)',
              filter: isOpen ? `drop-shadow(0 0 4px ${color})` : 'none',
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
            className="h-px mb-4 transition-all duration-300"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${color}40 50%, transparent 100%)`,
            }}
          />

          {children}

          {/* See all link with neon style */}
          {hasMore && (
            <button
              onClick={handleSeeAll}
              className="mt-4 w-full py-2.5 text-center text-sm font-mono font-semibold tracking-wider uppercase transition-all duration-300 rounded-lg border"
              style={{
                color,
                borderColor: `${color}40`,
                background: `linear-gradient(135deg, ${color}10 0%, transparent 100%)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${color}30 0%, ${color}10 100%)`;
                e.currentTarget.style.boxShadow = `0 0 20px ${color}30`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${color}10 0%, transparent 100%)`;
                e.currentTarget.style.boxShadow = 'none';
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

// Category icons for use with CollapsibleSection - now using emojis for more fun
export const CategoryIcons = {
  food: "🍽️",
  drinks: "🍺",
  nightlife: "🪩",
  caffeine: "☕",
  fun: "🎮",
  events: "📅",
  venue: "📍",
};
