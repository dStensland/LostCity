// Groups (Crews) — PRD-036
// Types for private friend groups with shared hangs and venue lists

export type GroupVisibility = "private" | "unlisted";
export type GroupMemberRole = "admin" | "member";

export interface Group {
  id: string;
  name: string;
  description: string | null;
  emoji: string | null;
  avatar_url: string | null;
  creator_id: string;
  invite_code: string;
  visibility: GroupVisibility;
  max_members: number;
  created_at: string;
  updated_at: string;
}

export interface GroupWithMeta extends Group {
  member_count: number;
  latest_activity: string | null; // preview text
  latest_activity_at: string | null;
  active_hang_count: number;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
  invited_by: string | null;
  profile?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export interface GroupSpot {
  id: string;
  group_id: string;
  venue_id: number;
  added_by: string;
  note: string | null;
  added_at: string;
  venue?: {
    id: number;
    name: string;
    slug: string | null;
    image_url: string | null;
    neighborhood: string | null;
    address: string | null;
  };
  added_by_profile?: {
    display_name: string | null;
    username: string | null;
  };
}

export type GroupActivityType =
  | "hang_started"
  | "hang_planned"
  | "spot_added"
  | "member_joined";

export interface GroupActivity {
  type: GroupActivityType;
  timestamp: string;
  user: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  venue?: {
    id: number;
    name: string;
    slug: string | null;
  };
  note?: string | null;
}

// Request types
export interface CreateGroupRequest {
  name: string;
  description?: string;
  emoji?: string;
  visibility?: GroupVisibility;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  emoji?: string;
  avatar_url?: string;
  visibility?: GroupVisibility;
}

export interface AddGroupSpotRequest {
  venue_id: number;
  note?: string;
}

// Response types
export interface MyGroupsResponse {
  groups: GroupWithMeta[];
}

export interface GroupDetailResponse {
  group: Group;
  members: GroupMember[];
  my_role: GroupMemberRole;
}

export interface GroupSpotsResponse {
  spots: GroupSpot[];
}

export interface GroupActivityResponse {
  activity: GroupActivity[];
}

export interface GroupHangsResponse {
  active: GroupHangWithProfile[];
  planned: GroupHangWithProfile[];
}

export interface GroupHangWithProfile {
  id: string;
  user_id: string;
  venue_id: number;
  status: "active" | "planned";
  note: string | null;
  started_at: string;
  planned_for: string | null;
  auto_expire_at: string;
  profile: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  venue: {
    id: number;
    name: string;
    slug: string | null;
    image_url: string | null;
    neighborhood: string | null;
  };
}

// Constants
export const GROUP_VISIBILITY_OPTIONS = [
  {
    value: "private" as const,
    label: "Private",
    description: "Only visible to members",
    icon: "lock",
  },
  {
    value: "unlisted" as const,
    label: "Unlisted",
    description: "Visible on member profiles",
    icon: "eye-off",
  },
] as const;

export const MAX_GROUP_NAME_LENGTH = 60;
export const MAX_GROUP_DESCRIPTION_LENGTH = 280;
export const MAX_GROUP_SPOT_NOTE_LENGTH = 140;
export const MAX_GROUPS_PER_USER = 20;
export const MAX_MEMBERS_PER_GROUP = 100;
export const DEFAULT_MAX_MEMBERS = 50;
