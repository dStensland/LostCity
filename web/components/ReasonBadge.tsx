"use client";

import { memo } from "react";

export type ReasonType =
  | "friends_going"
  | "followed_venue"
  | "followed_organization"
  | "neighborhood"
  | "price"
  | "category"
  | "trending";

export type RecommendationReason = {
  type: ReasonType;
  label: string;
  detail?: string;
};

interface ReasonBadgeProps {
  reason: RecommendationReason;
  size?: "sm" | "md";
}

// Color mapping using existing design system variables
const REASON_STYLES: Record<ReasonType, { bg: string; text: string; icon: React.ReactNode }> = {
  friends_going: {
    bg: "bg-[var(--neon-cyan)]/15",
    text: "text-[var(--neon-cyan)]",
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  followed_venue: {
    bg: "bg-[var(--coral)]/15",
    text: "text-[var(--coral)]",
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  followed_organization: {
    bg: "bg-[var(--lavender)]/15",
    text: "text-[var(--lavender)]",
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  neighborhood: {
    bg: "bg-[var(--gold)]/15",
    text: "text-[var(--gold)]",
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  price: {
    bg: "bg-[var(--neon-green)]/15",
    text: "text-[var(--neon-green)]",
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  category: {
    bg: "bg-[var(--neon-magenta)]/15",
    text: "text-[var(--neon-magenta)]",
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  trending: {
    bg: "bg-[var(--neon-red)]/15",
    text: "text-[var(--neon-red)]",
    icon: (
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
};

// Priority for displaying reasons (higher priority first)
export const REASON_PRIORITY: ReasonType[] = [
  "friends_going",
  "followed_venue",
  "followed_organization",
  "neighborhood",
  "category",
  "price",
  "trending",
];

function ReasonBadge({ reason, size = "sm" }: ReasonBadgeProps) {
  const style = REASON_STYLES[reason.type] || REASON_STYLES.category;

  const sizeClasses = size === "sm"
    ? "text-[0.6rem] px-1.5 py-0.5 gap-1"
    : "text-xs px-2 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-medium ${style.bg} ${style.text} ${sizeClasses}`}
      title={reason.detail || reason.label}
    >
      {style.icon}
      <span className="truncate max-w-[100px]">
        {reason.detail || reason.label}
      </span>
    </span>
  );
}

export default memo(ReasonBadge);

/**
 * Sort reasons by priority and return top N
 */
export function getTopReasons(
  reasons: RecommendationReason[] | undefined,
  limit: number = 2
): RecommendationReason[] {
  if (!reasons || reasons.length === 0) return [];

  return [...reasons]
    .sort((a, b) => {
      const priorityA = REASON_PRIORITY.indexOf(a.type);
      const priorityB = REASON_PRIORITY.indexOf(b.type);
      return priorityA - priorityB;
    })
    .slice(0, limit);
}
