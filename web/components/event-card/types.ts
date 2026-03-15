/**
 * Shared types for EventCard sub-components.
 * Exported from EventCard.tsx for external consumers.
 */

export type FriendGoing = {
  user_id: string;
  status: "going" | "interested";
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};
