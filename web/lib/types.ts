export type Database = {
  public: {
    Tables: {
      events: {
        Row: {
          id: number;
          source_id: number | null;
          venue_id: number | null;
          title: string;
          description: string | null;
          start_date: string;
          start_time: string | null;
          end_date: string | null;
          end_time: string | null;
          is_all_day: boolean;
          category: string | null;
          subcategory: string | null;
          tags: string[] | null;
          price_min: number | null;
          price_max: number | null;
          price_note: string | null;
          is_free: boolean;
          source_url: string;
          ticket_url: string | null;
          image_url: string | null;
          raw_text: string | null;
          extraction_confidence: number | null;
          is_recurring: boolean;
          recurrence_rule: string | null;
          content_hash: string | null;
          canonical_event_id: number | null;
          created_at: string;
          updated_at: string;
          search_vector: unknown | null; // tsvector for full-text search
        };
      };
      venues: {
        Row: {
          id: number;
          name: string;
          slug: string;
          address: string | null;
          neighborhood: string | null;
          city: string;
          state: string;
          zip: string | null;
          lat: number | null;
          lng: number | null;
          venue_type: string | null;
          website: string | null;
          aliases: string[] | null;
          created_at: string;
          search_vector: unknown | null; // tsvector for full-text search
        };
      };
      sources: {
        Row: {
          id: number;
          name: string;
          slug: string;
          url: string;
          source_type: string;
          crawl_frequency: string;
          is_active: boolean;
          created_at: string;
        };
      };
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          location: string | null;
          website: string | null;
          is_public: boolean;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          location?: string | null;
          website?: string | null;
          is_public?: boolean;
          is_admin?: boolean;
        };
        Update: {
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          location?: string | null;
          website?: string | null;
          is_public?: boolean;
          is_admin?: boolean;
        };
      };
      user_preferences: {
        Row: {
          user_id: string;
          favorite_categories: string[] | null;
          favorite_neighborhoods: string[] | null;
          favorite_vibes: string[] | null;
          price_preference: string | null;
          notification_settings: Record<string, unknown>;
          onboarding_mood: string | null;
          onboarding_completed_at: string | null;
          hide_adult_content: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          favorite_categories?: string[] | null;
          favorite_neighborhoods?: string[] | null;
          favorite_vibes?: string[] | null;
          price_preference?: string | null;
          notification_settings?: Record<string, unknown>;
          onboarding_mood?: string | null;
          onboarding_completed_at?: string | null;
          hide_adult_content?: boolean;
        };
        Update: {
          favorite_categories?: string[] | null;
          favorite_neighborhoods?: string[] | null;
          favorite_vibes?: string[] | null;
          price_preference?: string | null;
          notification_settings?: Record<string, unknown>;
          onboarding_mood?: string | null;
          onboarding_completed_at?: string | null;
          hide_adult_content?: boolean;
        };
      };
      onboarding_interactions: {
        Row: {
          id: string;
          user_id: string;
          step: string;
          event_id: number | null;
          action: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          step: string;
          event_id?: number | null;
          action: string;
        };
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          followed_user_id: string | null;
          followed_venue_id: number | null;
          followed_org_id: number | null;
          created_at: string;
        };
        Insert: {
          follower_id: string;
          followed_user_id?: string | null;
          followed_venue_id?: number | null;
          followed_org_id?: number | null;
        };
      };
      user_blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          is_muted: boolean;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_id: string;
          is_muted?: boolean;
        };
      };
      event_rsvps: {
        Row: {
          id: string;
          user_id: string;
          event_id: number;
          status: string;
          visibility: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          event_id: number;
          status: string;
          visibility?: string;
        };
        Update: {
          status?: string;
          visibility?: string;
        };
      };
      recommendations: {
        Row: {
          id: string;
          user_id: string;
          event_id: number | null;
          venue_id: number | null;
          org_id: number | null;
          note: string | null;
          visibility: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          event_id?: number | null;
          venue_id?: number | null;
          org_id?: number | null;
          note?: string | null;
          visibility?: string;
        };
      };
      saved_items: {
        Row: {
          id: string;
          user_id: string;
          event_id: number | null;
          venue_id: number | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          event_id?: number | null;
          venue_id?: number | null;
        };
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          activity_type: string;
          visibility: string;
          event_id: number | null;
          venue_id: number | null;
          target_user_id: string | null;
          org_id: number | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          user_id: string;
          activity_type: string;
          visibility?: string;
          event_id?: number | null;
          venue_id?: number | null;
          target_user_id?: string | null;
          org_id?: number | null;
          metadata?: Record<string, unknown>;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          actor_id: string | null;
          event_id: number | null;
          venue_id: number | null;
          message: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          type: string;
          actor_id?: string | null;
          event_id?: number | null;
          venue_id?: number | null;
          message?: string | null;
        };
        Update: {
          read_at?: string | null;
        };
      };
      friend_requests: {
        Row: {
          id: string;
          inviter_id: string;
          invitee_id: string;
          status: "pending" | "accepted" | "declined";
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          inviter_id: string;
          invitee_id: string;
          status?: "pending" | "accepted" | "declined";
        };
        Update: {
          status?: "pending" | "accepted" | "declined";
        };
      };
      event_invites: {
        Row: {
          id: string;
          event_id: number;
          inviter_id: string;
          invitee_id: string;
          note: string | null;
          status: "pending" | "accepted" | "declined" | "maybe";
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          event_id: number;
          inviter_id: string;
          invitee_id: string;
          note?: string | null;
          status?: "pending" | "accepted" | "declined" | "maybe";
        };
        Update: {
          status?: "pending" | "accepted" | "declined" | "maybe";
          responded_at?: string | null;
        };
      };
      inferred_preferences: {
        Row: {
          id: string;
          user_id: string;
          signal_type: string;
          signal_value: string;
          score: number;
          interaction_count: number;
          last_interaction_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          signal_type: string;
          signal_value: string;
          score?: number;
          interaction_count?: number;
        };
        Update: {
          score?: number;
          interaction_count?: number;
          last_interaction_at?: string;
        };
      };
      hidden_events: {
        Row: {
          user_id: string;
          event_id: number;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          event_id: number;
          reason?: string | null;
        };
      };
      organizations: {
        Row: {
          id: number;
          name: string;
        };
      };
      venue_tag_definitions: {
        Row: {
          id: string;
          slug: string;
          label: string;
          category: "vibe" | "amenity" | "good_for" | "food_drink" | "accessibility";
          is_official: boolean;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          slug: string;
          label: string;
          category: string;
          is_official?: boolean;
          is_active?: boolean;
          created_by?: string | null;
        };
      };
      venue_tags: {
        Row: {
          id: string;
          venue_id: number;
          tag_id: string;
          added_by: string;
          created_at: string;
        };
        Insert: {
          venue_id: number;
          tag_id: string;
          added_by: string;
        };
      };
      venue_tag_votes: {
        Row: {
          id: string;
          venue_tag_id: string;
          user_id: string;
          vote_type: "up" | "down";
          created_at: string;
        };
        Insert: {
          venue_tag_id: string;
          user_id: string;
          vote_type: "up" | "down";
        };
        Update: {
          vote_type?: "up" | "down";
        };
      };
      venue_tag_suggestions: {
        Row: {
          id: string;
          venue_id: number;
          suggested_label: string;
          suggested_category: string;
          suggested_by: string;
          status: "pending" | "approved" | "rejected";
          reviewed_by: string | null;
          reviewed_at: string | null;
          rejection_reason: string | null;
          created_at: string;
        };
        Insert: {
          venue_id: number;
          suggested_label: string;
          suggested_category: string;
          suggested_by: string;
          status?: "pending" | "approved" | "rejected";
        };
        Update: {
          status?: "pending" | "approved" | "rejected";
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          rejection_reason?: string | null;
        };
      };
    };
  };
};

