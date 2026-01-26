export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string
          created_at: string | null
          event_id: number | null
          id: string
          metadata: Json | null
          org_id: string | null
          target_user_id: string | null
          user_id: string
          venue_id: number | null
          visibility: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          event_id?: number | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          target_user_id?: string | null
          user_id: string
          venue_id?: number | null
          visibility?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          event_id?: number | null
          id?: string
          metadata?: Json | null
          org_id?: string | null
          target_user_id?: string | null
          user_id?: string
          venue_id?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_daily_portal: {
        Row: {
          active_users: number | null
          crawl_runs: number | null
          crawl_success_rate: number | null
          created_at: string | null
          date: string
          event_rsvps: number | null
          event_saves: number | null
          event_shares: number | null
          event_views: number | null
          events_created: number | null
          events_total: number | null
          id: string
          new_signups: number | null
          portal_id: string
          sources_active: number | null
        }
        Insert: {
          active_users?: number | null
          crawl_runs?: number | null
          crawl_success_rate?: number | null
          created_at?: string | null
          date: string
          event_rsvps?: number | null
          event_saves?: number | null
          event_shares?: number | null
          event_views?: number | null
          events_created?: number | null
          events_total?: number | null
          id?: string
          new_signups?: number | null
          portal_id: string
          sources_active?: number | null
        }
        Update: {
          active_users?: number | null
          crawl_runs?: number | null
          crawl_success_rate?: number | null
          created_at?: string | null
          date?: string
          event_rsvps?: number | null
          event_saves?: number | null
          event_shares?: number | null
          event_views?: number | null
          events_created?: number | null
          events_total?: number | null
          id?: string
          new_signups?: number | null
          portal_id?: string
          sources_active?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_daily_portal_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "analytics_daily_portal_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          portal_id: string | null
          scopes: string[] | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          portal_id?: string | null
          scopes?: string[] | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          portal_id?: string | null
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_keys_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "api_keys_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          display_order: number
          icon: string | null
          id: string
          name: string
          typical_price_max: number | null
          typical_price_min: number | null
        }
        Insert: {
          color?: string | null
          display_order: number
          icon?: string | null
          id: string
          name: string
          typical_price_max?: number | null
          typical_price_min?: number | null
        }
        Update: {
          color?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          typical_price_max?: number | null
          typical_price_min?: number | null
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          added_at: string | null
          collection_id: number
          event_id: number
          id: number
          note: string | null
          position: number | null
        }
        Insert: {
          added_at?: string | null
          collection_id: number
          event_id: number
          id?: number
          note?: string | null
          position?: number | null
        }
        Update: {
          added_at?: string | null
          collection_id?: number
          event_id?: number
          id?: number
          note?: string | null
          position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          featured_order: number | null
          id: number
          is_featured: boolean | null
          slug: string
          title: string
          updated_at: string | null
          user_id: string | null
          visibility: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          featured_order?: number | null
          id?: number
          is_featured?: boolean | null
          slug: string
          title: string
          updated_at?: string | null
          user_id?: string | null
          visibility?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          featured_order?: number | null
          id?: number
          is_featured?: boolean | null
          slug?: string
          title?: string
          updated_at?: string | null
          user_id?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      crawl_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          events_found: number | null
          events_new: number | null
          events_updated: number | null
          id: number
          source_id: number | null
          started_at: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          events_found?: number | null
          events_new?: number | null
          events_updated?: number | null
          id?: number
          source_id?: number | null
          started_at: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          events_found?: number | null
          events_new?: number | null
          events_updated?: number | null
          id?: number
          source_id?: number | null
          started_at?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "crawl_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      event_producers: {
        Row: {
          categories: string[] | null
          city: string | null
          created_at: string | null
          description: string | null
          email: string | null
          eventbrite_organizer_id: string | null
          events_per_month_avg: number | null
          events_url: string | null
          facebook: string | null
          featured: boolean | null
          from_submission: string | null
          hidden: boolean | null
          ical_url: string | null
          id: string
          instagram: string | null
          is_verified: boolean | null
          last_event_date: string | null
          logo_url: string | null
          name: string
          neighborhood: string | null
          org_type: string
          phone: string | null
          search_vector: unknown
          slug: string
          submitted_by: string | null
          total_events_tracked: number | null
          twitter: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          categories?: string[] | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          eventbrite_organizer_id?: string | null
          events_per_month_avg?: number | null
          events_url?: string | null
          facebook?: string | null
          featured?: boolean | null
          from_submission?: string | null
          hidden?: boolean | null
          ical_url?: string | null
          id: string
          instagram?: string | null
          is_verified?: boolean | null
          last_event_date?: string | null
          logo_url?: string | null
          name: string
          neighborhood?: string | null
          org_type: string
          phone?: string | null
          search_vector?: unknown
          slug: string
          submitted_by?: string | null
          total_events_tracked?: number | null
          twitter?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          categories?: string[] | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          eventbrite_organizer_id?: string | null
          events_per_month_avg?: number | null
          events_url?: string | null
          facebook?: string | null
          featured?: boolean | null
          from_submission?: string | null
          hidden?: boolean | null
          ical_url?: string | null
          id?: string
          instagram?: string | null
          is_verified?: boolean | null
          last_event_date?: string | null
          logo_url?: string | null
          name?: string
          neighborhood?: string | null
          org_type?: string
          phone?: string | null
          search_vector?: unknown
          slug?: string
          submitted_by?: string | null
          total_events_tracked?: number | null
          twitter?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_producers_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          created_at: string | null
          event_id: number
          id: string
          status: string
          updated_at: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: number
          id?: string
          status: string
          updated_at?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: number
          id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attendee_count: number | null
          canonical_event_id: number | null
          category: string | null
          category_id: string | null
          content_hash: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          extraction_confidence: number | null
          from_submission: string | null
          genres: string[] | null
          id: number
          image_url: string | null
          is_adult: boolean | null
          is_all_day: boolean | null
          is_featured: boolean | null
          is_free: boolean | null
          is_live: boolean | null
          is_recurring: boolean | null
          is_trending: boolean | null
          portal_id: string | null
          price_max: number | null
          price_min: number | null
          price_note: string | null
          producer_id: string | null
          raw_text: string | null
          recurrence_rule: string | null
          search_vector: unknown
          series_id: string | null
          source_id: number | null
          source_url: string
          start_date: string
          start_time: string | null
          subcategory: string | null
          subcategory_id: string | null
          submitted_by: string | null
          tags: string[] | null
          ticket_url: string | null
          title: string
          updated_at: string | null
          venue_id: number | null
        }
        Insert: {
          attendee_count?: number | null
          canonical_event_id?: number | null
          category?: string | null
          category_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          extraction_confidence?: number | null
          from_submission?: string | null
          genres?: string[] | null
          id?: number
          image_url?: string | null
          is_adult?: boolean | null
          is_all_day?: boolean | null
          is_featured?: boolean | null
          is_free?: boolean | null
          is_live?: boolean | null
          is_recurring?: boolean | null
          is_trending?: boolean | null
          portal_id?: string | null
          price_max?: number | null
          price_min?: number | null
          price_note?: string | null
          producer_id?: string | null
          raw_text?: string | null
          recurrence_rule?: string | null
          search_vector?: unknown
          series_id?: string | null
          source_id?: number | null
          source_url: string
          start_date: string
          start_time?: string | null
          subcategory?: string | null
          subcategory_id?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          ticket_url?: string | null
          title: string
          updated_at?: string | null
          venue_id?: number | null
        }
        Update: {
          attendee_count?: number | null
          canonical_event_id?: number | null
          category?: string | null
          category_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          extraction_confidence?: number | null
          from_submission?: string | null
          genres?: string[] | null
          id?: number
          image_url?: string | null
          is_adult?: boolean | null
          is_all_day?: boolean | null
          is_featured?: boolean | null
          is_free?: boolean | null
          is_live?: boolean | null
          is_recurring?: boolean | null
          is_trending?: boolean | null
          portal_id?: string | null
          price_max?: number | null
          price_min?: number | null
          price_note?: string | null
          producer_id?: string | null
          raw_text?: string | null
          recurrence_rule?: string | null
          search_vector?: unknown
          series_id?: string | null
          source_id?: number | null
          source_url?: string
          start_date?: string
          start_time?: string | null
          subcategory?: string | null
          subcategory_id?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          ticket_url?: string | null
          title?: string
          updated_at?: string | null
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "event_producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      festivals: {
        Row: {
          announced_2026: boolean | null
          announced_end: string | null
          announced_start: string | null
          categories: string[] | null
          created_at: string | null
          description: string | null
          free: boolean | null
          id: string
          image_url: string | null
          last_year_end: string | null
          last_year_start: string | null
          location: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          producer_id: string | null
          slug: string
          ticket_url: string | null
          typical_duration_days: number | null
          typical_month: number | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          announced_2026?: boolean | null
          announced_end?: string | null
          announced_start?: string | null
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          free?: boolean | null
          id: string
          image_url?: string | null
          last_year_end?: string | null
          last_year_start?: string | null
          location?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          producer_id?: string | null
          slug: string
          ticket_url?: string | null
          typical_duration_days?: number | null
          typical_month?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          announced_2026?: boolean | null
          announced_end?: string | null
          announced_start?: string | null
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          free?: boolean | null
          id?: string
          image_url?: string | null
          last_year_end?: string | null
          last_year_start?: string | null
          location?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          producer_id?: string | null
          slug?: string
          ticket_url?: string | null
          typical_duration_days?: number | null
          typical_month?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festivals_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "event_producers"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          followed_org_id: string | null
          followed_user_id: string | null
          followed_venue_id: number | null
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          followed_org_id?: string | null
          followed_user_id?: string | null
          followed_venue_id?: number | null
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          followed_org_id?: string | null
          followed_user_id?: string | null
          followed_venue_id?: number | null
          follower_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followed_org_id_fkey"
            columns: ["followed_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followed_user_id_fkey"
            columns: ["followed_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_followed_venue_id_fkey"
            columns: ["followed_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          id: string
          invitee_id: string
          inviter_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invitee_id: string
          inviter_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invitee_id?: string
          inviter_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genre_options: {
        Row: {
          category: string
          display_order: number | null
          genre: string
          id: number
        }
        Insert: {
          category: string
          display_order?: number | null
          genre: string
          id?: number
        }
        Update: {
          category?: string
          display_order?: number | null
          genre?: string
          id?: number
        }
        Relationships: []
      }
      hidden_events: {
        Row: {
          created_at: string | null
          event_id: number
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: number
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: number
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hidden_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
        ]
      }
      inferred_preferences: {
        Row: {
          created_at: string | null
          id: string
          interaction_count: number | null
          last_interaction_at: string | null
          score: number | null
          signal_type: string
          signal_value: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          score?: number | null
          signal_type: string
          signal_value: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          score?: number | null
          signal_type?: string
          signal_value?: string
          user_id?: string
        }
        Relationships: []
      }
      list_items: {
        Row: {
          added_by: string | null
          created_at: string | null
          custom_description: string | null
          custom_name: string | null
          event_id: number | null
          id: string
          item_type: string
          list_id: string
          position: number | null
          producer_id: string | null
          venue_id: number | null
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          custom_description?: string | null
          custom_name?: string | null
          event_id?: number | null
          id?: string
          item_type: string
          list_id: string
          position?: number | null
          producer_id?: string | null
          venue_id?: number | null
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          custom_description?: string | null
          custom_name?: string | null
          event_id?: number | null
          id?: string
          item_type?: string
          list_id?: string
          position?: number | null
          producer_id?: string | null
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "list_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "event_producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      list_votes: {
        Row: {
          created_at: string | null
          id: string
          item_id: string | null
          list_id: string
          user_id: string
          vote_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          list_id: string
          user_id: string
          vote_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_id?: string | null
          list_id?: string
          user_id?: string
          vote_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_votes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_votes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          category: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          id: string
          is_public: boolean | null
          portal_id: string | null
          slug: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          portal_id?: string | null
          slug: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          portal_id?: string | null
          slug?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lists_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "lists_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string | null
          event_id: number | null
          id: string
          message: string | null
          read_at: string | null
          submission_id: string | null
          type: string
          user_id: string
          venue_id: number | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string | null
          event_id?: number | null
          id?: string
          message?: string | null
          read_at?: string | null
          submission_id?: string | null
          type: string
          user_id: string
          venue_id?: number | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string | null
          event_id?: number | null
          id?: string
          message?: string | null
          read_at?: string | null
          submission_id?: string | null
          type?: string
          user_id?: string
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          id: string
          name: string
          plan: string | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          name: string
          plan?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          name?: string
          plan?: string | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      portal_content: {
        Row: {
          content: Json | null
          content_type: string
          created_at: string | null
          display_order: number | null
          entity_id: number | null
          entity_type: string | null
          id: string
          is_pinned: boolean | null
          portal_id: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          content?: Json | null
          content_type: string
          created_at?: string | null
          display_order?: number | null
          entity_id?: number | null
          entity_type?: string | null
          id?: string
          is_pinned?: boolean | null
          portal_id: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          content?: Json | null
          content_type?: string
          created_at?: string | null
          display_order?: number | null
          entity_id?: number | null
          entity_type?: string | null
          id?: string
          is_pinned?: boolean | null
          portal_id?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_content_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_content_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_members: {
        Row: {
          created_at: string | null
          id: string
          portal_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          portal_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          portal_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_members_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_members_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_section_items: {
        Row: {
          created_at: string | null
          display_order: number | null
          entity_id: number
          entity_type: string
          id: string
          note: string | null
          section_id: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          entity_id: number
          entity_type: string
          id?: string
          note?: string | null
          section_id: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          entity_id?: number
          entity_type?: string
          id?: string
          note?: string | null
          section_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_section_items_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "portal_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_sections: {
        Row: {
          auto_filter: Json | null
          block_content: Json | null
          block_type: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_visible: boolean | null
          items_per_row: number | null
          layout: string | null
          max_items: number | null
          portal_id: string
          schedule_end: string | null
          schedule_start: string | null
          section_type: string
          show_after_time: string | null
          show_before_time: string | null
          show_on_days: string[] | null
          slug: string
          style: Json | null
          title: string
        }
        Insert: {
          auto_filter?: Json | null
          block_content?: Json | null
          block_type?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_visible?: boolean | null
          items_per_row?: number | null
          layout?: string | null
          max_items?: number | null
          portal_id: string
          schedule_end?: string | null
          schedule_start?: string | null
          section_type: string
          show_after_time?: string | null
          show_before_time?: string | null
          show_on_days?: string[] | null
          slug: string
          style?: Json | null
          title: string
        }
        Update: {
          auto_filter?: Json | null
          block_content?: Json | null
          block_type?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_visible?: boolean | null
          items_per_row?: number | null
          layout?: string | null
          max_items?: number | null
          portal_id?: string
          schedule_end?: string | null
          schedule_start?: string | null
          section_type?: string
          show_after_time?: string | null
          show_before_time?: string | null
          show_on_days?: string[] | null
          slug?: string
          style?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_sections_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_sections_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portals: {
        Row: {
          branding: Json | null
          created_at: string | null
          filters: Json | null
          id: string
          name: string
          owner_id: string | null
          owner_type: string | null
          portal_type: string
          settings: Json | null
          slug: string
          status: string | null
          tagline: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          branding?: Json | null
          created_at?: string | null
          filters?: Json | null
          id?: string
          name: string
          owner_id?: string | null
          owner_type?: string | null
          portal_type: string
          settings?: Json | null
          slug: string
          status?: string | null
          tagline?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          branding?: Json | null
          created_at?: string | null
          filters?: Json | null
          id?: string
          name?: string
          owner_id?: string | null
          owner_type?: string | null
          portal_type?: string
          settings?: Json | null
          slug?: string
          status?: string | null
          tagline?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved_count: number | null
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          is_admin: boolean | null
          is_public: boolean | null
          location: string | null
          rejected_count: number | null
          submission_count: number | null
          updated_at: string | null
          username: string
          website: string | null
        }
        Insert: {
          approved_count?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          is_admin?: boolean | null
          is_public?: boolean | null
          location?: string | null
          rejected_count?: number | null
          submission_count?: number | null
          updated_at?: string | null
          username: string
          website?: string | null
        }
        Update: {
          approved_count?: number | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_public?: boolean | null
          location?: string | null
          rejected_count?: number | null
          submission_count?: number | null
          updated_at?: string | null
          username?: string
          website?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string | null
          event_id: number | null
          id: string
          note: string | null
          org_id: string | null
          user_id: string
          venue_id: number | null
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          event_id?: number | null
          id?: string
          note?: string | null
          org_id?: string | null
          user_id: string
          venue_id?: number | null
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: number | null
          id?: string
          note?: string | null
          org_id?: string | null
          user_id?: string
          venue_id?: number | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string | null
          event_id: number | null
          id: string
          user_id: string
          venue_id: number | null
        }
        Insert: {
          created_at?: string | null
          event_id?: number | null
          id?: string
          user_id: string
          venue_id?: number | null
        }
        Update: {
          created_at?: string | null
          event_id?: number | null
          id?: string
          user_id?: string
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          category: string | null
          created_at: string | null
          day_of_week: string | null
          description: string | null
          director: string | null
          frequency: string | null
          genres: string[] | null
          id: string
          image_url: string | null
          imdb_id: string | null
          is_active: boolean | null
          producer_id: string | null
          rating: string | null
          runtime_minutes: number | null
          series_type: string
          slug: string
          tags: string[] | null
          title: string
          tmdb_id: string | null
          trailer_url: string | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          day_of_week?: string | null
          description?: string | null
          director?: string | null
          frequency?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          imdb_id?: string | null
          is_active?: boolean | null
          producer_id?: string | null
          rating?: string | null
          runtime_minutes?: number | null
          series_type: string
          slug: string
          tags?: string[] | null
          title: string
          tmdb_id?: string | null
          trailer_url?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          day_of_week?: string | null
          description?: string | null
          director?: string | null
          frequency?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          imdb_id?: string | null
          is_active?: boolean | null
          producer_id?: string | null
          rating?: string | null
          runtime_minutes?: number | null
          series_type?: string
          slug?: string
          tags?: string[] | null
          title?: string
          tmdb_id?: string | null
          trailer_url?: string | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: []
      }
      source_sharing_rules: {
        Row: {
          allowed_categories: string[] | null
          created_at: string | null
          id: string
          owner_portal_id: string
          share_scope: string
          source_id: number
          updated_at: string | null
        }
        Insert: {
          allowed_categories?: string[] | null
          created_at?: string | null
          id?: string
          owner_portal_id: string
          share_scope?: string
          source_id: number
          updated_at?: string | null
        }
        Update: {
          allowed_categories?: string[] | null
          created_at?: string | null
          id?: string
          owner_portal_id?: string
          share_scope?: string
          source_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_sharing_rules_owner_portal_id_fkey"
            columns: ["owner_portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "source_sharing_rules_owner_portal_id_fkey"
            columns: ["owner_portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_sharing_rules_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "source_sharing_rules_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: true
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_subscriptions: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          source_id: number
          subscribed_categories: string[] | null
          subscriber_portal_id: string
          subscription_scope: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source_id: number
          subscribed_categories?: string[] | null
          subscriber_portal_id: string
          subscription_scope?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source_id?: number
          subscribed_categories?: string[] | null
          subscriber_portal_id?: string
          subscription_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_subscriptions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "source_subscriptions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_subscriptions_subscriber_portal_id_fkey"
            columns: ["subscriber_portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "source_subscriptions_subscriber_portal_id_fkey"
            columns: ["subscriber_portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          crawl_frequency: string | null
          created_at: string | null
          id: number
          is_active: boolean | null
          name: string
          owner_portal_id: string | null
          rollup_behavior: string | null
          slug: string
          source_type: string
          url: string
        }
        Insert: {
          crawl_frequency?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          owner_portal_id?: string | null
          rollup_behavior?: string | null
          slug: string
          source_type: string
          url: string
        }
        Update: {
          crawl_frequency?: string | null
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          owner_portal_id?: string | null
          rollup_behavior?: string | null
          slug?: string
          source_type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_owner_portal_id_fkey"
            columns: ["owner_portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "sources_owner_portal_id_fkey"
            columns: ["owner_portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          display_order: number
          id: string
          name: string
        }
        Insert: {
          category_id: string
          display_order: number
          id: string
          name: string
        }
        Update: {
          category_id?: string
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          admin_notes: string | null
          approved_event_id: number | null
          approved_producer_id: string | null
          approved_venue_id: number | null
          content_hash: string | null
          created_at: string | null
          data: Json
          duplicate_acknowledged: boolean | null
          id: string
          image_urls: string[] | null
          ip_address: unknown
          portal_id: string | null
          potential_duplicate_id: number | null
          potential_duplicate_type: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submission_type: string
          submitted_by: string
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_event_id?: number | null
          approved_producer_id?: string | null
          approved_venue_id?: number | null
          content_hash?: string | null
          created_at?: string | null
          data?: Json
          duplicate_acknowledged?: boolean | null
          id?: string
          image_urls?: string[] | null
          ip_address?: unknown
          portal_id?: string | null
          potential_duplicate_id?: number | null
          potential_duplicate_type?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submission_type: string
          submitted_by: string
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_event_id?: number | null
          approved_producer_id?: string | null
          approved_venue_id?: number | null
          content_hash?: string | null
          created_at?: string | null
          data?: Json
          duplicate_acknowledged?: boolean | null
          id?: string
          image_urls?: string[] | null
          ip_address?: unknown
          portal_id?: string | null
          potential_duplicate_id?: number | null
          potential_duplicate_type?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submission_type?: string
          submitted_by?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_approved_event_id_fkey"
            columns: ["approved_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_approved_event_id_fkey"
            columns: ["approved_event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_approved_producer_id_fkey"
            columns: ["approved_producer_id"]
            isOneToOne: false
            referencedRelation: "event_producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_approved_venue_id_fkey"
            columns: ["approved_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "submissions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string | null
          id: string
          is_muted: boolean | null
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          favorite_categories: string[] | null
          favorite_neighborhoods: string[] | null
          favorite_vibes: string[] | null
          hide_adult_content: boolean | null
          notification_settings: Json | null
          price_preference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          favorite_categories?: string[] | null
          favorite_neighborhoods?: string[] | null
          favorite_vibes?: string[] | null
          hide_adult_content?: boolean | null
          notification_settings?: Json | null
          price_preference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          favorite_categories?: string[] | null
          favorite_neighborhoods?: string[] | null
          favorite_vibes?: string[] | null
          hide_adult_content?: boolean | null
          notification_settings?: Json | null
          price_preference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_tag_definitions: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_official: boolean | null
          label: string
          slug: string
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_official?: boolean | null
          label: string
          slug: string
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_official?: boolean | null
          label?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_tag_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_tag_suggestions: {
        Row: {
          created_at: string | null
          id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          suggested_by: string
          suggested_category: string
          suggested_label: string
          venue_id: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_by: string
          suggested_category: string
          suggested_label: string
          venue_id: number
        }
        Update: {
          created_at?: string | null
          id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_by?: string
          suggested_category?: string
          suggested_label?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_tag_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_tag_suggestions_suggested_by_fkey"
            columns: ["suggested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_tag_suggestions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_tag_votes: {
        Row: {
          created_at: string | null
          id: string
          user_id: string
          venue_tag_id: string
          vote_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          user_id: string
          venue_tag_id: string
          vote_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          user_id?: string
          venue_tag_id?: string
          vote_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_tag_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_tag_votes_venue_tag_id_fkey"
            columns: ["venue_tag_id"]
            isOneToOne: false
            referencedRelation: "venue_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_tags: {
        Row: {
          added_by: string
          created_at: string | null
          id: string
          tag_id: string
          venue_id: number
        }
        Insert: {
          added_by: string
          created_at?: string | null
          id?: string
          tag_id: string
          venue_id: number
        }
        Update: {
          added_by?: string
          created_at?: string | null
          id?: string
          tag_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_tags_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "venue_tag_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "venue_tag_summary"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "venue_tags_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          active: boolean | null
          address: string | null
          aliases: string[] | null
          city: string | null
          created_at: string | null
          description: string | null
          featured: boolean | null
          from_submission: string | null
          hours: Json | null
          hours_display: string | null
          id: number
          image_url: string | null
          instagram: string | null
          is_adult: boolean | null
          lat: number | null
          lng: number | null
          name: string
          neighborhood: string | null
          price_level: number | null
          producer_id: string | null
          search_vector: unknown
          short_description: string | null
          slug: string
          spot_type: string | null
          spot_types: string[] | null
          state: string | null
          submitted_by: string | null
          typical_price_max: number | null
          typical_price_min: number | null
          venue_type: string | null
          vibes: string[] | null
          website: string | null
          zip: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          aliases?: string[] | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          from_submission?: string | null
          hours?: Json | null
          hours_display?: string | null
          id?: number
          image_url?: string | null
          instagram?: string | null
          is_adult?: boolean | null
          lat?: number | null
          lng?: number | null
          name: string
          neighborhood?: string | null
          price_level?: number | null
          producer_id?: string | null
          search_vector?: unknown
          short_description?: string | null
          slug: string
          spot_type?: string | null
          spot_types?: string[] | null
          state?: string | null
          submitted_by?: string | null
          typical_price_max?: number | null
          typical_price_min?: number | null
          venue_type?: string | null
          vibes?: string[] | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          aliases?: string[] | null
          city?: string | null
          created_at?: string | null
          description?: string | null
          featured?: boolean | null
          from_submission?: string | null
          hours?: Json | null
          hours_display?: string | null
          id?: number
          image_url?: string | null
          instagram?: string | null
          is_adult?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string
          neighborhood?: string | null
          price_level?: number | null
          producer_id?: string | null
          search_vector?: unknown
          short_description?: string | null
          slug?: string
          spot_type?: string | null
          spot_types?: string[] | null
          state?: string | null
          submitted_by?: string | null
          typical_price_max?: number | null
          typical_price_min?: number | null
          venue_type?: string | null
          vibes?: string[] | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "event_producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      events_deduplicated: {
        Row: {
          attendee_count: number | null
          canonical_event_id: number | null
          category: string | null
          category_id: string | null
          content_hash: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          end_time: string | null
          extraction_confidence: number | null
          id: number | null
          image_url: string | null
          is_all_day: boolean | null
          is_featured: boolean | null
          is_free: boolean | null
          is_live: boolean | null
          is_recurring: boolean | null
          is_trending: boolean | null
          portal_id: string | null
          price_max: number | null
          price_min: number | null
          price_note: string | null
          producer_id: string | null
          raw_text: string | null
          recurrence_rule: string | null
          source_id: number | null
          source_url: string | null
          start_date: string | null
          start_time: string | null
          subcategory: string | null
          subcategory_id: string | null
          tags: string[] | null
          ticket_url: string | null
          title: string | null
          updated_at: string | null
          venue_id: number | null
        }
        Insert: {
          attendee_count?: number | null
          canonical_event_id?: number | null
          category?: string | null
          category_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          extraction_confidence?: number | null
          id?: number | null
          image_url?: string | null
          is_all_day?: boolean | null
          is_featured?: boolean | null
          is_free?: boolean | null
          is_live?: boolean | null
          is_recurring?: boolean | null
          is_trending?: boolean | null
          portal_id?: string | null
          price_max?: number | null
          price_min?: number | null
          price_note?: string | null
          producer_id?: string | null
          raw_text?: string | null
          recurrence_rule?: string | null
          source_id?: number | null
          source_url?: string | null
          start_date?: string | null
          start_time?: string | null
          subcategory?: string | null
          subcategory_id?: string | null
          tags?: string[] | null
          ticket_url?: string | null
          title?: string | null
          updated_at?: string | null
          venue_id?: number | null
        }
        Update: {
          attendee_count?: number | null
          canonical_event_id?: number | null
          category?: string | null
          category_id?: string | null
          content_hash?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          extraction_confidence?: number | null
          id?: number | null
          image_url?: string | null
          is_all_day?: boolean | null
          is_featured?: boolean | null
          is_free?: boolean | null
          is_live?: boolean | null
          is_recurring?: boolean | null
          is_trending?: boolean | null
          portal_id?: string | null
          price_max?: number | null
          price_min?: number | null
          price_note?: string | null
          producer_id?: string | null
          raw_text?: string | null
          recurrence_rule?: string | null
          source_id?: number | null
          source_url?: string | null
          start_date?: string | null
          start_time?: string | null
          subcategory?: string | null
          subcategory_id?: string | null
          tags?: string[] | null
          ticket_url?: string | null
          title?: string | null
          updated_at?: string | null
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_canonical_event_id_fkey"
            columns: ["canonical_event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_producer_id_fkey"
            columns: ["producer_id"]
            isOneToOne: false
            referencedRelation: "event_producers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_source_access: {
        Row: {
          access_type: string | null
          accessible_categories: string[] | null
          portal_id: string | null
          source_id: number | null
          source_name: string | null
        }
        Relationships: []
      }
      search_suggestions: {
        Row: {
          frequency: number | null
          text: string | null
          type: string | null
        }
        Relationships: []
      }
      venue_tag_summary: {
        Row: {
          add_count: number | null
          downvote_count: number | null
          is_official: boolean | null
          score: number | null
          tag_category: string | null
          tag_id: string | null
          tag_label: string | null
          tag_slug: string | null
          upvote_count: number | null
          venue_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_tags_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      aggregate_daily_analytics: {
        Args: { target_date?: string }
        Returns: undefined
      }
      are_friends: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      calculate_trending_events: { Args: never; Returns: undefined }
      get_follower_count: { Args: { target_user_id: string }; Returns: number }
      get_following_count: { Args: { target_user_id: string }; Returns: number }
      get_friend_count: { Args: { target_user_id: string }; Returns: number }
      get_pending_friend_request_count: {
        Args: { target_user_id: string }
        Returns: number
      }
      get_portal_source_ids: {
        Args: { p_portal_id: string }
        Returns: {
          accessible_categories: string[]
          source_id: number
        }[]
      }
      get_search_facets: {
        Args: { p_portal_id?: string; p_query: string }
        Returns: {
          count: number
          entity_type: string
        }[]
      }
      get_similar_suggestions: {
        Args: { p_limit?: number; p_min_similarity?: number; p_query: string }
        Returns: {
          frequency: number
          similarity_score: number
          suggestion: string
          type: string
        }[]
      }
      get_spelling_suggestions: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          similarity_score: number
          suggestion: string
          type: string
        }[]
      }
      get_user_trust_score: { Args: { user_id: string }; Returns: number }
      has_pending_friend_request: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_section_visible: {
        Args: {
          p_schedule_end: string
          p_schedule_start: string
          p_show_after_time: string
          p_show_before_time: string
          p_show_on_days: string[]
        }
        Returns: boolean
      }
      is_trusted_submitter: { Args: { user_id: string }; Returns: boolean }
      normalize_event_title: { Args: { title: string }; Returns: string }
      normalize_venue_for_dedup: {
        Args: { venue_name: string }
        Returns: string
      }
      portal_can_access_event: {
        Args: {
          p_category_id: string
          p_portal_id: string
          p_source_id: number
        }
        Returns: boolean
      }
      refresh_portal_source_access: { Args: never; Returns: undefined }
      refresh_search_suggestions: { Args: never; Returns: undefined }
      search_events_ranked: {
        Args: {
          p_categories?: string[]
          p_date_filter?: string
          p_is_free?: boolean
          p_limit?: number
          p_neighborhoods?: string[]
          p_offset?: number
          p_portal_id?: string
          p_query: string
        }
        Returns: {
          category: string
          combined_score: number
          description: string
          end_date: string
          end_time: string
          id: number
          image_url: string
          is_free: boolean
          price_max: number
          price_min: number
          similarity_score: number
          source_url: string
          start_date: string
          start_time: string
          subcategory: string
          tags: string[]
          ticket_url: string
          title: string
          ts_rank: number
          venue_address: string
          venue_id: number
          venue_lat: number
          venue_lng: number
          venue_name: string
          venue_neighborhood: string
        }[]
      }
      search_producers_ranked: {
        Args: {
          p_categories?: string[]
          p_limit?: number
          p_offset?: number
          p_org_types?: string[]
          p_query: string
        }
        Returns: {
          categories: string[]
          combined_score: number
          description: string
          id: string
          instagram: string
          logo_url: string
          name: string
          neighborhood: string
          org_type: string
          similarity_score: number
          slug: string
          total_events_tracked: number
          ts_rank: number
          website: string
        }[]
      }
      search_unified: {
        Args: {
          p_limit_per_type?: number
          p_portal_id?: string
          p_query: string
          p_types?: string[]
        }
        Returns: {
          combined_score: number
          entity_id: string
          entity_type: string
          href: string
          metadata: Json
          subtitle: string
          title: string
        }[]
      }
      search_venues_ranked: {
        Args: {
          p_limit?: number
          p_neighborhoods?: string[]
          p_offset?: number
          p_query: string
          p_spot_types?: string[]
          p_vibes?: string[]
        }
        Returns: {
          address: string
          combined_score: number
          description: string
          id: number
          image_url: string
          lat: number
          lng: number
          name: string
          neighborhood: string
          short_description: string
          similarity_score: number
          slug: string
          spot_type: string
          spot_types: string[]
          ts_rank: number
          vibes: string[]
          website: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      update_live_events: { Args: never; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
