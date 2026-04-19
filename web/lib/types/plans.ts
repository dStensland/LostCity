/**
 * Client-safe types for the Plans feature.
 * No server imports — safe to import from "use client" components.
 */

export type PlanStatus = "planning" | "active" | "ended" | "expired" | "cancelled";
export type PlanVisibility = "private" | "friends" | "public";
export type PlanAnchorType = "event" | "place" | "series";
export type RsvpStatus = "invited" | "going" | "maybe" | "declined";

export interface Plan {
  id: string;
  creator_id: string;
  portal_id: string;

  anchor_type: PlanAnchorType;
  anchor_event_id: number | null;
  anchor_place_id: number | null;
  anchor_series_id: string | null;

  status: PlanStatus;
  starts_at: string;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;

  visibility: PlanVisibility;
  title: string | null;
  note: string | null;
  share_token: string;

  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanInvitee {
  plan_id: string;
  user_id: string;
  rsvp_status: RsvpStatus;
  invited_by: string | null;
  invited_at: string;
  responded_at: string | null;
  seen_at: string | null;
}

export interface PlanAnchor {
  event?: { id: number; title: string; start_date: string | null; image_url: string | null } | null;
  place?: { id: number; name: string; slug: string | null; image_url: string | null; neighborhood: string | null } | null;
  series?: { id: string; title: string; slug: string | null } | null;
}

export interface InviteeWithProfile extends PlanInvitee {
  profile: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface PlanWithDetail extends Plan {
  anchor: PlanAnchor;
  invitees: InviteeWithProfile[];
}

export interface CreatePlanRequest {
  anchor_type: PlanAnchorType;
  anchor_id: number | string;              // int for event/place, uuid for series
  portal_id: string;
  starts_at: string;                        // ISO
  visibility?: PlanVisibility;
  title?: string;
  note?: string;
  invite_user_ids?: string[];
}

export interface UpdatePlanRequest {
  title?: string | null;
  note?: string | null;
  visibility?: PlanVisibility;
  starts_at?: string;
  status?: Extract<PlanStatus, "active" | "ended" | "cancelled">;
}

export interface EventPlansAggregate {
  going_count: number;
  friend_going_count: number;
}

export interface PlacePlansAggregate {
  active_count: number;
  friends_here: Array<{ user_id: string; display_name: string | null; avatar_url: string | null }>;
}

export const PLAN_DURATION_HOURS_DEFAULT = 6;
export const MAX_PLAN_TITLE_LENGTH = 140;
export const MAX_PLAN_NOTE_LENGTH = 280;
