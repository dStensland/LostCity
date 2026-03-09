/**
 * Shared profile types for the community/friends feature.
 */

export type FriendProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export type SuggestedProfile = FriendProfile & {
  mutual_friends_count?: number;
  suggestion_reason?: "mutual_friends" | "shared_interests" | "similar_activity" | "popular";
};

export type FriendRequest = {
  id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
  inviter?: FriendProfile | null;
  invitee?: FriendProfile | null;
};
