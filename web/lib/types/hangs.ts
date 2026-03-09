/**
 * Client-safe types for the Hangs feature.
 * No server imports — safe to import from "use client" components.
 */

export type HangStatus = "active" | "planned" | "ended";
export type HangVisibility = "private" | "friends" | "public";

export interface Hang {
  id: string;
  user_id: string;
  venue_id: number;
  event_id: number | null;
  portal_id: string | null;
  status: HangStatus;
  visibility: HangVisibility;
  note: string | null;
  started_at: string;
  planned_for: string | null;
  auto_expire_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HangWithVenue extends Hang {
  venue: {
    id: number;
    name: string;
    slug: string | null;
    image_url: string | null;
    neighborhood: string | null;
    address: string | null;
  };
  event?: {
    id: number;
    title: string;
    start_date: string | null;
  } | null;
}

export interface FriendHang {
  hang: HangWithVenue;
  profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface VenueHangInfo {
  venue_id: number;
  total_count: number;
  friend_hangs: FriendHang[];
  public_count: number;
}

export interface HotVenue {
  venue_id: number;
  venue_name: string;
  venue_slug: string | null;
  venue_image_url: string | null;
  neighborhood: string | null;
  active_count: number;
  current_event: string | null; // Event title if there's one happening
}

// Request/response types for API routes
export interface CreateHangRequest {
  venue_id: number;
  event_id?: number;
  note?: string;
  visibility?: HangVisibility;
  planned_for?: string; // ISO timestamp for planned hangs
  duration_hours?: number; // Override default 4h expiry
}

export interface UpdateHangRequest {
  note?: string;
  visibility?: HangVisibility;
  action?: "end"; // End the active hang
}

// Constants
export const HANG_DURATION_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "2 hours", hours: 2 },
  { label: "4 hours", hours: 4 },
  { label: "Until I leave", hours: 8 },
] as const;

export const HANG_VISIBILITY_OPTIONS = [
  { value: "private" as const, label: "Just me", description: "Only you can see this" },
  { value: "friends" as const, label: "Friends", description: "Visible to your friends" },
  { value: "public" as const, label: "Public", description: "Anyone on LostCity can see" },
] as const;

export const MAX_HANG_NOTE_LENGTH = 280;
