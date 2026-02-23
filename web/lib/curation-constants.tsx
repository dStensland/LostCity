/**
 * Shared constants for curation categories.
 * Single source of truth — import from here instead of duplicating.
 */
import React from "react";

export const CATEGORY_LABELS: Record<string, string> = {
  best_of: "Best Of",
  hidden_gems: "Hidden Gems",
  date_night: "Date Night",
  with_friends: "With Friends",
  solo: "Solo",
  budget: "Budget-Friendly",
  special_occasion: "Special Occasion",
};

export const CATEGORY_COLORS: Record<string, string> = {
  best_of: "#FBBF24",
  hidden_gems: "#A78BFA",
  date_night: "#F472B6",
  with_friends: "#6EE7B7",
  solo: "#5EEAD4",
  budget: "#4ADE80",
  special_occasion: "#F9A8D4",
};

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  best_of: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  hidden_gems: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  date_night: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  with_friends: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  solo: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  budget: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  special_occasion: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
    </svg>
  ),
};

/**
 * Category options for the create modal.
 * Combines label, description, icon, and value.
 */
export const CATEGORY_OPTIONS = [
  { value: "best_of", label: "Best Of", description: "Top picks and essentials" },
  { value: "hidden_gems", label: "Hidden Gems", description: "Underrated favorites" },
  { value: "date_night", label: "Date Night", description: "Romantic spots" },
  { value: "with_friends", label: "With Friends", description: "Group hangouts" },
  { value: "solo", label: "Solo", description: "Great for going alone" },
  { value: "budget", label: "Budget-Friendly", description: "Easy on the wallet" },
  { value: "special_occasion", label: "Special Occasion", description: "Celebrations" },
] as const;

/**
 * Category gradient backgrounds for cards without cover images.
 * Each gradient uses the category color mixed with dark tones
 * to create a rich visual fallback that matches the brand.
 */
export const CATEGORY_GRADIENTS: Record<string, string> = {
  best_of: "linear-gradient(135deg, #1a1506 0%, #3d2e08 40%, #FBBF24 100%)",
  hidden_gems: "linear-gradient(135deg, #13072b 0%, #2d1a5e 40%, #A78BFA 100%)",
  date_night: "linear-gradient(135deg, #1f0716 0%, #4a1035 40%, #F472B6 100%)",
  with_friends: "linear-gradient(135deg, #041f14 0%, #0d3d2a 40%, #6EE7B7 100%)",
  solo: "linear-gradient(135deg, #041f1f 0%, #0d3d3d 40%, #5EEAD4 100%)",
  budget: "linear-gradient(135deg, #061f0a 0%, #0d3d14 40%, #4ADE80 100%)",
  special_occasion: "linear-gradient(135deg, #1f0716 0%, #4a1035 40%, #F9A8D4 100%)",
};

/** Default gradient when category is unknown */
export const DEFAULT_GRADIENT = "linear-gradient(135deg, #1a0a0a 0%, #3d1a1a 40%, var(--coral) 100%)";
