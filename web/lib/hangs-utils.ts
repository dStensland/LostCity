/**
 * Client-safe utilities for the Hangs feature.
 * No server imports — safe to use in "use client" components.
 *
 * Types live in lib/types/hangs.ts. This file adds grouping and formatting
 * helpers for rendering the "Friends out" feed section and venue hang badges.
 */

import type { FriendHang } from "@/lib/types/hangs";

// ============================================================================
// Venue grouping
// ============================================================================

/**
 * A group of friend hangs at the same venue, used by the "Friends out" section.
 * primary_friend is the earliest arrival; others are everyone else at that venue.
 */
export interface VenueGroupedHangs {
  venue_id: number;
  venue_name: string;
  venue_slug?: string | null;
  neighborhood?: string | null;
  primary_friend: FriendHang;
  others: FriendHang[];
  /** ISO timestamp of the earliest started_at across all hangs in the group */
  earliest_started_at: string;
}

/**
 * Group a flat list of friend hangs by venue.
 *
 * - Groups are ordered by earliest_started_at descending (most recent first)
 * - Within each group, primary_friend is the person who arrived earliest
 * - others contains all remaining hangs at that venue, ordered by started_at asc
 */
export function groupFriendHangsByVenue(hangs: FriendHang[]): VenueGroupedHangs[] {
  if (hangs.length === 0) return [];

  // Bucket by venue_id
  const buckets = new Map<number, FriendHang[]>();
  for (const fh of hangs) {
    const vid = fh.hang.venue_id;
    const bucket = buckets.get(vid);
    if (bucket) {
      bucket.push(fh);
    } else {
      buckets.set(vid, [fh]);
    }
  }

  const groups: VenueGroupedHangs[] = [];

  for (const [venue_id, members] of buckets) {
    // Sort by started_at ascending to identify earliest arrival
    const sorted = [...members].sort(
      (a, b) =>
        new Date(a.hang.started_at).getTime() - new Date(b.hang.started_at).getTime()
    );

    const primary = sorted[0];
    const others = sorted.slice(1);

    groups.push({
      venue_id,
      venue_name: primary.hang.venue.name,
      venue_slug: primary.hang.venue.slug,
      neighborhood: primary.hang.venue.neighborhood,
      primary_friend: primary,
      others,
      earliest_started_at: primary.hang.started_at,
    });
  }

  // Sort groups by earliest_started_at descending (most recently active first)
  groups.sort(
    (a, b) =>
      new Date(b.earliest_started_at).getTime() -
      new Date(a.earliest_started_at).getTime()
  );

  return groups;
}

// ============================================================================
// Time formatting
// ============================================================================

/** Maximum hang duration in hours — hangs auto-expire at 4h (or 8h for "until I leave"). */
const MAX_HANG_DISPLAY_HOURS = 4;

/**
 * Format elapsed time since a hang started.
 *
 * Returns "Xm ago" (< 60 min), "Xh ago" (1–4h), or "4h ago" for anything older.
 * The 4h cap matches the default auto_expire_at so we never show a stale number.
 */
export function formatHangTimeAgo(startedAt: string): string {
  const started = new Date(startedAt);
  const now = new Date();
  const elapsedMs = now.getTime() - started.getTime();

  if (elapsedMs < 0) {
    // Planned hang — shouldn't reach this formatter, but be safe
    return "soon";
  }

  const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
  const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));

  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
  if (elapsedHours >= MAX_HANG_DISPLAY_HOURS) return `${MAX_HANG_DISPLAY_HOURS}h ago`;
  return `${elapsedHours}h ago`;
}

// ============================================================================
// Display helpers
// ============================================================================

/**
 * Return a displayable name for a hang participant.
 * Falls back to username, then a generic label.
 */
export function hangDisplayName(profile: {
  display_name: string | null;
  username: string | null;
}): string {
  return profile.display_name?.trim() || profile.username?.trim() || "Someone";
}

/**
 * Summarize the "others" list into a short phrase.
 * e.g. "and 2 others" or "and Alex"
 */
export function formatOthersSummary(others: FriendHang[]): string | null {
  if (others.length === 0) return null;
  if (others.length === 1) {
    const name = hangDisplayName(others[0].profile);
    return `and ${name}`;
  }
  return `and ${others.length} others`;
}