// Venue tag types for use throughout the app
export type VenueTagDefinition = Database["public"]["Tables"]["venue_tag_definitions"]["Row"];

export type VenueTag = Database["public"]["Tables"]["venue_tags"]["Row"];

export type VenueTagVote = Database["public"]["Tables"]["venue_tag_votes"]["Row"];

export type VenueTagSuggestion = Database["public"]["Tables"]["venue_tag_suggestions"]["Row"];

export type VenueTagCategory = "vibe" | "amenity" | "good_for" | "food_drink" | "accessibility";

// Tag summary from materialized view
export interface VenueTagSummary {
  venue_id: number;
  tag_id: string;
  tag_slug: string;
  tag_label: string;
  tag_category: VenueTagCategory;
  is_official: boolean;
  add_count: number;
  upvote_count: number;
  downvote_count: number;
  score: number;
}

// Tag with user vote status
export interface VenueTagWithVote extends VenueTagSummary {
  user_vote?: "up" | "down" | null;
  user_added?: boolean;
}

// Inferred preferences from user behavior
export interface InferredPreference {
  id: string;
  user_id: string;
  signal_type: "category" | "venue" | "neighborhood" | "time_slot" | "producer";
  signal_value: string;
  score: number;
  interaction_count: number;
  last_interaction_at: string;
  created_at: string;
}

