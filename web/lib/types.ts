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
          updated_at: string;
        };
        Insert: {
          user_id: string;
          favorite_categories?: string[] | null;
          favorite_neighborhoods?: string[] | null;
          favorite_vibes?: string[] | null;
          price_preference?: string | null;
          notification_settings?: Record<string, unknown>;
        };
        Update: {
          favorite_categories?: string[] | null;
          favorite_neighborhoods?: string[] | null;
          favorite_vibes?: string[] | null;
          price_preference?: string | null;
          notification_settings?: Record<string, unknown>;
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
      organizations: {
        Row: {
          id: number;
          name: string;
        };
      };
    };
  };
};
