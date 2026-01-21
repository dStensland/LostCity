import React from "react";

type BadgeVariant = "live" | "soon" | "free" | "events" | "trending";

interface BadgeProps {
  variant: BadgeVariant;
  count?: number;
  className?: string;
}

const BADGE_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  live: {
    bg: "bg-[var(--neon-red)]/20",
    text: "text-[var(--neon-red)]",
    border: "border-[var(--neon-red)]/30",
  },
  soon: {
    bg: "bg-[var(--neon-amber)]/20",
    text: "text-[var(--neon-amber)]",
    border: "border-[var(--neon-amber)]/30",
  },
  free: {
    bg: "bg-[var(--neon-green)]/20",
    text: "text-[var(--neon-green)]",
    border: "border-[var(--neon-green)]/30",
  },
  events: {
    bg: "bg-[var(--coral)]/15",
    text: "text-[var(--coral)]",
    border: "border-[var(--coral)]/25",
  },
  trending: {
    bg: "bg-[var(--neon-magenta)]/20",
    text: "text-[var(--neon-magenta)]",
    border: "border-[var(--neon-magenta)]/30",
  },
};

const CalendarIcon = () => (
  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

export default function Badge({ variant, count, className = "" }: BadgeProps) {
  const styles = BADGE_STYLES[variant];

  // Live badge with pulse indicator
  if (variant === "live") {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[0.55rem] font-medium ${styles.bg} ${styles.text} ${styles.border} ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        LIVE
      </span>
    );
  }

  // Soon badge
  if (variant === "soon") {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[0.55rem] font-medium ${styles.bg} ${styles.text} ${styles.border} ${className}`}>
        SOON
      </span>
    );
  }

  // Free badge
  if (variant === "free") {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[0.55rem] font-medium ${styles.bg} ${styles.text} ${styles.border} ${className}`}>
        FREE
      </span>
    );
  }

  // Events count badge
  if (variant === "events" && count !== undefined && count > 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono text-[0.55rem] font-medium ${styles.bg} ${styles.text} ${styles.border} ${className}`}>
        <CalendarIcon />
        {count}
      </span>
    );
  }

  // Trending badge
  if (variant === "trending") {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border font-mono text-[0.55rem] font-medium ${styles.bg} ${styles.text} ${styles.border} ${className}`}>
        TRENDING
      </span>
    );
  }

  return null;
}

// Convenience exports for direct usage
export function LiveBadge({ className }: { className?: string }) {
  return <Badge variant="live" className={className} />;
}

export function SoonBadge({ className }: { className?: string }) {
  return <Badge variant="soon" className={className} />;
}

export function FreeBadge({ className }: { className?: string }) {
  return <Badge variant="free" className={className} />;
}

export function EventsBadge({ count, className }: { count: number; className?: string }) {
  return <Badge variant="events" count={count} className={className} />;
}

export function TrendingBadge({ className }: { className?: string }) {
  return <Badge variant="trending" className={className} />;
}