// Hidden events for personalization
export interface HiddenEvent {
  user_id: string;
  event_id: number;
  reason?: "not_interested" | "seen_enough" | "wrong_category" | null;
  created_at: string;
}

// Recommendation reason type (also exported from lib/search.ts)
export type RecommendationReasonType =
  | "friends_going"
  | "followed_venue"
  | "followed_producer"
  | "neighborhood"
  | "price"
  | "category"
  | "trending";

export interface RecommendationReason {
  type: RecommendationReasonType;
  label: string;
  detail?: string;
}

// Event invite types
export type EventInviteStatus = "pending" | "accepted" | "declined" | "maybe";

export interface EventInvite {
  id: string;
  event_id: number;
  inviter_id: string;
  invitee_id: string;
  note: string | null;
  status: EventInviteStatus;
  created_at: string;
  responded_at: string | null;
}

// Community Lists types
export type ListCategory =
  | "best_of"
  | "hidden_gems"
  | "date_night"
  | "with_friends"
  | "solo"
  | "budget"
  | "special_occasion";

export type ListItemType = "venue" | "event" | "producer" | "custom";

export type ListVoteType = "up" | "down";

export interface List {
  id: string;
  portal_id: string | null;
  creator_id: string;
  title: string;
  slug: string;
  description: string | null;
  category: ListCategory | null;
  is_public: boolean;
  status: "active" | "archived" | "deleted";
  created_at: string;
  updated_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  item_type: ListItemType;
  venue_id: number | null;
  event_id: number | null;
  producer_id: number | null;
  custom_name: string | null;
  custom_description: string | null;
  position: number;
  added_by: string;
  created_at: string;
}

export interface ListVote {
  id: string;
  list_id: string;
  item_id: string | null;
  user_id: string;
  vote_type: ListVoteType;
  created_at: string;
}

// List with computed counts and creator info
export interface ListWithMeta extends List {
  item_count: number;
  vote_count: number;
  creator?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// List item with associated data
export interface ListItemWithData extends ListItem {
  venue?: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    spot_type: string | null;
  } | null;
  event?: {
    id: number;
    title: string;
    start_date: string;
    venue_name: string | null;
  } | null;
  producer?: {
    id: number;
    name: string;
    slug: string;
  } | null;
  vote_count: number;
  user_vote?: ListVoteType | null;
}

// Discovery Mode Onboarding types
export type OnboardingMood = "chill" | "wild" | "social" | "culture";
export type OnboardingStep = "splash" | "mood" | "swipe" | "neighborhood" | "preview";
export type OnboardingAction = "select" | "like" | "skip" | "follow";

export interface OnboardingSwipeEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  category: string | null;
  image_url: string | null;
  is_free: boolean;
  price_min: number | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
  } | null;
  producer: {
    id: number;
    name: string;
    slug: string;
  } | null;
}

export interface OnboardingState {
  currentStep: OnboardingStep;
  mood: OnboardingMood | null;
  likedEvents: number[];
  likedEventDetails: OnboardingSwipeEvent[];
  selectedNeighborhoods: string[];
  followedProducers: number[];
}
