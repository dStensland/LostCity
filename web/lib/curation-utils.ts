// ============================================================================
// Curation Types & Utilities
// Shared types, constants, and helpers for the curations system
// ============================================================================

// ============================================================================
// Constants
// ============================================================================

export const SUBMISSION_MODES = ["closed", "open", "collaborative"] as const;
export type SubmissionMode = (typeof SUBMISSION_MODES)[number];

export const OWNER_TYPES = ["user", "editorial", "portal"] as const;
export type OwnerType = (typeof OWNER_TYPES)[number];

export const ITEM_STATUSES = ["approved", "pending", "rejected"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const TIP_STATUSES = ["pending", "approved", "rejected", "flagged"] as const;
export type CurationTipStatus = (typeof TIP_STATUSES)[number];

export const COLLABORATOR_ROLES = ["editor", "moderator"] as const;
export type CollaboratorRole = (typeof COLLABORATOR_ROLES)[number];

export const COLLABORATOR_STATUSES = ["pending", "accepted", "declined"] as const;
export type CollaboratorStatus = (typeof COLLABORATOR_STATUSES)[number];

/** Minimum trusted tips count for auto-approval */
export const TRUSTED_TIP_THRESHOLD = 5;

/** Tip content length constraints */
export const TIP_MIN_LENGTH = 10;
export const TIP_MAX_LENGTH = 500;

/** Maximum vibe tags per curation */
export const MAX_VIBE_TAGS = 10;

/** Maximum vibe tag length */
export const MAX_VIBE_TAG_LENGTH = 30;

// ============================================================================
// Types
// ============================================================================

export type CurationCreator = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export type Curation = {
  id: string;
  portal_id: string | null;
  creator_id: string;
  title: string;
  slug: string;
  description: string | null;
  category: string | null;
  is_public: boolean;
  allow_contributions: boolean;
  status: string;
  created_at: string;
  updated_at?: string;
  // Curation fields (optional — not all API responses include them)
  cover_image_url?: string | null;
  accent_color?: string | null;
  vibe_tags?: string[];
  submission_mode?: string;
  upvote_count?: number;
  follower_count?: number;
  is_pinned?: boolean;
  owner_type?: string;
  // Computed / joined
  item_count: number;
  vote_count: number;
  thumbnails?: string[];
  creator?: CurationCreator;
  is_following?: boolean;
  portal?: { slug: string } | null;
};

/** Type alias for backward compatibility. */
export type List = Curation;

export type CurationItem = {
  id: string;
  list_id: string;
  item_type: "venue" | "event" | "organization" | "custom";
  venue_id: number | null;
  event_id: number | null;
  organization_id: number | null;
  custom_name: string | null;
  custom_description: string | null;
  position: number;
  added_by: string | null;
  created_at: string;
  // New curation fields
  blurb: string | null;
  upvote_count: number;
  status: ItemStatus;
  submitted_by: string | null;
  // Computed / joined
  vote_count: number;
  user_vote: "up" | "down" | null;
  added_by_profile?: {
    username: string;
    display_name: string | null;
  } | null;
  venue?: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    venue_type: string | null;
    image_url?: string | null;
  } | null;
  event?: {
    id: number;
    title: string;
    start_date: string;
    image_url?: string | null;
    venue?: { name: string } | null;
  } | null;
  organization?: {
    id: number;
    name: string;
    slug: string;
    image_url?: string | null;
  } | null;
};

export type CurationTip = {
  id: string;
  list_id: string;
  list_item_id: string | null;
  user_id: string;
  content: string;
  upvote_count: number;
  is_verified_visitor: boolean;
  status: CurationTipStatus;
  created_at: string;
  author?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

export type CurationFollow = {
  id: string;
  list_id: string;
  user_id: string;
  created_at: string;
};

export type CurationCollaborator = {
  id: string;
  list_id: string;
  user_id: string;
  role: CollaboratorRole;
  invited_by: string | null;
  status: CollaboratorStatus;
  created_at: string;
  profile?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

// ============================================================================
// Validation helpers
// ============================================================================

export function isValidSubmissionMode(value: unknown): value is SubmissionMode {
  return typeof value === "string" && SUBMISSION_MODES.includes(value as SubmissionMode);
}

export function isValidOwnerType(value: unknown): value is OwnerType {
  return typeof value === "string" && OWNER_TYPES.includes(value as OwnerType);
}

export function isValidItemStatus(value: unknown): value is ItemStatus {
  return typeof value === "string" && ITEM_STATUSES.includes(value as ItemStatus);
}

export function isValidCollaboratorRole(value: unknown): value is CollaboratorRole {
  return typeof value === "string" && COLLABORATOR_ROLES.includes(value as CollaboratorRole);
}

export function isValidVibeTags(tags: unknown): tags is string[] {
  if (!Array.isArray(tags)) return false;
  if (tags.length > MAX_VIBE_TAGS) return false;
  return tags.every(
    (tag) =>
      typeof tag === "string" &&
      tag.length > 0 &&
      tag.length <= MAX_VIBE_TAG_LENGTH &&
      /^[a-z0-9-]+$/.test(tag)
  );
}

export function isValidHexColor(value: unknown): boolean {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}
