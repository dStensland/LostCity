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
      accounts: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          created_at: string | null
          id: string
          name: string
          plan: string | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          name: string
          plan?: string | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string | null
          id?: string
          name?: string
          plan?: string | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      activities: {
        Row: {
          activity_type: string
          created_at: string | null
          event_id: number | null
          id: string
          metadata: Json | null
          org_id: string | null
          organization_id: string | null
          portal_id: string | null
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
          organization_id?: string | null
          portal_id?: string | null
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
          organization_id?: string | null
          portal_id?: string | null
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
            foreignKeyName: "activities_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "activities_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "activities_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_producer_id_fkey"
            columns: ["organization_id"]
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
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          portal_id: string | null
          target_id: number
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          portal_id?: string | null
          target_id: number
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          portal_id?: string | null
          target_id?: number
          target_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_reactions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "activity_reactions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "activity_reactions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            referencedRelation: "portal_source_entity_access"
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
            referencedRelation: "portal_source_entity_access"
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
      artists: {
        Row: {
          bio: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          deezer_id: number | null
          discipline: string
          genres: string[] | null
          hometown: string | null
          id: string
          image_url: string | null
          imdb_id: string | null
          instagram: string | null
          is_verified: boolean | null
          musicbrainz_id: string | null
          name: string
          slug: string
          spotify_id: string | null
          updated_at: string | null
          website: string | null
          wikidata_id: string | null
        }
        Insert: {
          bio?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          deezer_id?: number | null
          discipline?: string
          genres?: string[] | null
          hometown?: string | null
          id?: string
          image_url?: string | null
          imdb_id?: string | null
          instagram?: string | null
          is_verified?: boolean | null
          musicbrainz_id?: string | null
          name: string
          slug: string
          spotify_id?: string | null
          updated_at?: string | null
          website?: string | null
          wikidata_id?: string | null
        }
        Update: {
          bio?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          deezer_id?: number | null
          discipline?: string
          genres?: string[] | null
          hometown?: string | null
          id?: string
          image_url?: string | null
          imdb_id?: string | null
          instagram?: string | null
          is_verified?: boolean | null
          musicbrainz_id?: string | null
          name?: string
          slug?: string
          spotify_id?: string | null
          updated_at?: string | null
          website?: string | null
          wikidata_id?: string | null
        }
        Relationships: []
      }
      available_filters: {
        Row: {
          display_label: string
          display_order: number | null
          event_count: number | null
          filter_type: string
          filter_value: string
          id: number
          parent_value: string | null
          updated_at: string | null
        }
        Insert: {
          display_label: string
          display_order?: number | null
          event_count?: number | null
          filter_type: string
          filter_value: string
          id?: number
          parent_value?: string | null
          updated_at?: string | null
        }
        Update: {
          display_label?: string
          display_order?: number | null
          event_count?: number | null
          filter_type?: string
          filter_value?: string
          id?: number
          parent_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      best_of_case_upvotes: {
        Row: {
          case_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "best_of_case_upvotes_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "best_of_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      best_of_cases: {
        Row: {
          category_id: string
          content: string
          created_at: string
          id: string
          status: string
          updated_at: string
          upvote_count: number
          user_id: string
          venue_id: number
        }
        Insert: {
          category_id: string
          content: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          upvote_count?: number
          user_id: string
          venue_id: number
        }
        Update: {
          category_id?: string
          content?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          upvote_count?: number
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "best_of_cases_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "best_of_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "best_of_cases_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      best_of_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          portal_id: string | null
          signal_weights: Json | null
          slug: string
          sort_order: number
          updated_at: string
          venue_filter: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          portal_id?: string | null
          signal_weights?: Json | null
          slug: string
          sort_order?: number
          updated_at?: string
          venue_filter?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          portal_id?: string | null
          signal_weights?: Json | null
          slug?: string
          sort_order?: number
          updated_at?: string
          venue_filter?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "best_of_categories_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "best_of_categories_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "best_of_categories_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      best_of_contests: {
        Row: {
          accent_color: string | null
          category_id: string
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          portal_id: string
          prompt: string | null
          slug: string
          starts_at: string
          status: string
          title: string
          updated_at: string | null
          winner_announced_at: string | null
          winner_snapshot: Json | null
          winner_venue_id: number | null
        }
        Insert: {
          accent_color?: string | null
          category_id: string
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          portal_id: string
          prompt?: string | null
          slug: string
          starts_at: string
          status?: string
          title: string
          updated_at?: string | null
          winner_announced_at?: string | null
          winner_snapshot?: Json | null
          winner_venue_id?: number | null
        }
        Update: {
          accent_color?: string | null
          category_id?: string
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          portal_id?: string
          prompt?: string | null
          slug?: string
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string | null
          winner_announced_at?: string | null
          winner_snapshot?: Json | null
          winner_venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "best_of_contests_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "best_of_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "best_of_contests_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "best_of_contests_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "best_of_contests_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "best_of_contests_winner_venue_id_fkey"
            columns: ["winner_venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      best_of_nominations: {
        Row: {
          category_id: string
          created_at: string
          id: string
          status: string
          user_id: string | null
          venue_id: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string | null
          venue_id: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string | null
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "best_of_nominations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "best_of_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "best_of_nominations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      best_of_votes: {
        Row: {
          category_id: string
          created_at: string
          id: string
          user_id: string
          venue_id: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          user_id: string
          venue_id: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "best_of_votes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "best_of_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "best_of_votes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
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
      concierge_requests: {
        Row: {
          created_at: string | null
          details: string
          guest_contact: Json | null
          id: string
          party_size: number | null
          portal_id: string
          preferred_time: string | null
          request_type: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details: string
          guest_contact?: Json | null
          id?: string
          party_size?: number | null
          portal_id: string
          preferred_time?: string | null
          request_type: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string
          guest_contact?: Json | null
          id?: string
          party_size?: number | null
          portal_id?: string
          preferred_time?: string | null
          request_type?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concierge_requests_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "concierge_requests_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "concierge_requests_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_logs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          events_found: number | null
          events_new: number | null
          events_rejected: number | null
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
          events_rejected?: number | null
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
          events_rejected?: number | null
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
            referencedRelation: "portal_source_entity_access"
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
      curated_picks: {
        Row: {
          created_at: string
          event_id: number
          id: number
          period: string
          pick_date: string
          position: number
        }
        Insert: {
          created_at?: string
          event_id: number
          id?: number
          period?: string
          pick_date: string
          position?: number
        }
        Update: {
          created_at?: string
          event_id?: number
          id?: number
          period?: string
          pick_date?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "curated_picks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_picks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
        ]
      }
      curation_collaborators: {
        Row: {
          created_at: string | null
          id: string
          invited_by: string | null
          list_id: string
          role: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          list_id: string
          role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_by?: string | null
          list_id?: string
          role?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curation_collaborators_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      curation_follows: {
        Row: {
          created_at: string | null
          id: string
          list_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          list_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curation_follows_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      curation_tips: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_verified_visitor: boolean | null
          list_id: string
          list_item_id: string | null
          status: string | null
          updated_at: string | null
          upvote_count: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_verified_visitor?: boolean | null
          list_id: string
          list_item_id?: string | null
          status?: string | null
          updated_at?: string | null
          upvote_count?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_verified_visitor?: boolean | null
          list_id?: string
          list_item_id?: string | null
          status?: string | null
          updated_at?: string | null
          upvote_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curation_tips_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curation_tips_list_item_id_fkey"
            columns: ["list_item_id"]
            isOneToOne: false
            referencedRelation: "list_items"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_mentions: {
        Row: {
          article_title: string
          article_url: string
          created_at: string
          guide_name: string | null
          id: number
          is_active: boolean
          mention_type: string
          place_id: number | null
          published_at: string | null
          relevance: string
          snippet: string | null
          source_key: string
          updated_at: string
        }
        Insert: {
          article_title: string
          article_url: string
          created_at?: string
          guide_name?: string | null
          id?: number
          is_active?: boolean
          mention_type?: string
          place_id?: number | null
          published_at?: string | null
          relevance?: string
          snippet?: string | null
          source_key: string
          updated_at?: string
        }
        Update: {
          article_title?: string
          article_url?: string
          created_at?: string
          guide_name?: string | null
          id?: number
          is_active?: boolean
          mention_type?: string
          place_id?: number | null
          published_at?: string | null
          relevance?: string
          snippet?: string | null
          source_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editorial_mentions_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_search_terms: {
        Row: {
          city: string | null
          confidence: number
          created_at: string
          display_term: string
          entity_id: string
          entity_type: string
          match_term: string
          source: string
          suggestion_type: string
          term_type: string
          updated_at: string
          weight: number
        }
        Insert: {
          city?: string | null
          confidence?: number
          created_at?: string
          display_term: string
          entity_id: string
          entity_type: string
          match_term: string
          source?: string
          suggestion_type: string
          term_type: string
          updated_at?: string
          weight?: number
        }
        Update: {
          city?: string | null
          confidence?: number
          created_at?: string
          display_term?: string
          entity_id?: string
          entity_type?: string
          match_term?: string
          source?: string
          suggestion_type?: string
          term_type?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      entity_tag_votes: {
        Row: {
          created_at: string | null
          entity_id: number
          entity_type: string
          id: string
          portal_id: string | null
          tag_definition_id: string
          updated_at: string | null
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string | null
          entity_id: number
          entity_type: string
          id?: string
          portal_id?: string | null
          tag_definition_id: string
          updated_at?: string | null
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string | null
          entity_id?: number
          entity_type?: string
          id?: string
          portal_id?: string | null
          tag_definition_id?: string
          updated_at?: string | null
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "entity_tag_votes_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "entity_tag_votes_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "entity_tag_votes_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_tag_votes_tag_definition_id_fkey"
            columns: ["tag_definition_id"]
            isOneToOne: false
            referencedRelation: "entity_tag_summary"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "entity_tag_votes_tag_definition_id_fkey"
            columns: ["tag_definition_id"]
            isOneToOne: false
            referencedRelation: "tag_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entity_tag_votes_tag_definition_id_fkey"
            columns: ["tag_definition_id"]
            isOneToOne: false
            referencedRelation: "venue_tag_summary"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "entity_tag_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_artists: {
        Row: {
          artist_id: string | null
          billing_order: number | null
          created_at: string | null
          event_id: number | null
          id: number
          is_headliner: boolean | null
          name: string
          role: string | null
        }
        Insert: {
          artist_id?: string | null
          billing_order?: number | null
          created_at?: string | null
          event_id?: number | null
          id?: number
          is_headliner?: boolean | null
          name: string
          role?: string | null
        }
        Update: {
          artist_id?: string | null
          billing_order?: number | null
          created_at?: string | null
          event_id?: number | null
          id?: number
          is_headliner?: boolean | null
          name?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_artists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_artists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
        ]
      }
      event_calendar_saves: {
        Row: {
          created_at: string | null
          engagement_target: string
          event_id: number
          festival_id: string | null
          id: string
          portal_id: string | null
          program_id: string | null
          provider: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          engagement_target?: string
          event_id: number
          festival_id?: string | null
          id?: string
          portal_id?: string | null
          program_id?: string | null
          provider: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          engagement_target?: string
          event_id?: number
          festival_id?: string | null
          id?: string
          portal_id?: string | null
          program_id?: string | null
          provider?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_calendar_saves_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_calendar_saves_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_calendar_saves_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_calendar_saves_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "event_calendar_saves_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "event_calendar_saves_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_calendar_saves_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_calendar_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_channel_matches: {
        Row: {
          channel_id: string
          event_id: number
          match_reasons: Json
          matched_at: string
          matched_rule_types: string[]
          portal_id: string
        }
        Insert: {
          channel_id: string
          event_id: number
          match_reasons?: Json
          matched_at?: string
          matched_rule_types?: string[]
          portal_id: string
        }
        Update: {
          channel_id?: string
          event_id?: number
          match_reasons?: Json
          matched_at?: string
          matched_rule_types?: string[]
          portal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_channel_matches_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "interest_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_channel_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_channel_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_channel_matches_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "event_channel_matches_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "event_channel_matches_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      event_extractions: {
        Row: {
          created_at: string
          event_id: number
          extraction_confidence: number | null
          extraction_version: string | null
          field_confidence: Json | null
          field_provenance: Json | null
          raw_text: string | null
        }
        Insert: {
          created_at?: string
          event_id: number
          extraction_confidence?: number | null
          extraction_version?: string | null
          field_confidence?: Json | null
          field_provenance?: Json | null
          raw_text?: string | null
        }
        Update: {
          created_at?: string
          event_id?: number
          extraction_confidence?: number | null
          extraction_version?: string | null
          field_confidence?: Json | null
          field_provenance?: Json | null
          raw_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_extractions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_extractions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
        ]
      }
      event_images: {
        Row: {
          confidence: number | null
          created_at: string | null
          event_id: number | null
          height: number | null
          id: number
          is_primary: boolean | null
          source: string | null
          type: string | null
          url: string
          width: number | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          event_id?: number | null
          height?: number | null
          id?: number
          is_primary?: boolean | null
          source?: string | null
          type?: string | null
          url: string
          width?: number | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          event_id?: number | null
          height?: number | null
          id?: number
          is_primary?: boolean | null
          source?: string | null
          type?: string | null
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_images_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
        ]
      }
      event_links: {
        Row: {
          confidence: number | null
          created_at: string | null
          event_id: number | null
          id: number
          source: string | null
          type: string
          url: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          event_id?: number | null
          id?: number
          source?: string | null
          type: string
          url: string
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          event_id?: number | null
          id?: number
          source?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          age_max: number | null
          age_min: number | null
          age_policy: string | null
          announce_date: string | null
          attendee_count: number | null
          audience_tags: string[] | null
          blurhash: string | null
          booking_required: boolean | null
          canonical_event_id: number | null
          capacity: number | null
          category_id: string | null
          class_category: string | null
          classification_prompt_version: string | null
          content_hash: string | null
          content_kind: string
          cost_tier: string | null
          created_at: string | null
          data_quality: number | null
          derived_attributes: Json | null
          description: string | null
          doors_time: string | null
          duration: string | null
          early_bird_deadline: string | null
          end_date: string | null
          end_time: string | null
          exhibition_id: string | null
          extraction_confidence: number | null
          extraction_version: string | null
          featured_blurb: string | null
          festival_id: string | null
          field_confidence: Json | null
          field_provenance: Json | null
          film_external_genres: string[] | null
          film_identity_source: string | null
          film_imdb_id: string | null
          film_release_year: number | null
          film_title: string | null
          from_submission: string | null
          genres: string[] | null
          id: number
          image_height: number | null
          image_url: string | null
          image_width: number | null
          importance: string
          indoor_outdoor: string | null
          instructor: string | null
          is_active: boolean
          is_adult: boolean | null
          is_all_day: boolean | null
          is_class: boolean | null
          is_curator_pick: boolean
          is_featured: boolean | null
          is_feed_ready: boolean | null
          is_free: boolean | null
          is_live: boolean | null
          is_recurring: boolean | null
          is_regular_ready: boolean | null
          is_sensitive: boolean | null
          is_show: boolean
          is_tentpole: boolean | null
          is_trending: boolean | null
          legacy_category_id: string | null
          on_sale_date: string | null
          organization_id: string | null
          place_id: number | null
          portal_id: string | null
          presale_date: string | null
          price_max: number | null
          price_min: number | null
          price_note: string | null
          raw_text: string | null
          recurrence_rule: string | null
          reentry_policy: string | null
          registration_closes: string | null
          registration_opens: string | null
          registration_url: string | null
          screening_run_id: string | null
          search_vector: unknown
          sellout_risk: string | null
          series_id: string | null
          set_times_mentioned: boolean
          significance: string | null
          significance_signals: string[] | null
          skill_level: string | null
          source_id: number | null
          source_type: string | null
          source_url: string
          start_date: string
          start_time: string | null
          submitted_by: string | null
          tags: string[] | null
          ticket_status: string | null
          ticket_status_checked_at: string | null
          ticket_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          age_policy?: string | null
          announce_date?: string | null
          attendee_count?: number | null
          audience_tags?: string[] | null
          blurhash?: string | null
          booking_required?: boolean | null
          canonical_event_id?: number | null
          capacity?: number | null
          category_id?: string | null
          class_category?: string | null
          classification_prompt_version?: string | null
          content_hash?: string | null
          content_kind?: string
          cost_tier?: string | null
          created_at?: string | null
          data_quality?: number | null
          derived_attributes?: Json | null
          description?: string | null
          doors_time?: string | null
          duration?: string | null
          early_bird_deadline?: string | null
          end_date?: string | null
          end_time?: string | null
          exhibition_id?: string | null
          extraction_confidence?: number | null
          extraction_version?: string | null
          featured_blurb?: string | null
          festival_id?: string | null
          field_confidence?: Json | null
          field_provenance?: Json | null
          film_external_genres?: string[] | null
          film_identity_source?: string | null
          film_imdb_id?: string | null
          film_release_year?: number | null
          film_title?: string | null
          from_submission?: string | null
          genres?: string[] | null
          id?: number
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          importance?: string
          indoor_outdoor?: string | null
          instructor?: string | null
          is_active?: boolean
          is_adult?: boolean | null
          is_all_day?: boolean | null
          is_class?: boolean | null
          is_curator_pick?: boolean
          is_featured?: boolean | null
          is_feed_ready?: boolean | null
          is_free?: boolean | null
          is_live?: boolean | null
          is_recurring?: boolean | null
          is_regular_ready?: boolean | null
          is_sensitive?: boolean | null
          is_show?: boolean
          is_tentpole?: boolean | null
          is_trending?: boolean | null
          legacy_category_id?: string | null
          on_sale_date?: string | null
          organization_id?: string | null
          place_id?: number | null
          portal_id?: string | null
          presale_date?: string | null
          price_max?: number | null
          price_min?: number | null
          price_note?: string | null
          raw_text?: string | null
          recurrence_rule?: string | null
          reentry_policy?: string | null
          registration_closes?: string | null
          registration_opens?: string | null
          registration_url?: string | null
          screening_run_id?: string | null
          search_vector?: unknown
          sellout_risk?: string | null
          series_id?: string | null
          set_times_mentioned?: boolean
          significance?: string | null
          significance_signals?: string[] | null
          skill_level?: string | null
          source_id?: number | null
          source_type?: string | null
          source_url: string
          start_date: string
          start_time?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          ticket_status?: string | null
          ticket_status_checked_at?: string | null
          ticket_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          age_policy?: string | null
          announce_date?: string | null
          attendee_count?: number | null
          audience_tags?: string[] | null
          blurhash?: string | null
          booking_required?: boolean | null
          canonical_event_id?: number | null
          capacity?: number | null
          category_id?: string | null
          class_category?: string | null
          classification_prompt_version?: string | null
          content_hash?: string | null
          content_kind?: string
          cost_tier?: string | null
          created_at?: string | null
          data_quality?: number | null
          derived_attributes?: Json | null
          description?: string | null
          doors_time?: string | null
          duration?: string | null
          early_bird_deadline?: string | null
          end_date?: string | null
          end_time?: string | null
          exhibition_id?: string | null
          extraction_confidence?: number | null
          extraction_version?: string | null
          featured_blurb?: string | null
          festival_id?: string | null
          field_confidence?: Json | null
          field_provenance?: Json | null
          film_external_genres?: string[] | null
          film_identity_source?: string | null
          film_imdb_id?: string | null
          film_release_year?: number | null
          film_title?: string | null
          from_submission?: string | null
          genres?: string[] | null
          id?: number
          image_height?: number | null
          image_url?: string | null
          image_width?: number | null
          importance?: string
          indoor_outdoor?: string | null
          instructor?: string | null
          is_active?: boolean
          is_adult?: boolean | null
          is_all_day?: boolean | null
          is_class?: boolean | null
          is_curator_pick?: boolean
          is_featured?: boolean | null
          is_feed_ready?: boolean | null
          is_free?: boolean | null
          is_live?: boolean | null
          is_recurring?: boolean | null
          is_regular_ready?: boolean | null
          is_sensitive?: boolean | null
          is_show?: boolean
          is_tentpole?: boolean | null
          is_trending?: boolean | null
          legacy_category_id?: string | null
          on_sale_date?: string | null
          organization_id?: string | null
          place_id?: number | null
          portal_id?: string | null
          presale_date?: string | null
          price_max?: number | null
          price_min?: number | null
          price_note?: string | null
          raw_text?: string | null
          recurrence_rule?: string | null
          reentry_policy?: string | null
          registration_closes?: string | null
          registration_opens?: string | null
          registration_url?: string | null
          screening_run_id?: string | null
          search_vector?: unknown
          sellout_risk?: string | null
          series_id?: string | null
          set_times_mentioned?: boolean
          significance?: string | null
          significance_signals?: string[] | null
          skill_level?: string | null
          source_id?: number | null
          source_type?: string | null
          source_url?: string
          start_date?: string
          start_time?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          ticket_status?: string | null
          ticket_status_checked_at?: string | null
          ticket_url?: string | null
          title?: string
          updated_at?: string | null
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
            foreignKeyName: "events_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
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
            referencedRelation: "portal_source_entity_access"
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
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_screening_run_id_fkey"
            columns: ["screening_run_id"]
            isOneToOne: false
            referencedRelation: "screening_runs"
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
            referencedRelation: "portal_source_entity_access"
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
            foreignKeyName: "events_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_artists: {
        Row: {
          artist_id: string | null
          artist_name: string
          artist_url: string | null
          exhibition_id: string
          role: string | null
        }
        Insert: {
          artist_id?: string | null
          artist_name: string
          artist_url?: string | null
          exhibition_id: string
          role?: string | null
        }
        Update: {
          artist_id?: string | null
          artist_name?: string
          artist_url?: string | null
          exhibition_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artists_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibitions: {
        Row: {
          admission_type: string | null
          admission_url: string | null
          closing_date: string | null
          created_at: string
          description: string | null
          exhibition_type: string | null
          id: string
          image_url: string | null
          is_active: boolean
          medium: string | null
          metadata: Json
          opening_date: string | null
          operating_schedule: Json | null
          place_id: number
          portal_id: string | null
          related_feature_id: number | null
          search_vector: unknown
          slug: string
          source_id: number | null
          source_url: string | null
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          admission_type?: string | null
          admission_url?: string | null
          closing_date?: string | null
          created_at?: string
          description?: string | null
          exhibition_type?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          medium?: string | null
          metadata?: Json
          opening_date?: string | null
          operating_schedule?: Json | null
          place_id: number
          portal_id?: string | null
          related_feature_id?: number | null
          search_vector?: unknown
          slug: string
          source_id?: number | null
          source_url?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          admission_type?: string | null
          admission_url?: string | null
          closing_date?: string | null
          created_at?: string
          description?: string | null
          exhibition_type?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          medium?: string | null
          metadata?: Json
          opening_date?: string | null
          operating_schedule?: Json | null
          place_id?: number
          portal_id?: string | null
          related_feature_id?: number | null
          search_vector?: unknown
          slug?: string
          source_id?: number | null
          source_url?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibitions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "exhibitions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "exhibitions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitions_related_feature_id_fkey"
            columns: ["related_feature_id"]
            isOneToOne: false
            referencedRelation: "venue_features"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "exhibitions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "exhibitions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibitions_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      explore_flags: {
        Row: {
          created_at: string | null
          id: string
          reason: string
          tip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          reason: string
          tip_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          reason?: string
          tip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "explore_flags_tip_id_fkey"
            columns: ["tip_id"]
            isOneToOne: false
            referencedRelation: "explore_tips"
            referencedColumns: ["id"]
          },
        ]
      }
      explore_tips: {
        Row: {
          content: string
          created_at: string | null
          flag_count: number | null
          id: string
          is_verified_visitor: boolean | null
          status: string | null
          track_id: string | null
          updated_at: string | null
          upvote_count: number | null
          user_id: string
          venue_id: number
        }
        Insert: {
          content: string
          created_at?: string | null
          flag_count?: number | null
          id?: string
          is_verified_visitor?: boolean | null
          status?: string | null
          track_id?: string | null
          updated_at?: string | null
          upvote_count?: number | null
          user_id: string
          venue_id: number
        }
        Update: {
          content?: string
          created_at?: string | null
          flag_count?: number | null
          id?: string
          is_verified_visitor?: boolean | null
          status?: string | null
          track_id?: string | null
          updated_at?: string | null
          upvote_count?: number | null
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "explore_tips_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "explore_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explore_tips_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      explore_track_venues: {
        Row: {
          added_by: string | null
          created_at: string | null
          editorial_blurb: string | null
          id: string
          is_featured: boolean | null
          sort_order: number | null
          source_label: string | null
          source_url: string | null
          status: string | null
          track_id: string
          updated_at: string | null
          upvote_count: number | null
          venue_id: number
        }
        Insert: {
          added_by?: string | null
          created_at?: string | null
          editorial_blurb?: string | null
          id?: string
          is_featured?: boolean | null
          sort_order?: number | null
          source_label?: string | null
          source_url?: string | null
          status?: string | null
          track_id: string
          updated_at?: string | null
          upvote_count?: number | null
          venue_id: number
        }
        Update: {
          added_by?: string | null
          created_at?: string | null
          editorial_blurb?: string | null
          id?: string
          is_featured?: boolean | null
          sort_order?: number | null
          source_label?: string | null
          source_url?: string | null
          status?: string | null
          track_id?: string
          updated_at?: string | null
          upvote_count?: number | null
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "explore_track_venues_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "explore_tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explore_track_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      explore_tracks: {
        Row: {
          accent_color: string | null
          banner_image_url: string | null
          category: string | null
          created_at: string | null
          description: string | null
          group_name: string | null
          id: string
          is_active: boolean | null
          name: string
          quote: string
          quote_portrait_url: string | null
          quote_source: string
          slug: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          banner_image_url?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          quote: string
          quote_portrait_url?: string | null
          quote_source: string
          slug: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          banner_image_url?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          group_name?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          quote?: string
          quote_portrait_url?: string | null
          quote_source?: string
          slug?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      explore_upvotes: {
        Row: {
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      feed_category_counts: {
        Row: {
          cnt: number
          dimension: string
          portal_id: string
          updated_at: string
          value: string
          window: string
        }
        Insert: {
          cnt?: number
          dimension: string
          portal_id: string
          updated_at?: string
          value: string
          window: string
        }
        Update: {
          cnt?: number
          dimension?: string
          portal_id?: string
          updated_at?: string
          value?: string
          window?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_category_counts_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "feed_category_counts_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "feed_category_counts_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_events_ready: {
        Row: {
          attendee_count: number | null
          audience_tags: string[] | null
          category: string | null
          cost_tier: string | null
          data_quality: number | null
          duration: string | null
          early_bird_deadline: string | null
          end_date: string | null
          end_time: string | null
          event_id: number
          featured_blurb: string | null
          festival_id: string | null
          genres: string[] | null
          image_url: string | null
          importance: string | null
          is_all_day: boolean | null
          is_featured: boolean | null
          is_free: boolean | null
          is_recurring: boolean | null
          is_tentpole: boolean | null
          on_sale_date: string | null
          organization_id: string | null
          place_active: boolean | null
          place_city: string | null
          place_id: number | null
          place_image_url: string | null
          place_name: string | null
          place_neighborhood: string | null
          place_slug: string | null
          place_type: string | null
          portal_id: string
          presale_date: string | null
          price_max: number | null
          price_min: number | null
          refreshed_at: string
          sellout_risk: string | null
          series_id: string | null
          series_name: string | null
          series_slug: string | null
          series_type: string | null
          significance: string | null
          source_id: number | null
          start_date: string
          start_time: string | null
          tags: string[] | null
          title: string | null
        }
        Insert: {
          attendee_count?: number | null
          audience_tags?: string[] | null
          category?: string | null
          cost_tier?: string | null
          data_quality?: number | null
          duration?: string | null
          early_bird_deadline?: string | null
          end_date?: string | null
          end_time?: string | null
          event_id: number
          featured_blurb?: string | null
          festival_id?: string | null
          genres?: string[] | null
          image_url?: string | null
          importance?: string | null
          is_all_day?: boolean | null
          is_featured?: boolean | null
          is_free?: boolean | null
          is_recurring?: boolean | null
          is_tentpole?: boolean | null
          on_sale_date?: string | null
          organization_id?: string | null
          place_active?: boolean | null
          place_city?: string | null
          place_id?: number | null
          place_image_url?: string | null
          place_name?: string | null
          place_neighborhood?: string | null
          place_slug?: string | null
          place_type?: string | null
          portal_id: string
          presale_date?: string | null
          price_max?: number | null
          price_min?: number | null
          refreshed_at?: string
          sellout_risk?: string | null
          series_id?: string | null
          series_name?: string | null
          series_slug?: string | null
          series_type?: string | null
          significance?: string | null
          source_id?: number | null
          start_date: string
          start_time?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Update: {
          attendee_count?: number | null
          audience_tags?: string[] | null
          category?: string | null
          cost_tier?: string | null
          data_quality?: number | null
          duration?: string | null
          early_bird_deadline?: string | null
          end_date?: string | null
          end_time?: string | null
          event_id?: number
          featured_blurb?: string | null
          festival_id?: string | null
          genres?: string[] | null
          image_url?: string | null
          importance?: string | null
          is_all_day?: boolean | null
          is_featured?: boolean | null
          is_free?: boolean | null
          is_recurring?: boolean | null
          is_tentpole?: boolean | null
          on_sale_date?: string | null
          organization_id?: string | null
          place_active?: boolean | null
          place_city?: string | null
          place_id?: number | null
          place_image_url?: string | null
          place_name?: string | null
          place_neighborhood?: string | null
          place_slug?: string | null
          place_type?: string | null
          portal_id?: string
          presale_date?: string | null
          price_max?: number | null
          price_min?: number | null
          refreshed_at?: string
          sellout_risk?: string | null
          series_id?: string | null
          series_name?: string | null
          series_slug?: string | null
          series_type?: string | null
          significance?: string | null
          source_id?: number | null
          start_date?: string
          start_time?: string | null
          tags?: string[] | null
          title?: string | null
        }
        Relationships: []
      }
      festivals: {
        Row: {
          announced_2026: boolean | null
          announced_end: string | null
          announced_start: string | null
          audience: string | null
          categories: string[] | null
          created_at: string | null
          data_quality: number | null
          date_confidence: number | null
          date_source: string | null
          description: string | null
          experience_tags: string[] | null
          festival_type: string | null
          free: boolean | null
          genres: string[] | null
          id: string
          image_url: string | null
          indoor_outdoor: string | null
          last_year_end: string | null
          last_year_start: string | null
          location: string | null
          name: string
          neighborhood: string | null
          notes: string | null
          organization_id: string | null
          pending_end: string | null
          pending_start: string | null
          portal_id: string | null
          price_tier: string | null
          primary_type: string | null
          size_tier: string | null
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
          audience?: string | null
          categories?: string[] | null
          created_at?: string | null
          data_quality?: number | null
          date_confidence?: number | null
          date_source?: string | null
          description?: string | null
          experience_tags?: string[] | null
          festival_type?: string | null
          free?: boolean | null
          genres?: string[] | null
          id: string
          image_url?: string | null
          indoor_outdoor?: string | null
          last_year_end?: string | null
          last_year_start?: string | null
          location?: string | null
          name: string
          neighborhood?: string | null
          notes?: string | null
          organization_id?: string | null
          pending_end?: string | null
          pending_start?: string | null
          portal_id?: string | null
          price_tier?: string | null
          primary_type?: string | null
          size_tier?: string | null
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
          audience?: string | null
          categories?: string[] | null
          created_at?: string | null
          data_quality?: number | null
          date_confidence?: number | null
          date_source?: string | null
          description?: string | null
          experience_tags?: string[] | null
          festival_type?: string | null
          free?: boolean | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          indoor_outdoor?: string | null
          last_year_end?: string | null
          last_year_start?: string | null
          location?: string | null
          name?: string
          neighborhood?: string | null
          notes?: string | null
          organization_id?: string | null
          pending_end?: string | null
          pending_start?: string | null
          portal_id?: string | null
          price_tier?: string | null
          primary_type?: string | null
          size_tier?: string | null
          slug?: string
          ticket_url?: string | null
          typical_duration_days?: number | null
          typical_month?: number | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "festivals_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "festivals_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "festivals_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "festivals_producer_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flags: {
        Row: {
          created_at: string
          entity_id: number
          entity_type: string
          id: number
          message: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id: number
          entity_type: string
          id?: never
          message: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: number
          entity_type?: string
          id?: never
          message?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string | null
          followed_org_id: string | null
          followed_organization_id: string | null
          followed_user_id: string | null
          followed_venue_id: number | null
          follower_id: string
          id: string
          portal_id: string | null
        }
        Insert: {
          created_at?: string | null
          followed_org_id?: string | null
          followed_organization_id?: string | null
          followed_user_id?: string | null
          followed_venue_id?: number | null
          follower_id: string
          id?: string
          portal_id?: string | null
        }
        Update: {
          created_at?: string | null
          followed_org_id?: string | null
          followed_organization_id?: string | null
          followed_user_id?: string | null
          followed_venue_id?: number | null
          follower_id?: string
          id?: string
          portal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follows_followed_producer_id_fkey"
            columns: ["followed_organization_id"]
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
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "follows_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "follows_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
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
      friendships: {
        Row: {
          created_at: string
          id: string
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a_id: string
          user_b_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_a_id_fkey"
            columns: ["user_a_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_b_id_fkey"
            columns: ["user_b_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_list_movies: {
        Row: {
          added_at: string
          list_id: number
          movie_id: number
          note: string | null
          section: string | null
          section_sort: number | null
          sort_order: number | null
        }
        Insert: {
          added_at?: string
          list_id: number
          movie_id: number
          note?: string | null
          section?: string | null
          section_sort?: number | null
          sort_order?: number | null
        }
        Update: {
          added_at?: string
          list_id?: number
          movie_id?: number
          note?: string | null
          section?: string | null
          section_sort?: number | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "goblin_list_movies_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "goblin_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goblin_list_movies_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "goblin_movies"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_lists: {
        Row: {
          created_at: string
          description: string | null
          id: number
          is_recommendations: boolean
          name: string
          slug: string | null
          sort_order: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          is_recommendations?: boolean
          name: string
          slug?: string | null
          sort_order?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          is_recommendations?: boolean
          name?: string
          slug?: string | null
          sort_order?: number | null
          user_id?: string
        }
        Relationships: []
      }
      goblin_log_entries: {
        Row: {
          created_at: string | null
          id: number
          list_id: number | null
          movie_id: number
          note: string | null
          sort_order: number | null
          tier_color: string | null
          tier_name: string | null
          updated_at: string | null
          user_id: string
          watched_date: string
          watched_with: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          list_id?: number | null
          movie_id: number
          note?: string | null
          sort_order?: number | null
          tier_color?: string | null
          tier_name?: string | null
          updated_at?: string | null
          user_id: string
          watched_date: string
          watched_with?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          list_id?: number | null
          movie_id?: number
          note?: string | null
          sort_order?: number | null
          tier_color?: string | null
          tier_name?: string | null
          updated_at?: string | null
          user_id?: string
          watched_date?: string
          watched_with?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goblin_log_entries_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "goblin_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goblin_log_entries_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "goblin_movies"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_log_entry_tags: {
        Row: {
          entry_id: number
          tag_id: number
        }
        Insert: {
          entry_id: number
          tag_id: number
        }
        Update: {
          entry_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "goblin_log_entry_tags_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "goblin_log_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goblin_log_entry_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "goblin_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_movies: {
        Row: {
          ashley_list: boolean
          backdrop_path: string | null
          created_at: string
          daniel_list: boolean
          director: string | null
          genres: Json | null
          id: number
          imdb_id: string | null
          keywords: Json | null
          mpaa_rating: string | null
          poster_path: string | null
          proposed: boolean
          release_date: string | null
          rt_audience_score: number | null
          rt_critics_score: number | null
          runtime_minutes: number | null
          streaming_info: Json | null
          synopsis: string | null
          title: string
          tmdb_id: number | null
          tmdb_popularity: number | null
          tmdb_vote_average: number | null
          tmdb_vote_count: number | null
          trailer_url: string | null
          updated_at: string
          watched: boolean
          year: number | null
        }
        Insert: {
          ashley_list?: boolean
          backdrop_path?: string | null
          created_at?: string
          daniel_list?: boolean
          director?: string | null
          genres?: Json | null
          id?: number
          imdb_id?: string | null
          keywords?: Json | null
          mpaa_rating?: string | null
          poster_path?: string | null
          proposed?: boolean
          release_date?: string | null
          rt_audience_score?: number | null
          rt_critics_score?: number | null
          runtime_minutes?: number | null
          streaming_info?: Json | null
          synopsis?: string | null
          title: string
          tmdb_id?: number | null
          tmdb_popularity?: number | null
          tmdb_vote_average?: number | null
          tmdb_vote_count?: number | null
          trailer_url?: string | null
          updated_at?: string
          watched?: boolean
          year?: number | null
        }
        Update: {
          ashley_list?: boolean
          backdrop_path?: string | null
          created_at?: string
          daniel_list?: boolean
          director?: string | null
          genres?: Json | null
          id?: number
          imdb_id?: string | null
          keywords?: Json | null
          mpaa_rating?: string | null
          poster_path?: string | null
          proposed?: boolean
          release_date?: string | null
          rt_audience_score?: number | null
          rt_critics_score?: number | null
          runtime_minutes?: number | null
          streaming_info?: Json | null
          synopsis?: string | null
          title?: string
          tmdb_id?: number | null
          tmdb_popularity?: number | null
          tmdb_vote_average?: number | null
          tmdb_vote_count?: number | null
          trailer_url?: string | null
          updated_at?: string
          watched?: boolean
          year?: number | null
        }
        Relationships: []
      }
      goblin_ranking_categories: {
        Row: {
          created_at: string | null
          description: string | null
          game_id: number
          id: number
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          game_id: number
          id?: number
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          game_id?: number
          id?: number
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "goblin_ranking_categories_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "goblin_ranking_games"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_ranking_entries: {
        Row: {
          created_at: string | null
          id: number
          item_id: number
          sort_order: number
          tier_color: string | null
          tier_name: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          item_id: number
          sort_order: number
          tier_color?: string | null
          tier_name?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          item_id?: number
          sort_order?: number
          tier_color?: string | null
          tier_name?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goblin_ranking_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "goblin_ranking_items"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_ranking_games: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          image_url: string | null
          name: string
          status: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: number
          image_url?: string | null
          name: string
          status?: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          image_url?: string | null
          name?: string
          status?: string
        }
        Relationships: []
      }
      goblin_ranking_items: {
        Row: {
          category_id: number
          created_at: string | null
          description: string | null
          id: number
          image_url: string | null
          name: string
          subtitle: string | null
        }
        Insert: {
          category_id: number
          created_at?: string | null
          description?: string | null
          id?: number
          image_url?: string | null
          name: string
          subtitle?: string | null
        }
        Update: {
          category_id?: number
          created_at?: string | null
          description?: string | null
          id?: number
          image_url?: string | null
          name?: string
          subtitle?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goblin_ranking_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "goblin_ranking_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_session_members: {
        Row: {
          id: number
          joined_at: string
          role: string
          session_id: number
          user_id: string
        }
        Insert: {
          id?: number
          joined_at?: string
          role: string
          session_id: number
          user_id: string
        }
        Update: {
          id?: number
          joined_at?: string
          role?: string
          session_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goblin_session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "goblin_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_session_movies: {
        Row: {
          added_at: string
          dnf: boolean
          id: number
          movie_id: number
          proposed_by: string | null
          session_id: number
          watch_order: number
        }
        Insert: {
          added_at?: string
          dnf?: boolean
          id?: number
          movie_id: number
          proposed_by?: string | null
          session_id: number
          watch_order: number
        }
        Update: {
          added_at?: string
          dnf?: boolean
          id?: number
          movie_id?: number
          proposed_by?: string | null
          session_id?: number
          watch_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "goblin_session_movies_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "goblin_movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goblin_session_movies_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "goblin_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          guest_names: string[] | null
          id: number
          invite_code: string
          name: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date?: string
          guest_names?: string[] | null
          id?: number
          invite_code: string
          name?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          guest_names?: string[] | null
          id?: number
          invite_code?: string
          name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      goblin_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: number
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: number
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      goblin_theme_movies: {
        Row: {
          checked_at: string
          checked_by: string
          movie_id: number
          theme_id: number
        }
        Insert: {
          checked_at?: string
          checked_by: string
          movie_id: number
          theme_id: number
        }
        Update: {
          checked_at?: string
          checked_by?: string
          movie_id?: number
          theme_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "goblin_theme_movies_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "goblin_movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goblin_theme_movies_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "goblin_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_themes: {
        Row: {
          canceled_at: string | null
          created_at: string
          created_by: string | null
          id: number
          label: string
          session_id: number
          status: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          label: string
          session_id: number
          status?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: number
          label?: string
          session_id?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "goblin_themes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "goblin_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_timeline: {
        Row: {
          created_at: string
          event_type: string
          id: number
          movie_id: number | null
          session_id: number
          theme_id: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: number
          movie_id?: number | null
          session_id: number
          theme_id?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: number
          movie_id?: number | null
          session_id?: number
          theme_id?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goblin_timeline_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "goblin_movies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goblin_timeline_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "goblin_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goblin_timeline_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "goblin_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_user_movies: {
        Row: {
          bookmarked: boolean
          created_at: string
          movie_id: number
          user_id: string
          watched: boolean
        }
        Insert: {
          bookmarked?: boolean
          created_at?: string
          movie_id: number
          user_id: string
          watched?: boolean
        }
        Update: {
          bookmarked?: boolean
          created_at?: string
          movie_id?: number
          user_id?: string
          watched?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "goblin_user_movies_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "goblin_movies"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_watchlist_entries: {
        Row: {
          added_at: string | null
          id: number
          movie_id: number
          note: string | null
          sort_order: number | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          id?: number
          movie_id: number
          note?: string | null
          sort_order?: number | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          id?: number
          movie_id?: number
          note?: string | null
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goblin_watchlist_entries_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "goblin_movies"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_watchlist_entry_tags: {
        Row: {
          entry_id: number
          tag_id: number
        }
        Insert: {
          entry_id: number
          tag_id: number
        }
        Update: {
          entry_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "goblin_watchlist_entry_tags_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "goblin_watchlist_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goblin_watchlist_entry_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "goblin_watchlist_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_watchlist_recommendations: {
        Row: {
          created_at: string | null
          id: number
          list_id: number | null
          movie_id: number
          note: string | null
          recommender_name: string
          recommender_user_id: string | null
          status: string
          target_user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          list_id?: number | null
          movie_id: number
          note?: string | null
          recommender_name: string
          recommender_user_id?: string | null
          status?: string
          target_user_id: string
        }
        Update: {
          created_at?: string | null
          id?: number
          list_id?: number | null
          movie_id?: number
          note?: string | null
          recommender_name?: string
          recommender_user_id?: string | null
          status?: string
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goblin_watchlist_recommendations_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "goblin_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goblin_watchlist_recommendations_movie_id_fkey"
            columns: ["movie_id"]
            isOneToOne: false
            referencedRelation: "goblin_movies"
            referencedColumns: ["id"]
          },
        ]
      }
      goblin_watchlist_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: number
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: number
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: number
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      group_join_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          group_id: string
          id: string
          message: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id: string
          id?: string
          message?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          group_id?: string
          id?: string
          message?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_join_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          invited_by: string | null
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          invited_by?: string | null
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_spots: {
        Row: {
          added_at: string
          added_by: string
          group_id: string
          id: string
          note: string | null
          venue_id: number
        }
        Insert: {
          added_at?: string
          added_by: string
          group_id: string
          id?: string
          note?: string | null
          venue_id: number
        }
        Update: {
          added_at?: string
          added_by?: string
          group_id?: string
          id?: string
          note?: string | null
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_spots_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_spots_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_spots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          creator_id: string
          description: string | null
          emoji: string | null
          id: string
          invite_code: string
          join_policy: string
          max_members: number
          name: string
          updated_at: string
          visibility: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          emoji?: string | null
          id?: string
          invite_code?: string
          join_policy?: string
          max_members?: number
          name: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          emoji?: string | null
          id?: string
          invite_code?: string
          join_policy?: string
          max_members?: number
          name?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_events: {
        Row: {
          created_at: string | null
          event_id: number
          portal_id: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: number
          portal_id?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: number
          portal_id?: string | null
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
          {
            foreignKeyName: "hidden_events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "hidden_events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "hidden_events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
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
          portal_id: string | null
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
          portal_id?: string | null
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
          portal_id?: string | null
          score?: number | null
          signal_type?: string
          signal_value?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inferred_preferences_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "inferred_preferences_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "inferred_preferences_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_channel_rules: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          is_active: boolean
          priority: number
          rule_payload: Json
          rule_type: string
          updated_at: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          rule_payload?: Json
          rule_type: string
          updated_at?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          priority?: number
          rule_payload?: Json
          rule_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interest_channel_rules_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "interest_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_channels: {
        Row: {
          channel_type: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean
          metadata: Json | null
          name: string
          portal_id: string | null
          slug: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          channel_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name: string
          portal_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          channel_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json | null
          name?: string
          portal_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interest_channels_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "interest_channels_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "interest_channels_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      list_items: {
        Row: {
          added_by: string | null
          blurb: string | null
          created_at: string | null
          custom_description: string | null
          custom_name: string | null
          event_id: number | null
          id: string
          item_type: string
          list_id: string
          organization_id: string | null
          position: number | null
          status: string | null
          submitted_by: string | null
          upvote_count: number | null
          venue_id: number | null
        }
        Insert: {
          added_by?: string | null
          blurb?: string | null
          created_at?: string | null
          custom_description?: string | null
          custom_name?: string | null
          event_id?: number | null
          id?: string
          item_type: string
          list_id: string
          organization_id?: string | null
          position?: number | null
          status?: string | null
          submitted_by?: string | null
          upvote_count?: number | null
          venue_id?: number | null
        }
        Update: {
          added_by?: string | null
          blurb?: string | null
          created_at?: string | null
          custom_description?: string | null
          custom_name?: string | null
          event_id?: number | null
          id?: string
          item_type?: string
          list_id?: string
          organization_id?: string | null
          position?: number | null
          status?: string | null
          submitted_by?: string | null
          upvote_count?: number | null
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
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
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
          accent_color: string | null
          allow_contributions: boolean | null
          category: string | null
          cover_image_url: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          follower_count: number | null
          id: string
          is_pinned: boolean | null
          is_public: boolean | null
          owner_type: string | null
          portal_id: string | null
          slug: string
          status: string | null
          submission_mode: string | null
          title: string
          updated_at: string | null
          upvote_count: number | null
          vibe_tags: string[] | null
        }
        Insert: {
          accent_color?: string | null
          allow_contributions?: boolean | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          follower_count?: number | null
          id?: string
          is_pinned?: boolean | null
          is_public?: boolean | null
          owner_type?: string | null
          portal_id?: string | null
          slug: string
          status?: string | null
          submission_mode?: string | null
          title: string
          updated_at?: string | null
          upvote_count?: number | null
          vibe_tags?: string[] | null
        }
        Update: {
          accent_color?: string | null
          allow_contributions?: boolean | null
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          follower_count?: number | null
          id?: string
          is_pinned?: boolean | null
          is_public?: boolean | null
          owner_type?: string | null
          portal_id?: string | null
          slug?: string
          status?: string | null
          submission_mode?: string | null
          title?: string
          updated_at?: string | null
          upvote_count?: number | null
          vibe_tags?: string[] | null
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
            referencedRelation: "portal_source_entity_access"
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
      network_posts: {
        Row: {
          author: string | null
          categories: string[] | null
          created_at: string | null
          guid: string | null
          id: number
          image_url: string | null
          portal_id: string
          published_at: string | null
          raw_description: string | null
          source_id: number
          summary: string | null
          tags: string[] | null
          title: string
          url: string
        }
        Insert: {
          author?: string | null
          categories?: string[] | null
          created_at?: string | null
          guid?: string | null
          id?: number
          image_url?: string | null
          portal_id: string
          published_at?: string | null
          raw_description?: string | null
          source_id: number
          summary?: string | null
          tags?: string[] | null
          title: string
          url: string
        }
        Update: {
          author?: string | null
          categories?: string[] | null
          created_at?: string | null
          guid?: string | null
          id?: number
          image_url?: string | null
          portal_id?: string
          published_at?: string | null
          raw_description?: string | null
          source_id?: number
          summary?: string | null
          tags?: string[] | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_posts_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "network_posts_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "network_posts_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_posts_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "network_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      network_sources: {
        Row: {
          categories: string[] | null
          created_at: string | null
          description: string | null
          feed_url: string
          fetch_error: string | null
          id: number
          is_active: boolean | null
          last_fetched_at: string | null
          logo_url: string | null
          name: string
          portal_id: string
          slug: string
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          feed_url: string
          fetch_error?: string | null
          id?: number
          is_active?: boolean | null
          last_fetched_at?: string | null
          logo_url?: string | null
          name: string
          portal_id: string
          slug: string
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          categories?: string[] | null
          created_at?: string | null
          description?: string | null
          feed_url?: string
          fetch_error?: string | null
          id?: number
          is_active?: boolean | null
          last_fetched_at?: string | null
          logo_url?: string | null
          name?: string
          portal_id?: string
          slug?: string
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_sources_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "network_sources_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "network_sources_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          email: string
          metadata: Json | null
          portal_id: string | null
          source: string | null
          subscribed_at: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          email: string
          metadata?: Json | null
          portal_id?: string | null
          source?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          email?: string
          metadata?: Json | null
          portal_id?: string | null
          source?: string | null
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_subscribers_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "newsletter_subscribers_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "newsletter_subscribers_portal_id_fkey"
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
          itinerary_id: string | null
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
          itinerary_id?: string | null
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
          itinerary_id?: string | null
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
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      open_calls: {
        Row: {
          application_url: string
          call_type: string
          confidence_tier: string | null
          created_at: string
          deadline: string | null
          description: string | null
          eligibility: string | null
          fee: number | null
          id: string
          is_active: boolean
          medium_requirements: string[] | null
          metadata: Json
          organization_id: string | null
          place_id: number | null
          portal_id: string | null
          slug: string
          source_id: number | null
          source_url: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          application_url: string
          call_type: string
          confidence_tier?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          eligibility?: string | null
          fee?: number | null
          id?: string
          is_active?: boolean
          medium_requirements?: string[] | null
          metadata?: Json
          organization_id?: string | null
          place_id?: number | null
          portal_id?: string | null
          slug: string
          source_id?: number | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          application_url?: string
          call_type?: string
          confidence_tier?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          eligibility?: string | null
          fee?: number | null
          id?: string
          is_active?: boolean
          medium_requirements?: string[] | null
          metadata?: Json
          organization_id?: string | null
          place_id?: number | null
          portal_id?: string | null
          slug?: string
          source_id?: number | null
          source_url?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "open_calls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_calls_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "open_calls_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "open_calls_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_calls_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "open_calls_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "open_calls_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "open_calls_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_portals: {
        Row: {
          created_at: string | null
          organization_id: string
          portal_id: string
        }
        Insert: {
          created_at?: string | null
          organization_id: string
          portal_id: string
        }
        Update: {
          created_at?: string | null
          organization_id?: string
          portal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_portals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_portals_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "organization_portals_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "organization_portals_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          categories: string[] | null
          city: string | null
          created_at: string | null
          data_quality: number | null
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
          portal_id: string | null
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
          data_quality?: number | null
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
          portal_id?: string | null
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
          data_quality?: number | null
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
          portal_id?: string | null
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
          {
            foreignKeyName: "organizations_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "organizations_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "organizations_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      place_candidates: {
        Row: {
          created_at: string
          id: number
          lat: number | null
          lng: number | null
          match_confidence: number | null
          potential_place_id: number | null
          promoted_to_place_id: number | null
          raw_address: string | null
          raw_name: string
          raw_payload: Json | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_id: number | null
          source_url: string | null
          status: Database["public"]["Enums"]["place_candidate_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          lat?: number | null
          lng?: number | null
          match_confidence?: number | null
          potential_place_id?: number | null
          promoted_to_place_id?: number | null
          raw_address?: string | null
          raw_name: string
          raw_payload?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: number | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["place_candidate_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          lat?: number | null
          lng?: number | null
          match_confidence?: number | null
          potential_place_id?: number | null
          promoted_to_place_id?: number | null
          raw_address?: string | null
          raw_name?: string
          raw_payload?: Json | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_id?: number | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["place_candidate_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_candidates_potential_venue_id_fkey"
            columns: ["potential_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_candidates_promoted_to_venue_id_fkey"
            columns: ["promoted_to_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_candidates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "place_candidates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "place_candidates_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      place_claims: {
        Row: {
          claimed_at: string | null
          created_at: string | null
          id: number
          place_id: number
          portal_id: string | null
          proof_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string | null
          id?: number
          place_id: number
          portal_id?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string | null
          id?: number
          place_id?: number
          portal_id?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_claims_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "venue_claims_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "venue_claims_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_claims_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_inventory_snapshots: {
        Row: {
          arrival_date: string
          captured_at: string
          captured_for_date: string
          created_at: string
          id: string
          inventory_scope: string
          metadata: Json
          nights: number
          place_id: number
          provider_id: string
          records: Json
          sample_sites: Json
          source_url: string | null
          total_results: number | null
          updated_at: string
          window_label: string | null
        }
        Insert: {
          arrival_date: string
          captured_at?: string
          captured_for_date?: string
          created_at?: string
          id?: string
          inventory_scope?: string
          metadata?: Json
          nights: number
          place_id: number
          provider_id: string
          records?: Json
          sample_sites?: Json
          source_url?: string | null
          total_results?: number | null
          updated_at?: string
          window_label?: string | null
        }
        Update: {
          arrival_date?: string
          captured_at?: string
          captured_for_date?: string
          created_at?: string
          id?: string
          inventory_scope?: string
          metadata?: Json
          nights?: number
          place_id?: number
          provider_id?: string
          records?: Json
          sample_sites?: Json
          source_url?: string | null
          total_results?: number | null
          updated_at?: string
          window_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_inventory_snapshots_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_occasions: {
        Row: {
          confidence: number
          created_at: string
          id: number
          occasion: string
          place_id: number
          source: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: number
          occasion: string
          place_id: number
          source?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: number
          occasion?: string
          place_id?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_occasions_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_profile: {
        Row: {
          age_max: number | null
          age_min: number | null
          capacity: number | null
          created_at: string
          description: string | null
          explore_blurb: string | null
          explore_category: string | null
          family_suitability: string | null
          featured: boolean
          gallery_urls: string[] | null
          hero_image_url: string | null
          last_verified_at: string | null
          library_pass: Json | null
          parking_type: string | null
          place_id: number
          planning_last_verified_at: string | null
          planning_notes: string | null
          short_description: string | null
          transit_notes: string | null
          updated_at: string
          wheelchair: boolean | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          explore_blurb?: string | null
          explore_category?: string | null
          family_suitability?: string | null
          featured?: boolean
          gallery_urls?: string[] | null
          hero_image_url?: string | null
          last_verified_at?: string | null
          library_pass?: Json | null
          parking_type?: string | null
          place_id: number
          planning_last_verified_at?: string | null
          planning_notes?: string | null
          short_description?: string | null
          transit_notes?: string | null
          updated_at?: string
          wheelchair?: boolean | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          capacity?: number | null
          created_at?: string
          description?: string | null
          explore_blurb?: string | null
          explore_category?: string | null
          family_suitability?: string | null
          featured?: boolean
          gallery_urls?: string[] | null
          hero_image_url?: string | null
          last_verified_at?: string | null
          library_pass?: Json | null
          parking_type?: string | null
          place_id?: number
          planning_last_verified_at?: string | null
          planning_notes?: string | null
          short_description?: string | null
          transit_notes?: string | null
          updated_at?: string
          wheelchair?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "place_profile_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_specials: {
        Row: {
          confidence: string | null
          created_at: string | null
          days_of_week: number[] | null
          description: string | null
          end_date: string | null
          id: number
          image_url: string | null
          is_active: boolean | null
          last_verified_at: string | null
          place_id: number
          price_note: string | null
          source_url: string | null
          start_date: string | null
          time_end: string | null
          time_start: string | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          days_of_week?: number[] | null
          description?: string | null
          end_date?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          last_verified_at?: string | null
          place_id: number
          price_note?: string | null
          source_url?: string | null
          start_date?: string | null
          time_end?: string | null
          time_start?: string | null
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          days_of_week?: number[] | null
          description?: string | null
          end_date?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          last_verified_at?: string | null
          place_id?: number
          price_note?: string | null
          source_url?: string | null
          start_date?: string | null
          time_end?: string | null
          time_start?: string | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_specials_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_tags: {
        Row: {
          added_by: string
          created_at: string | null
          id: string
          place_id: number
          tag_id: string
        }
        Insert: {
          added_by: string
          created_at?: string | null
          id?: string
          place_id: number
          tag_id: string
        }
        Update: {
          added_by?: string
          created_at?: string | null
          id?: string
          place_id?: number
          tag_id?: string
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
            referencedRelation: "entity_tag_summary"
            referencedColumns: ["tag_id"]
          },
          {
            foreignKeyName: "venue_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag_definitions"
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
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      place_vertical_details: {
        Row: {
          civic: Json | null
          created_at: string
          dining: Json | null
          google: Json | null
          outdoor: Json | null
          place_id: number
          updated_at: string
        }
        Insert: {
          civic?: Json | null
          created_at?: string
          dining?: Json | null
          google?: Json | null
          outdoor?: Json | null
          place_id: number
          updated_at?: string
        }
        Update: {
          civic?: Json | null
          created_at?: string
          dining?: Json | null
          google?: Json | null
          outdoor?: Json | null
          place_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_vertical_details_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          accepts_reservations: boolean | null
          address: string | null
          aliases: string[] | null
          availability_status: string | null
          beltline_adjacent: boolean | null
          beltline_segment: string | null
          beltline_walk_minutes: number | null
          blurhash: string | null
          capacity: number | null
          capacity_tier: number | null
          city: string | null
          claimed_at: string | null
          claimed_by: string | null
          created_at: string | null
          cuisine: string[] | null
          data_quality: number | null
          description: string | null
          dietary_options: string[] | null
          explore_blurb: string | null
          explore_category: string | null
          explore_featured: boolean | null
          facebook_url: string | null
          featured: boolean | null
          founding_year: number | null
          foursquare_id: string | null
          from_submission: string | null
          genres: string[] | null
          hero_image_url: string | null
          hours: Json | null
          hours_display: string | null
          hours_source: string | null
          hours_updated_at: string | null
          id: number
          image_url: string | null
          indoor_outdoor: string | null
          instagram: string | null
          is_active: boolean | null
          is_adult: boolean | null
          is_chain: boolean | null
          is_event_venue: boolean | null
          is_experience: boolean | null
          is_seasonal_only: boolean
          is_verified: boolean | null
          last_verified_at: string | null
          lat: number | null
          library_pass: Json | null
          lng: number | null
          location: unknown
          location_designator: string
          marta_lines: string[] | null
          marta_walk_minutes: number | null
          meal_duration_max_minutes: number | null
          meal_duration_min_minutes: number | null
          menu_highlights: Json | null
          menu_url: string | null
          monthly_rate_range: string | null
          music_programming_style:
            | Database["public"]["Enums"]["music_programming_style_enum"]
            | null
          music_venue_formats: string[]
          name: string
          nearest_marta_station: string | null
          neighborhood: string | null
          organization_id: string | null
          parent_place_id: number | null
          parking: string[] | null
          parking_free: boolean | null
          parking_note: string | null
          parking_source: string | null
          parking_type: string[] | null
          payment_buffer_minutes: number | null
          payment_notes: string | null
          phone: string | null
          place_type: string | null
          planning_last_verified_at: string | null
          planning_notes: string | null
          price_level: number | null
          programming_style:
            | Database["public"]["Enums"]["programming_style_enum"]
            | null
          reservation_recommended: boolean | null
          reservation_url: string | null
          search_vector: unknown
          service_style: string | null
          short_description: string | null
          slug: string
          spot_type: string | null
          spot_types: string[] | null
          state: string | null
          studio_application_url: string | null
          studio_type: string | null
          submitted_by: string | null
          transit_note: string | null
          transit_score: number | null
          typical_duration_minutes: number | null
          typical_price_max: number | null
          typical_price_min: number | null
          updated_at: string
          venue_formats: string[]
          venue_types: string[] | null
          vibes: string[] | null
          walk_in_wait_minutes: number | null
          walkable_neighbor_count: number | null
          website: string | null
          zip: string | null
        }
        Insert: {
          accepts_reservations?: boolean | null
          address?: string | null
          aliases?: string[] | null
          availability_status?: string | null
          beltline_adjacent?: boolean | null
          beltline_segment?: string | null
          beltline_walk_minutes?: number | null
          blurhash?: string | null
          capacity?: number | null
          capacity_tier?: number | null
          city?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          cuisine?: string[] | null
          data_quality?: number | null
          description?: string | null
          dietary_options?: string[] | null
          explore_blurb?: string | null
          explore_category?: string | null
          explore_featured?: boolean | null
          facebook_url?: string | null
          featured?: boolean | null
          founding_year?: number | null
          foursquare_id?: string | null
          from_submission?: string | null
          genres?: string[] | null
          hero_image_url?: string | null
          hours?: Json | null
          hours_display?: string | null
          hours_source?: string | null
          hours_updated_at?: string | null
          id?: number
          image_url?: string | null
          indoor_outdoor?: string | null
          instagram?: string | null
          is_active?: boolean | null
          is_adult?: boolean | null
          is_chain?: boolean | null
          is_event_venue?: boolean | null
          is_experience?: boolean | null
          is_seasonal_only?: boolean
          is_verified?: boolean | null
          last_verified_at?: string | null
          lat?: number | null
          library_pass?: Json | null
          lng?: number | null
          location?: unknown
          location_designator?: string
          marta_lines?: string[] | null
          marta_walk_minutes?: number | null
          meal_duration_max_minutes?: number | null
          meal_duration_min_minutes?: number | null
          menu_highlights?: Json | null
          menu_url?: string | null
          monthly_rate_range?: string | null
          music_programming_style?:
            | Database["public"]["Enums"]["music_programming_style_enum"]
            | null
          music_venue_formats?: string[]
          name: string
          nearest_marta_station?: string | null
          neighborhood?: string | null
          organization_id?: string | null
          parent_place_id?: number | null
          parking?: string[] | null
          parking_free?: boolean | null
          parking_note?: string | null
          parking_source?: string | null
          parking_type?: string[] | null
          payment_buffer_minutes?: number | null
          payment_notes?: string | null
          phone?: string | null
          place_type?: string | null
          planning_last_verified_at?: string | null
          planning_notes?: string | null
          price_level?: number | null
          programming_style?:
            | Database["public"]["Enums"]["programming_style_enum"]
            | null
          reservation_recommended?: boolean | null
          reservation_url?: string | null
          search_vector?: unknown
          service_style?: string | null
          short_description?: string | null
          slug: string
          spot_type?: string | null
          spot_types?: string[] | null
          state?: string | null
          studio_application_url?: string | null
          studio_type?: string | null
          submitted_by?: string | null
          transit_note?: string | null
          transit_score?: number | null
          typical_duration_minutes?: number | null
          typical_price_max?: number | null
          typical_price_min?: number | null
          updated_at?: string
          venue_formats?: string[]
          venue_types?: string[] | null
          vibes?: string[] | null
          walk_in_wait_minutes?: number | null
          walkable_neighbor_count?: number | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          accepts_reservations?: boolean | null
          address?: string | null
          aliases?: string[] | null
          availability_status?: string | null
          beltline_adjacent?: boolean | null
          beltline_segment?: string | null
          beltline_walk_minutes?: number | null
          blurhash?: string | null
          capacity?: number | null
          capacity_tier?: number | null
          city?: string | null
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string | null
          cuisine?: string[] | null
          data_quality?: number | null
          description?: string | null
          dietary_options?: string[] | null
          explore_blurb?: string | null
          explore_category?: string | null
          explore_featured?: boolean | null
          facebook_url?: string | null
          featured?: boolean | null
          founding_year?: number | null
          foursquare_id?: string | null
          from_submission?: string | null
          genres?: string[] | null
          hero_image_url?: string | null
          hours?: Json | null
          hours_display?: string | null
          hours_source?: string | null
          hours_updated_at?: string | null
          id?: number
          image_url?: string | null
          indoor_outdoor?: string | null
          instagram?: string | null
          is_active?: boolean | null
          is_adult?: boolean | null
          is_chain?: boolean | null
          is_event_venue?: boolean | null
          is_experience?: boolean | null
          is_seasonal_only?: boolean
          is_verified?: boolean | null
          last_verified_at?: string | null
          lat?: number | null
          library_pass?: Json | null
          lng?: number | null
          location?: unknown
          location_designator?: string
          marta_lines?: string[] | null
          marta_walk_minutes?: number | null
          meal_duration_max_minutes?: number | null
          meal_duration_min_minutes?: number | null
          menu_highlights?: Json | null
          menu_url?: string | null
          monthly_rate_range?: string | null
          music_programming_style?:
            | Database["public"]["Enums"]["music_programming_style_enum"]
            | null
          music_venue_formats?: string[]
          name?: string
          nearest_marta_station?: string | null
          neighborhood?: string | null
          organization_id?: string | null
          parent_place_id?: number | null
          parking?: string[] | null
          parking_free?: boolean | null
          parking_note?: string | null
          parking_source?: string | null
          parking_type?: string[] | null
          payment_buffer_minutes?: number | null
          payment_notes?: string | null
          phone?: string | null
          place_type?: string | null
          planning_last_verified_at?: string | null
          planning_notes?: string | null
          price_level?: number | null
          programming_style?:
            | Database["public"]["Enums"]["programming_style_enum"]
            | null
          reservation_recommended?: boolean | null
          reservation_url?: string | null
          search_vector?: unknown
          service_style?: string | null
          short_description?: string | null
          slug?: string
          spot_type?: string | null
          spot_types?: string[] | null
          state?: string | null
          studio_application_url?: string | null
          studio_type?: string | null
          submitted_by?: string | null
          transit_note?: string | null
          transit_score?: number | null
          typical_duration_minutes?: number | null
          typical_price_max?: number | null
          typical_price_min?: number | null
          updated_at?: string
          venue_formats?: string[]
          venue_types?: string[] | null
          vibes?: string[] | null
          walk_in_wait_minutes?: number | null
          walkable_neighbor_count?: number | null
          website?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_parent_venue_id_fkey"
            columns: ["parent_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venues_producer_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      plan_invitees: {
        Row: {
          invited_at: string
          invited_by: string | null
          plan_id: string
          responded_at: string | null
          rsvp_status: string
          seen_at: string | null
          user_id: string
        }
        Insert: {
          invited_at?: string
          invited_by?: string | null
          plan_id: string
          responded_at?: string | null
          rsvp_status?: string
          seen_at?: string | null
          user_id: string
        }
        Update: {
          invited_at?: string
          invited_by?: string | null
          plan_id?: string
          responded_at?: string | null
          rsvp_status?: string
          seen_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_invitees_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_invitees_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_invitees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          anchor_event_id: number | null
          anchor_place_id: number | null
          anchor_series_id: string | null
          anchor_type: string | null
          cancelled_at: string | null
          created_at: string
          creator_id: string
          ended_at: string | null
          id: string
          note: string | null
          portal_id: string
          share_token: string
          started_at: string | null
          starts_at: string
          status: string
          title: string | null
          updated_at: string
          updated_by: string | null
          visibility: string
        }
        Insert: {
          anchor_event_id?: number | null
          anchor_place_id?: number | null
          anchor_series_id?: string | null
          anchor_type?: string | null
          cancelled_at?: string | null
          created_at?: string
          creator_id: string
          ended_at?: string | null
          id?: string
          note?: string | null
          portal_id: string
          share_token?: string
          started_at?: string | null
          starts_at: string
          status?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Update: {
          anchor_event_id?: number | null
          anchor_place_id?: number | null
          anchor_series_id?: string | null
          anchor_type?: string | null
          cancelled_at?: string | null
          created_at?: string
          creator_id?: string
          ended_at?: string | null
          id?: string
          note?: string | null
          portal_id?: string
          share_token?: string
          started_at?: string | null
          starts_at?: string
          status?: string
          title?: string | null
          updated_at?: string
          updated_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_anchor_event_id_fkey"
            columns: ["anchor_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_anchor_event_id_fkey"
            columns: ["anchor_event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_anchor_place_id_fkey"
            columns: ["anchor_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_anchor_series_id_fkey"
            columns: ["anchor_series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "plans_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "plans_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "portal_source_entity_access"
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
      portal_demo_assumptions: {
        Row: {
          assumption_key: string
          assumption_statement: string
          created_at: string | null
          customer_input_needed: string
          demo_default: string | null
          due_date: string | null
          hospital_location_id: string | null
          id: string
          impact_level: string
          owner: string | null
          portal_id: string
          scope: string
          updated_at: string | null
          validation_status: string
        }
        Insert: {
          assumption_key: string
          assumption_statement: string
          created_at?: string | null
          customer_input_needed: string
          demo_default?: string | null
          due_date?: string | null
          hospital_location_id?: string | null
          id?: string
          impact_level?: string
          owner?: string | null
          portal_id: string
          scope: string
          updated_at?: string | null
          validation_status?: string
        }
        Update: {
          assumption_key?: string
          assumption_statement?: string
          created_at?: string | null
          customer_input_needed?: string
          demo_default?: string | null
          due_date?: string | null
          hospital_location_id?: string | null
          id?: string
          impact_level?: string
          owner?: string | null
          portal_id?: string
          scope?: string
          updated_at?: string | null
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_demo_assumptions_hospital_location_id_fkey"
            columns: ["hospital_location_id"]
            isOneToOne: false
            referencedRelation: "portal_hospital_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_demo_assumptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_demo_assumptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_demo_assumptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_event_shares: {
        Row: {
          created_at: string
          event_id: number
          id: string
          portal_id: string
          share_method: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: number
          id?: string
          portal_id: string
          share_method?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: number
          id?: string
          portal_id?: string
          share_method?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_event_shares_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_event_shares_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_event_shares_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_event_shares_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_event_shares_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_event_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_feed_headers: {
        Row: {
          accent_color: string | null
          boosted_event_ids: number[] | null
          conditions: Json | null
          created_at: string | null
          cta: Json | null
          dashboard_cards: Json | null
          headline: string | null
          hero_image_url: string | null
          id: string
          is_active: boolean | null
          name: string
          portal_id: string
          priority: number | null
          quick_links: Json | null
          schedule_end: string | null
          schedule_start: string | null
          show_after_time: string | null
          show_before_time: string | null
          show_on_days: string[] | null
          slug: string
          subtitle: string | null
          suppressed_event_ids: number[] | null
          updated_at: string | null
        }
        Insert: {
          accent_color?: string | null
          boosted_event_ids?: number[] | null
          conditions?: Json | null
          created_at?: string | null
          cta?: Json | null
          dashboard_cards?: Json | null
          headline?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          portal_id: string
          priority?: number | null
          quick_links?: Json | null
          schedule_end?: string | null
          schedule_start?: string | null
          show_after_time?: string | null
          show_before_time?: string | null
          show_on_days?: string[] | null
          slug: string
          subtitle?: string | null
          suppressed_event_ids?: number[] | null
          updated_at?: string | null
        }
        Update: {
          accent_color?: string | null
          boosted_event_ids?: number[] | null
          conditions?: Json | null
          created_at?: string | null
          cta?: Json | null
          dashboard_cards?: Json | null
          headline?: string | null
          hero_image_url?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          portal_id?: string
          priority?: number | null
          quick_links?: Json | null
          schedule_end?: string | null
          schedule_start?: string | null
          show_after_time?: string | null
          show_before_time?: string | null
          show_on_days?: string[] | null
          slug?: string
          subtitle?: string | null
          suppressed_event_ids?: number[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_feed_headers_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_feed_headers_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_feed_headers_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_hospital_locations: {
        Row: {
          address: string
          created_at: string | null
          display_order: number | null
          emergency_phone: string | null
          gozio_deeplink: string | null
          id: string
          is_active: boolean | null
          lat: number
          lng: number
          metadata: Json | null
          name: string
          neighborhood: string | null
          phone: string | null
          portal_id: string
          short_name: string | null
          slug: string
          updated_at: string | null
          wayfinding_url: string | null
          website: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          display_order?: number | null
          emergency_phone?: string | null
          gozio_deeplink?: string | null
          id?: string
          is_active?: boolean | null
          lat: number
          lng: number
          metadata?: Json | null
          name: string
          neighborhood?: string | null
          phone?: string | null
          portal_id: string
          short_name?: string | null
          slug: string
          updated_at?: string | null
          wayfinding_url?: string | null
          website?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          display_order?: number | null
          emergency_phone?: string | null
          gozio_deeplink?: string | null
          id?: string
          is_active?: boolean | null
          lat?: number
          lng?: number
          metadata?: Json | null
          name?: string
          neighborhood?: string | null
          phone?: string | null
          portal_id?: string
          short_name?: string | null
          slug?: string
          updated_at?: string | null
          wayfinding_url?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_hospital_locations_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_hospital_locations_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_hospital_locations_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_hospital_services: {
        Row: {
          category: string
          created_at: string | null
          cta_label: string | null
          cta_url: string | null
          description: string | null
          display_order: number | null
          hospital_location_id: string
          id: string
          is_active: boolean | null
          location_hint: string | null
          name: string
          open_hours: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          display_order?: number | null
          hospital_location_id: string
          id?: string
          is_active?: boolean | null
          location_hint?: string | null
          name: string
          open_hours?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          cta_label?: string | null
          cta_url?: string | null
          description?: string | null
          display_order?: number | null
          hospital_location_id?: string
          id?: string
          is_active?: boolean | null
          location_hint?: string | null
          name?: string
          open_hours?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_hospital_services_hospital_location_id_fkey"
            columns: ["hospital_location_id"]
            isOneToOne: false
            referencedRelation: "portal_hospital_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_interaction_events: {
        Row: {
          action_type: string
          created_at: string
          hospital_slug: string | null
          id: string
          metadata: Json | null
          mode_context: string | null
          page_type: string
          portal_id: string
          referrer: string | null
          section_key: string | null
          target_id: string | null
          target_kind: string | null
          target_label: string | null
          target_url: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          hospital_slug?: string | null
          id?: string
          metadata?: Json | null
          mode_context?: string | null
          page_type?: string
          portal_id: string
          referrer?: string | null
          section_key?: string | null
          target_id?: string | null
          target_kind?: string | null
          target_label?: string | null
          target_url?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          hospital_slug?: string | null
          id?: string
          metadata?: Json | null
          mode_context?: string | null
          page_type?: string
          portal_id?: string
          referrer?: string | null
          section_key?: string | null
          target_id?: string | null
          target_kind?: string | null
          target_label?: string | null
          target_url?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_interaction_events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_interaction_events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_interaction_events_portal_id_fkey"
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
            referencedRelation: "portal_source_entity_access"
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
      portal_page_views: {
        Row: {
          created_at: string
          entity_id: number | null
          id: string
          page_type: string
          portal_id: string
          referrer: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: number | null
          id?: string
          page_type: string
          portal_id: string
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: number | null
          id?: string
          page_type?: string
          portal_id?: string
          referrer?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_page_views_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_page_views_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_page_views_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_preferences: {
        Row: {
          created_at: string | null
          dietary_needs: string[] | null
          id: string
          interests: string[] | null
          mobility_preferences: Json | null
          onboarding_completed_at: string | null
          portal_id: string
          preferred_experience_view: string | null
          preferred_guest_intent: string | null
          travel_party: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dietary_needs?: string[] | null
          id?: string
          interests?: string[] | null
          mobility_preferences?: Json | null
          onboarding_completed_at?: string | null
          portal_id: string
          preferred_experience_view?: string | null
          preferred_guest_intent?: string | null
          travel_party?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          dietary_needs?: string[] | null
          id?: string
          interests?: string[] | null
          mobility_preferences?: Json | null
          onboarding_completed_at?: string | null
          portal_id?: string
          preferred_experience_view?: string | null
          preferred_guest_intent?: string | null
          travel_party?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_preferences_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_preferences_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_preferences_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_revenue_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          portal_id: string
          target_kind: string | null
          target_name: string | null
          target_url: string | null
          user_id: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          portal_id: string
          target_kind?: string | null
          target_name?: string | null
          target_url?: string | null
          user_id?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          portal_id?: string
          target_kind?: string | null
          target_name?: string | null
          target_url?: string | null
          user_id?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_revenue_events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_revenue_events_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_revenue_events_portal_id_fkey"
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
            referencedRelation: "portal_source_entity_access"
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
      portal_weather_cache: {
        Row: {
          condition: string | null
          fetched_at: string | null
          humidity: number | null
          icon: string | null
          id: string
          portal_id: string
          temperature_f: number | null
          wind_mph: number | null
        }
        Insert: {
          condition?: string | null
          fetched_at?: string | null
          humidity?: number | null
          icon?: string | null
          id?: string
          portal_id: string
          temperature_f?: number | null
          wind_mph?: number | null
        }
        Update: {
          condition?: string | null
          fetched_at?: string | null
          humidity?: number | null
          icon?: string | null
          id?: string
          portal_id?: string
          temperature_f?: number | null
          wind_mph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_weather_cache_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: true
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_weather_cache_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: true
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portal_weather_cache_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: true
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portals: {
        Row: {
          account_id: string | null
          branding: Json | null
          city_slug: string | null
          created_at: string | null
          custom_domain: string | null
          custom_domain_verification_token: string | null
          custom_domain_verified: boolean | null
          filters: Json | null
          id: string
          name: string
          owner_id: string | null
          owner_type: string | null
          parent_portal_id: string | null
          plan: string | null
          portal_type: string
          scoring_config: Json | null
          settings: Json | null
          slug: string
          status: string | null
          tagline: string | null
          updated_at: string | null
          vertical_slug: string | null
          visibility: string | null
        }
        Insert: {
          account_id?: string | null
          branding?: Json | null
          city_slug?: string | null
          created_at?: string | null
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean | null
          filters?: Json | null
          id?: string
          name: string
          owner_id?: string | null
          owner_type?: string | null
          parent_portal_id?: string | null
          plan?: string | null
          portal_type: string
          scoring_config?: Json | null
          settings?: Json | null
          slug: string
          status?: string | null
          tagline?: string | null
          updated_at?: string | null
          vertical_slug?: string | null
          visibility?: string | null
        }
        Update: {
          account_id?: string | null
          branding?: Json | null
          city_slug?: string | null
          created_at?: string | null
          custom_domain?: string | null
          custom_domain_verification_token?: string | null
          custom_domain_verified?: boolean | null
          filters?: Json | null
          id?: string
          name?: string
          owner_id?: string | null
          owner_type?: string | null
          parent_portal_id?: string | null
          plan?: string | null
          portal_type?: string
          scoring_config?: Json | null
          settings?: Json | null
          slug?: string
          status?: string | null
          tagline?: string | null
          updated_at?: string | null
          vertical_slug?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portals_parent_portal_id_fkey"
            columns: ["parent_portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portals_parent_portal_id_fkey"
            columns: ["parent_portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "portals_parent_portal_id_fkey"
            columns: ["parent_portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved_count: number | null
          avatar_url: string | null
          bio: string | null
          calendar_feed_secret: string
          city_moment_thumbnail_url: string | null
          city_moment_url: string | null
          created_at: string | null
          date_of_birth: string | null
          display_name: string | null
          id: string
          is_admin: boolean | null
          is_public: boolean | null
          location: string | null
          notification_settings: Json
          privacy_mode: string
          rejected_count: number | null
          signup_attributed_at: string | null
          signup_portal_id: string | null
          submission_count: number | null
          updated_at: string | null
          username: string
          website: string | null
        }
        Insert: {
          approved_count?: number | null
          avatar_url?: string | null
          bio?: string | null
          calendar_feed_secret: string
          city_moment_thumbnail_url?: string | null
          city_moment_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          id: string
          is_admin?: boolean | null
          is_public?: boolean | null
          location?: string | null
          notification_settings?: Json
          privacy_mode?: string
          rejected_count?: number | null
          signup_attributed_at?: string | null
          signup_portal_id?: string | null
          submission_count?: number | null
          updated_at?: string | null
          username: string
          website?: string | null
        }
        Update: {
          approved_count?: number | null
          avatar_url?: string | null
          bio?: string | null
          calendar_feed_secret?: string
          city_moment_thumbnail_url?: string | null
          city_moment_url?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          display_name?: string | null
          id?: string
          is_admin?: boolean | null
          is_public?: boolean | null
          location?: string | null
          notification_settings?: Json
          privacy_mode?: string
          rejected_count?: number | null
          signup_attributed_at?: string | null
          signup_portal_id?: string | null
          submission_count?: number | null
          updated_at?: string | null
          username?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_signup_portal_id_fkey"
            columns: ["signup_portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "profiles_signup_portal_id_fkey"
            columns: ["signup_portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "profiles_signup_portal_id_fkey"
            columns: ["signup_portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          age_max: number | null
          age_min: number | null
          before_after_care: boolean
          cost_amount: number | null
          cost_notes: string | null
          cost_period: string | null
          created_at: string
          description: string | null
          id: string
          last_status_check_at: string | null
          lunch_included: boolean
          metadata: Json
          name: string
          place_id: number | null
          portal_id: string | null
          program_type: string
          provider_name: string | null
          registration_closes: string | null
          registration_opens: string | null
          registration_status: string
          registration_url: string | null
          schedule_days: number[] | null
          schedule_end_time: string | null
          schedule_start_time: string | null
          search_vector: unknown
          season: string | null
          session_end: string | null
          session_start: string | null
          slug: string | null
          source_id: number | null
          status: string
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          before_after_care?: boolean
          cost_amount?: number | null
          cost_notes?: string | null
          cost_period?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_status_check_at?: string | null
          lunch_included?: boolean
          metadata?: Json
          name: string
          place_id?: number | null
          portal_id?: string | null
          program_type: string
          provider_name?: string | null
          registration_closes?: string | null
          registration_opens?: string | null
          registration_status?: string
          registration_url?: string | null
          schedule_days?: number[] | null
          schedule_end_time?: string | null
          schedule_start_time?: string | null
          search_vector?: unknown
          season?: string | null
          session_end?: string | null
          session_start?: string | null
          slug?: string | null
          source_id?: number | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          before_after_care?: boolean
          cost_amount?: number | null
          cost_notes?: string | null
          cost_period?: string | null
          created_at?: string
          description?: string | null
          id?: string
          last_status_check_at?: string | null
          lunch_included?: boolean
          metadata?: Json
          name?: string
          place_id?: number | null
          portal_id?: string | null
          program_type?: string
          provider_name?: string | null
          registration_closes?: string | null
          registration_opens?: string | null
          registration_status?: string
          registration_url?: string | null
          schedule_days?: number[] | null
          schedule_end_time?: string | null
          schedule_start_time?: string | null
          search_vector?: unknown
          season?: string | null
          session_end?: string | null
          session_start?: string | null
          slug?: string | null
          source_id?: number | null
          status?: string
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "programs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "programs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "programs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "programs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh_key: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh_key: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string | null
          event_id: number | null
          id: string
          note: string | null
          org_id: string | null
          organization_id: string | null
          portal_id: string | null
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
          organization_id?: string | null
          portal_id?: string | null
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
          organization_id?: string | null
          portal_id?: string | null
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
            foreignKeyName: "recommendations_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "recommendations_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "recommendations_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recommendations_producer_id_fkey"
            columns: ["organization_id"]
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
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      rsvp_companions: {
        Row: {
          companion_id: string
          created_at: string | null
          event_id: number
          id: string
          rsvp_user_id: string
        }
        Insert: {
          companion_id: string
          created_at?: string | null
          event_id: number
          id?: string
          rsvp_user_id: string
        }
        Update: {
          companion_id?: string
          created_at?: string | null
          event_id?: number
          id?: string
          rsvp_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvp_companions_companion_id_fkey"
            columns: ["companion_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvp_companions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvp_companions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvp_companions_rsvp_user_id_fkey"
            columns: ["rsvp_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string | null
          event_id: number | null
          id: string
          portal_id: string | null
          user_id: string
          venue_id: number | null
        }
        Insert: {
          created_at?: string | null
          event_id?: number | null
          id?: string
          portal_id?: string | null
          user_id: string
          venue_id?: number | null
        }
        Update: {
          created_at?: string | null
          event_id?: number | null
          id?: string
          portal_id?: string | null
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
            foreignKeyName: "saved_items_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "saved_items_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "saved_items_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
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
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      school_calendar_events: {
        Row: {
          created_at: string
          end_date: string
          event_type: string
          id: string
          name: string
          school_system: string
          school_year: string
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          event_type: string
          id?: string
          name: string
          school_system: string
          school_year: string
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          event_type?: string
          id?: string
          name?: string
          school_system?: string
          school_year?: string
          start_date?: string
        }
        Relationships: []
      }
      screening_runs: {
        Row: {
          buy_url: string | null
          created_at: string
          curator_pick_week: string | null
          end_date: string
          festival_id: string | null
          id: string
          info_url: string | null
          is_curator_pick: boolean
          is_special_event: boolean
          label: string
          metadata: Json
          place_id: number | null
          portal_id: string
          screen_name: string | null
          screening_title_id: string
          source_id: number | null
          source_key: string
          start_date: string
          updated_at: string
        }
        Insert: {
          buy_url?: string | null
          created_at?: string
          curator_pick_week?: string | null
          end_date: string
          festival_id?: string | null
          id?: string
          info_url?: string | null
          is_curator_pick?: boolean
          is_special_event?: boolean
          label: string
          metadata?: Json
          place_id?: number | null
          portal_id: string
          screen_name?: string | null
          screening_title_id: string
          source_id?: number | null
          source_key: string
          start_date: string
          updated_at?: string
        }
        Update: {
          buy_url?: string | null
          created_at?: string
          curator_pick_week?: string | null
          end_date?: string
          festival_id?: string | null
          id?: string
          info_url?: string | null
          is_curator_pick?: boolean
          is_special_event?: boolean
          label?: string
          metadata?: Json
          place_id?: number | null
          portal_id?: string
          screen_name?: string | null
          screening_title_id?: string
          source_id?: number | null
          source_key?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_runs_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_runs_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_runs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "screening_runs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "screening_runs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_runs_screening_title_id_fkey"
            columns: ["screening_title_id"]
            isOneToOne: false
            referencedRelation: "screening_titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "screening_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "screening_runs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_times: {
        Row: {
          created_at: string
          end_time: string | null
          event_id: number | null
          format_labels: string[]
          id: string
          screening_run_id: string
          source_key: string
          source_url: string | null
          start_date: string
          start_time: string | null
          status: string
          ticket_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          event_id?: number | null
          format_labels?: string[]
          id?: string
          screening_run_id: string
          source_key: string
          source_url?: string | null
          start_date: string
          start_time?: string | null
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          event_id?: number | null
          format_labels?: string[]
          id?: string
          screening_run_id?: string
          source_key?: string
          source_url?: string | null
          start_date?: string
          start_time?: string | null
          status?: string
          ticket_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_times_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_times_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_times_screening_run_id_fkey"
            columns: ["screening_run_id"]
            isOneToOne: false
            referencedRelation: "screening_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_titles: {
        Row: {
          canonical_title: string
          created_at: string
          director: string | null
          editorial_blurb: string | null
          festival_work_key: string | null
          film_press_quote: string | null
          film_press_source: string | null
          genres: string[]
          id: string
          imdb_id: string | null
          is_premiere: boolean
          kind: string
          poster_image_url: string | null
          premiere_scope:
            | Database["public"]["Enums"]["premiere_scope_enum"]
            | null
          rating: string | null
          runtime_minutes: number | null
          slug: string
          source_key: string
          synopsis: string | null
          tmdb_id: number | null
          updated_at: string
          year: number | null
        }
        Insert: {
          canonical_title: string
          created_at?: string
          director?: string | null
          editorial_blurb?: string | null
          festival_work_key?: string | null
          film_press_quote?: string | null
          film_press_source?: string | null
          genres?: string[]
          id?: string
          imdb_id?: string | null
          is_premiere?: boolean
          kind: string
          poster_image_url?: string | null
          premiere_scope?:
            | Database["public"]["Enums"]["premiere_scope_enum"]
            | null
          rating?: string | null
          runtime_minutes?: number | null
          slug: string
          source_key: string
          synopsis?: string | null
          tmdb_id?: number | null
          updated_at?: string
          year?: number | null
        }
        Update: {
          canonical_title?: string
          created_at?: string
          director?: string | null
          editorial_blurb?: string | null
          festival_work_key?: string | null
          film_press_quote?: string | null
          film_press_source?: string | null
          genres?: string[]
          id?: string
          imdb_id?: string | null
          is_premiere?: boolean
          kind?: string
          poster_image_url?: string | null
          premiere_scope?:
            | Database["public"]["Enums"]["premiere_scope_enum"]
            | null
          rating?: string | null
          runtime_minutes?: number | null
          slug?: string
          source_key?: string
          synopsis?: string | null
          tmdb_id?: number | null
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      search_click_events: {
        Row: {
          clicked_at: string
          conversion_type: string | null
          dwell_ms: number | null
          id: string
          position: number
          primary_retriever: string
          result_id: string
          result_type: string
          search_event_id: string
        }
        Insert: {
          clicked_at?: string
          conversion_type?: string | null
          dwell_ms?: number | null
          id?: string
          position: number
          primary_retriever: string
          result_id: string
          result_type: string
          search_event_id: string
        }
        Update: {
          clicked_at?: string
          conversion_type?: string | null
          dwell_ms?: number | null
          id?: string
          position?: number
          primary_retriever?: string
          result_id?: string
          result_type?: string
          search_event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "search_click_events_search_event_id_fkey"
            columns: ["search_event_id"]
            isOneToOne: false
            referencedRelation: "search_events"
            referencedColumns: ["id"]
          },
        ]
      }
      search_events: {
        Row: {
          cache_hit: string
          degraded: boolean
          filters_json: Json
          id: string
          intent_type: string | null
          locale: string
          occurred_at: string
          portal_slug: string
          query_hash: string
          query_length: number
          query_word_count: number
          result_count: number
          result_type_counts: Json
          retrieve_total_ms: number | null
          retriever_breakdown: Json
          top_matches_types: string[]
          total_ms: number
          user_segment: string
          zero_result: boolean
        }
        Insert: {
          cache_hit: string
          degraded?: boolean
          filters_json?: Json
          id?: string
          intent_type?: string | null
          locale?: string
          occurred_at?: string
          portal_slug: string
          query_hash: string
          query_length: number
          query_word_count: number
          result_count: number
          result_type_counts?: Json
          retrieve_total_ms?: number | null
          retriever_breakdown?: Json
          top_matches_types?: string[]
          total_ms: number
          user_segment: string
          zero_result: boolean
        }
        Update: {
          cache_hit?: string
          degraded?: boolean
          filters_json?: Json
          id?: string
          intent_type?: string | null
          locale?: string
          occurred_at?: string
          portal_slug?: string
          query_hash?: string
          query_length?: number
          query_word_count?: number
          result_count?: number
          result_type_counts?: Json
          retrieve_total_ms?: number | null
          retriever_breakdown?: Json
          top_matches_types?: string[]
          total_ms?: number
          user_segment?: string
          zero_result?: boolean
        }
        Relationships: []
      }
      search_log_salt: {
        Row: {
          day: string
          salt: string
        }
        Insert: {
          day: string
          salt: string
        }
        Update: {
          day?: string
          salt?: string
        }
        Relationships: []
      }
      search_term_overrides: {
        Row: {
          city: string | null
          confidence: number
          created_at: string
          display_term: string
          entity_id: string
          entity_type: string
          id: number
          is_active: boolean
          match_term: string
          notes: string | null
          suggestion_type: string
          term_type: string
          updated_at: string
          weight: number
        }
        Insert: {
          city?: string | null
          confidence?: number
          created_at?: string
          display_term: string
          entity_id: string
          entity_type: string
          id?: number
          is_active?: boolean
          match_term: string
          notes?: string | null
          suggestion_type: string
          term_type?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          city?: string | null
          confidence?: number
          created_at?: string
          display_term?: string
          entity_id?: string
          entity_type?: string
          id?: number
          is_active?: boolean
          match_term?: string
          notes?: string | null
          suggestion_type?: string
          term_type?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      series: {
        Row: {
          category: string | null
          confidence: string | null
          created_at: string | null
          data_quality: number | null
          day_of_week: string | null
          description: string | null
          director: string | null
          exhibition_id: string | null
          festival_id: string | null
          frequency: string | null
          genres: string[] | null
          id: string
          image_url: string | null
          imdb_id: string | null
          is_active: boolean | null
          last_verified_at: string | null
          organization_id: string | null
          price_note: string | null
          rating: string | null
          runtime_minutes: number | null
          series_type: string
          slug: string
          tags: string[] | null
          title: string
          tmdb_id: string | null
          trailer_url: string | null
          updated_at: string | null
          venue_id: number | null
          year: number | null
        }
        Insert: {
          category?: string | null
          confidence?: string | null
          created_at?: string | null
          data_quality?: number | null
          day_of_week?: string | null
          description?: string | null
          director?: string | null
          exhibition_id?: string | null
          festival_id?: string | null
          frequency?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          imdb_id?: string | null
          is_active?: boolean | null
          last_verified_at?: string | null
          organization_id?: string | null
          price_note?: string | null
          rating?: string | null
          runtime_minutes?: number | null
          series_type: string
          slug: string
          tags?: string[] | null
          title: string
          tmdb_id?: string | null
          trailer_url?: string | null
          updated_at?: string | null
          venue_id?: number | null
          year?: number | null
        }
        Update: {
          category?: string | null
          confidence?: string | null
          created_at?: string | null
          data_quality?: number | null
          day_of_week?: string | null
          description?: string | null
          director?: string | null
          exhibition_id?: string | null
          festival_id?: string | null
          frequency?: string | null
          genres?: string[] | null
          id?: string
          image_url?: string | null
          imdb_id?: string | null
          is_active?: boolean | null
          last_verified_at?: string | null
          organization_id?: string | null
          price_note?: string | null
          rating?: string | null
          runtime_minutes?: number | null
          series_type?: string
          slug?: string
          tags?: string[] | null
          title?: string
          tmdb_id?: string | null
          trailer_url?: string | null
          updated_at?: string | null
          venue_id?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "series_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "series_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      source_sharing_rules: {
        Row: {
          allowed_categories: string[] | null
          created_at: string | null
          id: string
          owner_portal_id: string
          share_scope: string
          shared_entity_families: string[]
          source_id: number
          updated_at: string | null
        }
        Insert: {
          allowed_categories?: string[] | null
          created_at?: string | null
          id?: string
          owner_portal_id: string
          share_scope?: string
          shared_entity_families?: string[]
          source_id: number
          updated_at?: string | null
        }
        Update: {
          allowed_categories?: string[] | null
          created_at?: string | null
          id?: string
          owner_portal_id?: string
          share_scope?: string
          shared_entity_families?: string[]
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
            referencedRelation: "portal_source_entity_access"
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
            referencedRelation: "portal_source_entity_access"
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
          subscribed_entity_families: string[]
          subscriber_portal_id: string
          subscription_scope: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source_id: number
          subscribed_categories?: string[] | null
          subscribed_entity_families?: string[]
          subscriber_portal_id: string
          subscription_scope?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source_id?: number
          subscribed_categories?: string[] | null
          subscribed_entity_families?: string[]
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
            referencedRelation: "portal_source_entity_access"
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
            referencedRelation: "portal_source_entity_access"
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
          active_months: number[] | null
          civic_verified: boolean
          crawl_frequency: string | null
          created_at: string | null
          expected_event_count: number | null
          health_tags: string[] | null
          id: number
          integration_method: string | null
          is_active: boolean | null
          is_sensitive: boolean | null
          last_crawled_at: string | null
          name: string
          organization_id: string | null
          owner_portal_id: string | null
          rollup_behavior: string | null
          slug: string
          source_type: string
          url: string
        }
        Insert: {
          active_months?: number[] | null
          civic_verified?: boolean
          crawl_frequency?: string | null
          created_at?: string | null
          expected_event_count?: number | null
          health_tags?: string[] | null
          id?: number
          integration_method?: string | null
          is_active?: boolean | null
          is_sensitive?: boolean | null
          last_crawled_at?: string | null
          name: string
          organization_id?: string | null
          owner_portal_id?: string | null
          rollup_behavior?: string | null
          slug: string
          source_type: string
          url: string
        }
        Update: {
          active_months?: number[] | null
          civic_verified?: boolean
          crawl_frequency?: string | null
          created_at?: string | null
          expected_event_count?: number | null
          health_tags?: string[] | null
          id?: number
          integration_method?: string | null
          is_active?: boolean | null
          is_sensitive?: boolean | null
          last_crawled_at?: string | null
          name?: string
          organization_id?: string | null
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
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "sources_owner_portal_id_fkey"
            columns: ["owner_portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_producer_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          admin_notes: string | null
          approved_event_id: number | null
          approved_organization_id: string | null
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
          approved_organization_id?: string | null
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
          approved_organization_id?: string | null
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
            columns: ["approved_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_approved_venue_id_fkey"
            columns: ["approved_venue_id"]
            isOneToOne: false
            referencedRelation: "places"
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
            referencedRelation: "portal_source_entity_access"
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
      tag_definitions: {
        Row: {
          created_at: string | null
          created_by: string | null
          entity_type: string | null
          entity_types: string[] | null
          id: string
          is_active: boolean | null
          is_official: boolean | null
          label: string
          slug: string
          tag_group: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          entity_type?: string | null
          entity_types?: string[] | null
          id?: string
          is_active?: boolean | null
          is_official?: boolean | null
          label: string
          slug: string
          tag_group: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          entity_type?: string | null
          entity_types?: string[] | null
          id?: string
          is_active?: boolean | null
          is_official?: boolean | null
          label?: string
          slug?: string
          tag_group?: string
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
      taxonomy_definitions: {
        Row: {
          category_scope: string[] | null
          color: string | null
          created_at: string | null
          display_order: number | null
          entity_scope: string[]
          filter_overrides: Json | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_format: boolean | null
          label: string
          taxonomy_group: string
          taxonomy_type: string
          updated_at: string | null
        }
        Insert: {
          category_scope?: string[] | null
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          entity_scope?: string[]
          filter_overrides?: Json | null
          icon?: string | null
          id: string
          is_active?: boolean | null
          is_format?: boolean | null
          label: string
          taxonomy_group: string
          taxonomy_type: string
          updated_at?: string | null
        }
        Update: {
          category_scope?: string[] | null
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          entity_scope?: string[]
          filter_overrides?: Json | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_format?: boolean | null
          label?: string
          taxonomy_group?: string
          taxonomy_type?: string
          updated_at?: string | null
        }
        Relationships: []
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
      user_channel_subscriptions: {
        Row: {
          channel_id: string
          created_at: string | null
          delivery_mode: string
          digest_frequency: string | null
          id: string
          portal_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          delivery_mode?: string
          digest_frequency?: string | null
          id?: string
          portal_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          delivery_mode?: string
          digest_frequency?: string | null
          id?: string
          portal_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_channel_subscriptions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "interest_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_channel_subscriptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "user_channel_subscriptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "user_channel_subscriptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_channel_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_open_call_tracking: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          open_call_id: string
          remind_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          open_call_id: string
          remind_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          open_call_id?: string
          remind_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_open_call_tracking_open_call_id_fkey"
            columns: ["open_call_id"]
            isOneToOne: false
            referencedRelation: "open_calls"
            referencedColumns: ["id"]
          },
        ]
      }
      user_portal_activity: {
        Row: {
          hang_count: number
          last_active_at: string
          portal_id: string
          user_id: string
        }
        Insert: {
          hang_count?: number
          last_active_at?: string
          portal_id: string
          user_id: string
        }
        Update: {
          hang_count?: number
          last_active_at?: string
          portal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_portal_activity_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "user_portal_activity_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "user_portal_activity_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_portal_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          favorite_categories: string[] | null
          favorite_genres: Json | null
          favorite_neighborhoods: string[] | null
          favorite_vibes: string[] | null
          hide_adult_content: boolean | null
          needs_accessibility: string[] | null
          needs_dietary: string[] | null
          needs_family: string[] | null
          notification_settings: Json | null
          price_preference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          favorite_categories?: string[] | null
          favorite_genres?: Json | null
          favorite_neighborhoods?: string[] | null
          favorite_vibes?: string[] | null
          hide_adult_content?: boolean | null
          needs_accessibility?: string[] | null
          needs_dietary?: string[] | null
          needs_family?: string[] | null
          notification_settings?: Json | null
          price_preference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          favorite_categories?: string[] | null
          favorite_genres?: Json | null
          favorite_neighborhoods?: string[] | null
          favorite_vibes?: string[] | null
          hide_adult_content?: boolean | null
          needs_accessibility?: string[] | null
          needs_dietary?: string[] | null
          needs_family?: string[] | null
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
      user_recent_searches: {
        Row: {
          created_at: string
          filters: Json | null
          id: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filters?: Json | null
          id?: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json | null
          id?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      user_regular_spots: {
        Row: {
          added_at: string
          user_id: string
          venue_id: number
        }
        Insert: {
          added_at?: string
          user_id: string
          venue_id: number
        }
        Update: {
          added_at?: string
          user_id?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_regular_spots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_regular_spots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      user_series_subscriptions: {
        Row: {
          portal_id: string
          series_id: string
          subscribed_at: string | null
          user_id: string
        }
        Insert: {
          portal_id: string
          series_id: string
          subscribed_at?: string | null
          user_id: string
        }
        Update: {
          portal_id?: string
          series_id?: string
          subscribed_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_series_subscriptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "user_series_subscriptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "user_series_subscriptions_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_series_subscriptions_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      user_volunteer_profile: {
        Row: {
          availability_windows: Json
          causes: string[]
          commitment_preference: string | null
          languages: string[]
          mobility_constraints: string | null
          skills: string[]
          travel_radius_km: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_windows?: Json
          causes?: string[]
          commitment_preference?: string | null
          languages?: string[]
          mobility_constraints?: string | null
          skills?: string[]
          travel_radius_km?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_windows?: Json
          causes?: string[]
          commitment_preference?: string | null
          languages?: string[]
          mobility_constraints?: string | null
          skills?: string[]
          travel_radius_km?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_volunteer_profile_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      username_reservations: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          username: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          username?: string
        }
        Relationships: []
      }
      venue_destination_details: {
        Row: {
          accessibility_notes: string | null
          best_seasons: string[] | null
          best_time_of_day: string | null
          commitment_tier: string | null
          conditions_notes: string | null
          destination_type: string | null
          difficulty_level: string | null
          dog_friendly: boolean | null
          drive_time_minutes: number | null
          elevation_gain_ft: number | null
          family_suitability: string | null
          fee_note: string | null
          kid_friendly: boolean | null
          metadata: Json
          parking_capacity: number | null
          parking_type: string | null
          permit_required: boolean | null
          place_id: number
          practical_notes: string | null
          primary_activity: string | null
          reservation_required: boolean | null
          seasonal_availability: string[] | null
          seasonal_hazards: string[] | null
          source_url: string | null
          surface_type: string | null
          trail_length_miles: number | null
          updated_at: string
          weather_fit_tags: string[] | null
        }
        Insert: {
          accessibility_notes?: string | null
          best_seasons?: string[] | null
          best_time_of_day?: string | null
          commitment_tier?: string | null
          conditions_notes?: string | null
          destination_type?: string | null
          difficulty_level?: string | null
          dog_friendly?: boolean | null
          drive_time_minutes?: number | null
          elevation_gain_ft?: number | null
          family_suitability?: string | null
          fee_note?: string | null
          kid_friendly?: boolean | null
          metadata?: Json
          parking_capacity?: number | null
          parking_type?: string | null
          permit_required?: boolean | null
          place_id: number
          practical_notes?: string | null
          primary_activity?: string | null
          reservation_required?: boolean | null
          seasonal_availability?: string[] | null
          seasonal_hazards?: string[] | null
          source_url?: string | null
          surface_type?: string | null
          trail_length_miles?: number | null
          updated_at?: string
          weather_fit_tags?: string[] | null
        }
        Update: {
          accessibility_notes?: string | null
          best_seasons?: string[] | null
          best_time_of_day?: string | null
          commitment_tier?: string | null
          conditions_notes?: string | null
          destination_type?: string | null
          difficulty_level?: string | null
          dog_friendly?: boolean | null
          drive_time_minutes?: number | null
          elevation_gain_ft?: number | null
          family_suitability?: string | null
          fee_note?: string | null
          kid_friendly?: boolean | null
          metadata?: Json
          parking_capacity?: number | null
          parking_type?: string | null
          permit_required?: boolean | null
          place_id?: number
          practical_notes?: string | null
          primary_activity?: string | null
          reservation_required?: boolean | null
          seasonal_availability?: string[] | null
          seasonal_hazards?: string[] | null
          source_url?: string | null
          surface_type?: string | null
          trail_length_miles?: number | null
          updated_at?: string
          weather_fit_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_destination_details_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: true
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_enrichment_log: {
        Row: {
          created_at: string | null
          enrichment_type: string
          error_message: string | null
          fields_updated: string[] | null
          id: number
          previous_values: Json | null
          ran_by: string | null
          source: string | null
          status: string
          venue_id: number
        }
        Insert: {
          created_at?: string | null
          enrichment_type: string
          error_message?: string | null
          fields_updated?: string[] | null
          id?: never
          previous_values?: Json | null
          ran_by?: string | null
          source?: string | null
          status?: string
          venue_id: number
        }
        Update: {
          created_at?: string | null
          enrichment_type?: string
          error_message?: string | null
          fields_updated?: string[] | null
          id?: never
          previous_values?: Json | null
          ran_by?: string | null
          source?: string | null
          status?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_enrichment_log_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_enrichment_proposals: {
        Row: {
          agent_id: string | null
          batch_id: string | null
          confidence: number | null
          created_at: string | null
          current_value: string | null
          field_name: string
          id: number
          proposed_value: string
          reasoning: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: string
          status: string
          venue_id: number
        }
        Insert: {
          agent_id?: string | null
          batch_id?: string | null
          confidence?: number | null
          created_at?: string | null
          current_value?: string | null
          field_name: string
          id?: never
          proposed_value: string
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          venue_id: number
        }
        Update: {
          agent_id?: string | null
          batch_id?: string | null
          confidence?: number | null
          created_at?: string | null
          current_value?: string | null
          field_name?: string
          id?: never
          proposed_value?: string
          reasoning?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string
          status?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_enrichment_proposals_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_features: {
        Row: {
          admission_type: string | null
          admission_url: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          feature_type: string
          id: number
          image_url: string | null
          is_active: boolean | null
          is_free: boolean | null
          is_seasonal: boolean | null
          metadata: Json
          place_id: number
          portal_id: string | null
          price_note: string | null
          slug: string
          sort_order: number | null
          source_id: number | null
          source_url: string | null
          start_date: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          admission_type?: string | null
          admission_url?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          feature_type?: string
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          is_free?: boolean | null
          is_seasonal?: boolean | null
          metadata?: Json
          place_id: number
          portal_id?: string | null
          price_note?: string | null
          slug: string
          sort_order?: number | null
          source_id?: number | null
          source_url?: string | null
          start_date?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          admission_type?: string | null
          admission_url?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          feature_type?: string
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          is_free?: boolean | null
          is_seasonal?: boolean | null
          metadata?: Json
          place_id?: number
          portal_id?: string | null
          price_note?: string | null
          slug?: string
          sort_order?: number | null
          source_id?: number | null
          source_url?: string | null
          start_date?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_features_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "venue_features_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "venue_features_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_features_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "venue_features_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "venue_features_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_features_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_highlights: {
        Row: {
          created_at: string | null
          description: string | null
          highlight_type: string
          id: number
          image_url: string | null
          place_id: number
          sort_order: number | null
          title: string
          url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          highlight_type: string
          id?: never
          image_url?: string | null
          place_id: number
          sort_order?: number | null
          title: string
          url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          highlight_type?: string
          id?: never
          image_url?: string | null
          place_id?: number
          sort_order?: number | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_highlights_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
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
          suggested_label: string
          suggested_tag_group: string
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
          suggested_label: string
          suggested_tag_group: string
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
          suggested_label?: string
          suggested_tag_group?: string
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
            referencedRelation: "places"
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
            referencedRelation: "place_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_engagements: {
        Row: {
          created_at: string
          event_id: number | null
          id: string
          note: string | null
          opportunity_id: string
          portal_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: number | null
          id?: string
          note?: string | null
          opportunity_id: string
          portal_id?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: number | null
          id?: string
          note?: string | null
          opportunity_id?: string
          portal_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_engagements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_engagements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_engagements_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "volunteer_opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_engagements_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "volunteer_engagements_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "volunteer_engagements_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_engagements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_opportunities: {
        Row: {
          accessibility_notes: string | null
          application_url: string
          background_check_required: boolean
          capacity_remaining: number | null
          capacity_total: number | null
          commitment_level: string
          created_at: string
          description: string | null
          ends_on: string | null
          event_id: number | null
          family_friendly: boolean
          group_friendly: boolean
          id: string
          is_active: boolean
          language_support: string[]
          location_summary: string | null
          metadata: Json
          min_age: number | null
          onboarding_level: string | null
          organization_id: string
          physical_demand: string | null
          portal_id: string | null
          remote_allowed: boolean
          schedule_summary: string | null
          skills_required: string[]
          slug: string
          source_id: number | null
          source_url: string | null
          starts_on: string | null
          summary: string | null
          time_horizon: string | null
          title: string
          training_required: boolean
          updated_at: string
          urgency_level: string
        }
        Insert: {
          accessibility_notes?: string | null
          application_url: string
          background_check_required?: boolean
          capacity_remaining?: number | null
          capacity_total?: number | null
          commitment_level: string
          created_at?: string
          description?: string | null
          ends_on?: string | null
          event_id?: number | null
          family_friendly?: boolean
          group_friendly?: boolean
          id?: string
          is_active?: boolean
          language_support?: string[]
          location_summary?: string | null
          metadata?: Json
          min_age?: number | null
          onboarding_level?: string | null
          organization_id: string
          physical_demand?: string | null
          portal_id?: string | null
          remote_allowed?: boolean
          schedule_summary?: string | null
          skills_required?: string[]
          slug: string
          source_id?: number | null
          source_url?: string | null
          starts_on?: string | null
          summary?: string | null
          time_horizon?: string | null
          title: string
          training_required?: boolean
          updated_at?: string
          urgency_level?: string
        }
        Update: {
          accessibility_notes?: string | null
          application_url?: string
          background_check_required?: boolean
          capacity_remaining?: number | null
          capacity_total?: number | null
          commitment_level?: string
          created_at?: string
          description?: string | null
          ends_on?: string | null
          event_id?: number | null
          family_friendly?: boolean
          group_friendly?: boolean
          id?: string
          is_active?: boolean
          language_support?: string[]
          location_summary?: string | null
          metadata?: Json
          min_age?: number | null
          onboarding_level?: string | null
          organization_id?: string
          physical_demand?: string | null
          portal_id?: string | null
          remote_allowed?: boolean
          schedule_summary?: string | null
          skills_required?: string[]
          slug?: string
          source_id?: number | null
          source_url?: string | null
          starts_on?: string | null
          summary?: string | null
          time_horizon?: string | null
          title?: string
          training_required?: boolean
          updated_at?: string
          urgency_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_opportunities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_opportunities_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_opportunities_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "volunteer_opportunities_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "volunteer_opportunities_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_opportunities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "volunteer_opportunities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "volunteer_opportunities_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      walkable_neighbors: {
        Row: {
          distance_miles: number
          neighbor_place_id: number
          place_id: number
          walk_minutes: number
        }
        Insert: {
          distance_miles: number
          neighbor_place_id: number
          place_id: number
          walk_minutes: number
        }
        Update: {
          distance_miles?: number
          neighbor_place_id?: number
          place_id?: number
          walk_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "walkable_neighbors_neighbor_id_fkey"
            columns: ["neighbor_place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkable_neighbors_venue_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_venue_inventory_snapshots: {
        Row: {
          arrival_date: string | null
          captured_at: string | null
          captured_for_date: string | null
          created_at: string | null
          id: string | null
          inventory_scope: string | null
          metadata: Json | null
          nights: number | null
          provider_id: string | null
          records: Json | null
          sample_sites: Json | null
          source_url: string | null
          total_results: number | null
          updated_at: string | null
          venue_id: number | null
          window_label: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_inventory_snapshots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      entity_tag_summary: {
        Row: {
          confirm_count: number | null
          deny_count: number | null
          entity_id: number | null
          entity_type: string | null
          entity_types: string[] | null
          is_official: boolean | null
          score: number | null
          tag_group: string | null
          tag_id: string | null
          tag_label: string | null
          tag_slug: string | null
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string | null
          event_id: number | null
          portal_id: string | null
          status: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_invitees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_anchor_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_anchor_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "plans_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "plans_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      events_deduplicated: {
        Row: {
          attendee_count: number | null
          canonical_event_id: number | null
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
          tags: string[] | null
          ticket_url: string | null
          title: string | null
          updated_at: string | null
          venue_id: number | null
        }
        Insert: {
          attendee_count?: number | null
          canonical_event_id?: number | null
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
          tags?: string[] | null
          ticket_url?: string | null
          title?: string | null
          updated_at?: string | null
          venue_id?: number | null
        }
        Update: {
          attendee_count?: number | null
          canonical_event_id?: number | null
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
            foreignKeyName: "events_place_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
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
            referencedRelation: "portal_source_entity_access"
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
            referencedRelation: "organizations"
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
            referencedRelation: "portal_source_entity_access"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "events_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
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
      portal_source_entity_access: {
        Row: {
          access_type: string | null
          entity_family: string | null
          portal_id: string | null
          source_id: number | null
          source_name: string | null
        }
        Relationships: []
      }
      search_suggestions: {
        Row: {
          city: string | null
          entity_id: string | null
          entity_type: string | null
          frequency: number | null
          match_text: string | null
          text: string | null
          type: string | null
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
      venue_genre_inference: {
        Row: {
          event_count: number | null
          genre: string | null
          recent_count: number | null
          venue_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_place_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_tag_summary: {
        Row: {
          add_count: number | null
          downvote_count: number | null
          entity_type: string | null
          is_official: boolean | null
          score: number | null
          tag_group: string | null
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
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _portal_id: { Args: never; Returns: string }
      _portal_source_ids: { Args: never; Returns: number[] }
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      aggregate_daily_analytics: {
        Args: { target_date?: string }
        Returns: undefined
      }
      are_friends: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      best_of_case_counts: {
        Args: { p_category_id: string }
        Returns: {
          case_count: number
          upvote_sum: number
          venue_id: number
        }[]
      }
      best_of_top_cases: {
        Args: { p_category_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          upvote_count: number
          user_id: string
          venue_id: number
        }[]
      }
      best_of_total_votes: { Args: { p_category_id: string }; Returns: number }
      best_of_vote_counts_by_category: {
        Args: { p_category_ids: string[] }
        Returns: {
          category_id: string
          vote_count: number
        }[]
      }
      best_of_vote_counts_by_venue: {
        Args: { p_category_id: string }
        Returns: {
          venue_id: number
          vote_count: number
        }[]
      }
      calculate_trending_events: { Args: never; Returns: undefined }
      check_and_reserve_username: {
        Args: { p_reservation_ttl?: string; p_username: string }
        Returns: {
          available: boolean
          reservation_id: string
        }[]
      }
      cleanup_expired_hangs: { Args: never; Returns: number }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      count_open_spots: {
        Args: { p_city?: string; p_venue_types?: string[] }
        Returns: number
      }
      create_friendship: {
        Args: { user_a: string; user_b: string }
        Returns: string
      }
      delete_friendship: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      disablelongtransactions: { Args: never; Returns: string }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      expire_stale_plans: {
        Args: never
        Returns: {
          expired_count: number
        }[]
      }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_explore_home_counts: {
        Args: {
          p_city_filter?: string
          p_portal_id?: string
          p_source_ids?: number[]
          p_today?: string
          p_week_end?: string
          p_weekend_end?: string
          p_weekend_start?: string
        }
        Returns: Json
      }
      get_follower_count: { Args: { target_user_id: string }; Returns: number }
      get_following_count: { Args: { target_user_id: string }; Returns: number }
      get_friend_count: { Args: { target_user_id: string }; Returns: number }
      get_friend_ids: {
        Args: { user_id: string }
        Returns: {
          friend_id: string
        }[]
      }
      get_itinerary_crew: { Args: { p_itinerary_id: string }; Returns: Json }
      get_metro_cities: { Args: { p_city: string }; Returns: string[] }
      get_neighborhood_activity: {
        Args: { p_city_names?: string[]; p_portal_id?: string }
        Returns: {
          editorial_mention_count: number
          events_today: number
          events_week: number
          neighborhood: string
          occasion_type_count: number
          venue_count: number
        }[]
      }
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
      get_public_profile: {
        Args: { p_username: string; p_viewer_id?: string }
        Returns: Json
      }
      get_right_now_feed: {
        Args: { p_city?: string; p_limit?: number; p_portal_id?: string }
        Returns: {
          category_id: string
          closes_at: string
          entity_type: string
          google_rating: number
          google_rating_count: number
          id: number
          image_url: string
          is_free: boolean
          is_open: boolean
          name: string
          neighborhood: string
          place_type: string
          price_min: number
          relevance_score: number
          short_description: string
          slug: string
          start_date: string
          start_time: string
          venue_name: string
        }[]
      }
      get_search_facets: {
        Args: { p_city?: string; p_portal_id?: string; p_query: string }
        Returns: {
          count: number
          entity_type: string
        }[]
      }
      get_similar_suggestions: {
        Args: {
          p_city?: string
          p_limit?: number
          p_min_similarity?: number
          p_query: string
        }
        Returns: {
          frequency: number
          similarity_score: number
          suggestion: string
          type: string
        }[]
      }
      get_social_proof_counts: {
        Args: { event_ids: number[] }
        Returns: {
          event_id: number
          going_count: number
          interested_count: number
          recommendation_count: number
        }[]
      }
      get_source_quality_metrics: {
        Args: { p_min_events?: number; p_start_date?: string }
        Returns: {
          avg_quality: number
          held_events: number
          held_pct: number
          is_active: boolean
          missing_description: number
          missing_image: number
          source_id: number
          source_name: string
          source_slug: string
          total_events: number
        }[]
      }
      get_spelling_suggestions:
        | {
            Args: { p_city?: string; p_limit?: number; p_query: string }
            Returns: {
              similarity_score: number
              suggestion: string
              type: string
            }[]
          }
        | {
            Args: {
              p_city?: string
              p_limit?: number
              p_min_similarity?: number
              p_query: string
            }
            Returns: {
              similarity_score: number
              suggestion: string
              type: string
            }[]
          }
      get_spot_event_counts: {
        Args: {
          p_city_names?: string[]
          p_end_date: string
          p_limit?: number
          p_portal_id?: string
          p_start_date: string
        }
        Returns: {
          event_count: number
          place_id: number
        }[]
      }
      get_user_trust_score: { Args: { user_id: string }; Returns: number }
      get_venue_type_counts: {
        Args: { p_city?: string }
        Returns: {
          cnt: number
          place_type: string
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      has_pending_friend_request: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      insert_recent_search: {
        Args: {
          p_filters: Json
          p_max_rows: number
          p_query: string
          p_user_id: string
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_blocked: { Args: { user_a: string; user_b: string }; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      is_itinerary_member: {
        Args: { p_itinerary_id: string; p_user_id: string }
        Returns: boolean
      }
      is_profile_complete: { Args: { p_user_id: string }; Returns: boolean }
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
      isnt_empty: { Args: { "": string }; Returns: string }
      lives_ok: { Args: { "": string }; Returns: string }
      longtransactionsenabled: { Args: never; Returns: boolean }
      merge_places: {
        Args: { p_drop_id: number; p_keep_id: number }
        Returns: undefined
      }
      no_plan: { Args: never; Returns: boolean[] }
      normalize_event_title: { Args: { title: string }; Returns: string }
      normalize_search_term: { Args: { p_input: string }; Returns: string }
      normalize_venue_for_dedup: {
        Args: { venue_name: string }
        Returns: string
      }
      notification_setting_enabled: {
        Args: {
          default_enabled?: boolean
          setting_key: string
          target_user_id: string
        }
        Returns: boolean
      }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      portal_can_access_event: {
        Args: {
          p_category_id: string
          p_portal_id: string
          p_source_id: number
        }
        Returns: boolean
      }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      rebuild_entity_search_terms: { Args: never; Returns: undefined }
      rebuild_entity_search_terms_scoped: {
        Args: { p_city?: string; p_full?: boolean; p_since?: string }
        Returns: undefined
      }
      refresh_available_filters: { Args: never; Returns: undefined }
      refresh_entity_tag_summary: { Args: never; Returns: undefined }
      refresh_feed_counts: { Args: { p_portal_id: string }; Returns: undefined }
      refresh_feed_events_ready: {
        Args: { p_portal_id?: string }
        Returns: number
      }
      refresh_portal_source_access: { Args: never; Returns: undefined }
      refresh_search_suggestions: { Args: never; Returns: undefined }
      refresh_search_suggestions_incremental: {
        Args: { p_city?: string; p_since?: string }
        Returns: undefined
      }
      release_username_reservation: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      search_events_ranked: {
        Args: {
          p_categories?: string[]
          p_date_filter?: string
          p_genres?: string[]
          p_is_free?: boolean
          p_limit?: number
          p_neighborhoods?: string[]
          p_offset?: number
          p_portal_id?: string
          p_query: string
          p_subcategories?: string[]
          p_tags?: string[]
        }
        Returns: {
          category: string
          combined_score: number
          description: string
          end_date: string
          end_time: string
          genres: string[]
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
      search_exhibitions_ranked: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_portal_id?: string
          p_query: string
        }
        Returns: {
          admission_type: string
          closing_date: string
          combined_score: number
          description: string
          exhibition_type: string
          id: string
          image_url: string
          opening_date: string
          place_id: number
          slug: string
          title: string
          venue_name: string
          venue_neighborhood: string
        }[]
      }
      search_organizations_ranked: {
        Args: {
          p_categories?: string[]
          p_limit?: number
          p_offset?: number
          p_org_types?: string[]
          p_portal_id?: string
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
      search_producers_ranked: {
        Args: {
          p_categories?: string[]
          p_limit?: number
          p_offset?: number
          p_org_types?: string[]
          p_portal_id?: string
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
      search_programs_ranked: {
        Args: {
          p_age_max?: number
          p_age_min?: number
          p_categories?: string[]
          p_limit?: number
          p_offset?: number
          p_portal_id?: string
          p_program_type?: string
          p_query: string
        }
        Returns: {
          age_max: number
          age_min: number
          combined_score: number
          cost_amount: number
          cost_period: string
          description: string
          id: string
          image_url: string
          name: string
          portal_id: string
          program_type: string
          provider_name: string
          registration_status: string
          registration_url: string
          season: string
          session_end: string
          session_start: string
          similarity_score: number
          slug: string
          tags: string[]
          ts_rank: number
          venue_id: number
          venue_name: string
          venue_neighborhood: string
          venue_slug: string
        }[]
      }
      search_series_ranked: {
        Args: {
          p_categories?: string[]
          p_limit?: number
          p_offset?: number
          p_portal_id?: string
          p_query: string
        }
        Returns: {
          category: string
          combined_score: number
          description: string
          id: string
          image_url: string
          next_event_date: string
          series_type: string
          similarity_score: number
          slug: string
          title: string
          ts_rank: number
          upcoming_event_count: number
        }[]
      }
      search_term_alias_candidates: {
        Args: { p_display_term: string; p_slug?: string }
        Returns: string[]
      }
      search_unified: {
        Args: {
          p_categories?: string[]
          p_date_from?: string
          p_date_to?: string
          p_free_only?: boolean
          p_limit_per_retriever?: number
          p_neighborhoods?: string[]
          p_portal_id: string
          p_query: string
          p_types: string[]
        }
        Returns: {
          days_out: number
          entity_id: string
          entity_type: string
          href_slug: string
          image_url: string
          neighborhood: string
          quality: number
          raw_score: number
          retriever_id: string
          starts_at: string
          title: string
          venue_name: string
        }[]
      }
      search_venues_ranked: {
        Args: {
          p_city?: string
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
          data_quality: number
          description: string
          explore_featured: boolean
          featured: boolean
          id: number
          image_url: string
          is_event_venue: boolean
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
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
      unaccent: { Args: { "": string }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      update_live_events: { Args: never; Returns: undefined }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      venue_generic_search_term_candidates: {
        Args: { p_display_term: string }
        Returns: string[]
      }
      venue_search_term_weight:
        | {
            Args: {
              p_data_quality?: number
              p_explore_featured?: boolean
              p_featured?: boolean
              p_has_active_children: boolean
              p_parent_venue_id?: number
            }
            Returns: number
          }
        | {
            Args: {
              p_data_quality?: number
              p_explore_featured?: boolean
              p_featured?: boolean
              p_has_active_children: boolean
              p_parent_venue_id?: number
            }
            Returns: number
          }
    }
    Enums: {
      music_programming_style_enum:
        | "listening_room"
        | "curated_indie"
        | "jazz_club"
        | "dj_electronic"
        | "drive_in_amph"
        | "marquee"
      place_candidate_status: "pending" | "promoted" | "rejected" | "deferred"
      premiere_scope_enum: "atl" | "us" | "world"
      programming_style_enum:
        | "repertory"
        | "indie"
        | "arthouse"
        | "drive_in"
        | "festival"
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
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
    Enums: {
      music_programming_style_enum: [
        "listening_room",
        "curated_indie",
        "jazz_club",
        "dj_electronic",
        "drive_in_amph",
        "marquee",
      ],
      place_candidate_status: ["pending", "promoted", "rejected", "deferred"],
      premiere_scope_enum: ["atl", "us", "world"],
      programming_style_enum: [
        "repertory",
        "indie",
        "arthouse",
        "drive_in",
        "festival",
      ],
    },
  },
} as const
