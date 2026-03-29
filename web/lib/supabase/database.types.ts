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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
      artists: {
        Row: {
          bio: string | null
          created_at: string | null
          deezer_id: number | null
          discipline: string
          genres: string[] | null
          hometown: string | null
          id: string
          image_url: string | null
          imdb_id: string | null
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
          created_at?: string | null
          deezer_id?: number | null
          discipline?: string
          genres?: string[] | null
          hometown?: string | null
          id?: string
          image_url?: string | null
          imdb_id?: string | null
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
          created_at?: string | null
          deezer_id?: number | null
          discipline?: string
          genres?: string[] | null
          hometown?: string | null
          id?: string
          image_url?: string | null
          imdb_id?: string | null
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "best_of_cases_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "best_of_contests_winner_venue_id_fkey"
            columns: ["winner_venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "best_of_contests_winner_venue_id_fkey"
            columns: ["winner_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "best_of_nominations_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "best_of_votes_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
          published_at: string | null
          snippet: string | null
          source_key: string
          updated_at: string
          venue_id: number | null
        }
        Insert: {
          article_title: string
          article_url: string
          created_at?: string
          guide_name?: string | null
          id?: number
          is_active?: boolean
          mention_type?: string
          published_at?: string | null
          snippet?: string | null
          source_key: string
          updated_at?: string
          venue_id?: number | null
        }
        Update: {
          article_title?: string
          article_url?: string
          created_at?: string
          guide_name?: string | null
          id?: number
          is_active?: boolean
          mention_type?: string
          published_at?: string | null
          snippet?: string | null
          source_key?: string
          updated_at?: string
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "editorial_mentions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "editorial_mentions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "portals"
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
      event_rsvps: {
        Row: {
          created_at: string | null
          engagement_target: string
          event_id: number
          festival_id: string | null
          id: string
          portal_id: string | null
          program_id: string | null
          status: string
          updated_at: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          engagement_target?: string
          event_id: number
          festival_id?: string | null
          id?: string
          portal_id?: string | null
          program_id?: string | null
          status: string
          updated_at?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          engagement_target?: string
          event_id?: number
          festival_id?: string | null
          id?: string
          portal_id?: string | null
          program_id?: string | null
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
            foreignKeyName: "event_rsvps_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "event_rsvps_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "series"
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
          age_max: number | null
          age_min: number | null
          age_policy: string | null
          attendee_count: number | null
          blurhash: string | null
          canonical_event_id: number | null
          capacity: number | null
          category_id: string | null
          class_category: string | null
          content_hash: string | null
          content_kind: string
          created_at: string | null
          data_quality: number | null
          description: string | null
          doors_time: string | null
          end_date: string | null
          end_time: string | null
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
          image_url: string | null
          instructor: string | null
          is_active: boolean
          is_adult: boolean | null
          is_all_day: boolean | null
          is_class: boolean | null
          is_featured: boolean | null
          is_feed_ready: boolean | null
          is_free: boolean | null
          is_live: boolean | null
          is_recurring: boolean | null
          is_regular_ready: boolean | null
          is_sensitive: boolean | null
          is_tentpole: boolean | null
          is_trending: boolean | null
          organization_id: string | null
          portal_id: string | null
          price_max: number | null
          price_min: number | null
          price_note: string | null
          raw_text: string | null
          recurrence_rule: string | null
          reentry_policy: string | null
          search_vector: unknown
          series_id: string | null
          set_times_mentioned: boolean
          skill_level: string | null
          source_id: number | null
          source_type: string | null
          source_url: string
          start_date: string
          start_time: string | null
          submitted_by: string | null
          tags: string[] | null
          ticket_status: string | null
          ticket_url: string | null
          title: string
          updated_at: string | null
          venue_id: number | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          age_policy?: string | null
          attendee_count?: number | null
          blurhash?: string | null
          canonical_event_id?: number | null
          capacity?: number | null
          category_id?: string | null
          class_category?: string | null
          content_hash?: string | null
          content_kind?: string
          created_at?: string | null
          data_quality?: number | null
          description?: string | null
          doors_time?: string | null
          end_date?: string | null
          end_time?: string | null
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
          image_url?: string | null
          instructor?: string | null
          is_active?: boolean
          is_adult?: boolean | null
          is_all_day?: boolean | null
          is_class?: boolean | null
          is_featured?: boolean | null
          is_feed_ready?: boolean | null
          is_free?: boolean | null
          is_live?: boolean | null
          is_recurring?: boolean | null
          is_regular_ready?: boolean | null
          is_sensitive?: boolean | null
          is_tentpole?: boolean | null
          is_trending?: boolean | null
          organization_id?: string | null
          portal_id?: string | null
          price_max?: number | null
          price_min?: number | null
          price_note?: string | null
          raw_text?: string | null
          recurrence_rule?: string | null
          reentry_policy?: string | null
          search_vector?: unknown
          series_id?: string | null
          set_times_mentioned?: boolean
          skill_level?: string | null
          source_id?: number | null
          source_type?: string | null
          source_url: string
          start_date: string
          start_time?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          ticket_status?: string | null
          ticket_url?: string | null
          title: string
          updated_at?: string | null
          venue_id?: number | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          age_policy?: string | null
          attendee_count?: number | null
          blurhash?: string | null
          canonical_event_id?: number | null
          capacity?: number | null
          category_id?: string | null
          class_category?: string | null
          content_hash?: string | null
          content_kind?: string
          created_at?: string | null
          data_quality?: number | null
          description?: string | null
          doors_time?: string | null
          end_date?: string | null
          end_time?: string | null
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
          image_url?: string | null
          instructor?: string | null
          is_active?: boolean
          is_adult?: boolean | null
          is_all_day?: boolean | null
          is_class?: boolean | null
          is_featured?: boolean | null
          is_feed_ready?: boolean | null
          is_free?: boolean | null
          is_live?: boolean | null
          is_recurring?: boolean | null
          is_regular_ready?: boolean | null
          is_sensitive?: boolean | null
          is_tentpole?: boolean | null
          is_trending?: boolean | null
          organization_id?: string | null
          portal_id?: string | null
          price_max?: number | null
          price_min?: number | null
          price_note?: string | null
          raw_text?: string | null
          recurrence_rule?: string | null
          reentry_policy?: string | null
          search_vector?: unknown
          series_id?: string | null
          set_times_mentioned?: boolean
          skill_level?: string | null
          source_id?: number | null
          source_type?: string | null
          source_url?: string
          start_date?: string
          start_time?: string | null
          submitted_by?: string | null
          tags?: string[] | null
          ticket_status?: string | null
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
            foreignKeyName: "events_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
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
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "explore_tips_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "explore_track_venues_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
      hangs: {
        Row: {
          auto_expire_at: string
          created_at: string
          ended_at: string | null
          event_id: number | null
          id: string
          note: string | null
          planned_for: string | null
          portal_id: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
          venue_id: number
          visibility: string
        }
        Insert: {
          auto_expire_at?: string
          created_at?: string
          ended_at?: string | null
          event_id?: number | null
          id?: string
          note?: string | null
          planned_for?: string | null
          portal_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
          venue_id: number
          visibility?: string
        }
        Update: {
          auto_expire_at?: string
          created_at?: string
          ended_at?: string | null
          event_id?: number | null
          id?: string
          note?: string | null
          planned_for?: string | null
          portal_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          venue_id?: number
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "hangs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hangs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hangs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "hangs_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hangs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hangs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "hangs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      itineraries: {
        Row: {
          created_at: string | null
          date: string | null
          description: string | null
          id: string
          is_public: boolean | null
          portal_id: string
          share_token: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          visibility: string
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          portal_id: string
          share_token?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          visibility?: string
        }
        Update: {
          created_at?: string | null
          date?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          portal_id?: string
          share_token?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portal_source_access"
            referencedColumns: ["portal_id"]
          },
          {
            foreignKeyName: "itineraries_portal_id_fkey"
            columns: ["portal_id"]
            isOneToOne: false
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          created_at: string | null
          custom_address: string | null
          custom_description: string | null
          custom_lat: number | null
          custom_lng: number | null
          custom_title: string | null
          duration_minutes: number | null
          event_id: number | null
          id: string
          item_type: string
          itinerary_id: string
          notes: string | null
          position: number
          start_time: string | null
          transit_mode: string | null
          venue_id: number | null
          walk_distance_meters: number | null
          walk_time_minutes: number | null
        }
        Insert: {
          created_at?: string | null
          custom_address?: string | null
          custom_description?: string | null
          custom_lat?: number | null
          custom_lng?: number | null
          custom_title?: string | null
          duration_minutes?: number | null
          event_id?: number | null
          id?: string
          item_type: string
          itinerary_id: string
          notes?: string | null
          position?: number
          start_time?: string | null
          transit_mode?: string | null
          venue_id?: number | null
          walk_distance_meters?: number | null
          walk_time_minutes?: number | null
        }
        Update: {
          created_at?: string | null
          custom_address?: string | null
          custom_description?: string | null
          custom_lat?: number | null
          custom_lng?: number | null
          custom_title?: string | null
          duration_minutes?: number | null
          event_id?: number | null
          id?: string
          item_type?: string
          itinerary_id?: string
          notes?: string | null
          position?: number
          start_time?: string | null
          transit_mode?: string | null
          venue_id?: number | null
          walk_distance_meters?: number | null
          walk_time_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "itinerary_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_participant_stops: {
        Row: {
          arrival_time: string | null
          id: string
          item_id: string
          note: string | null
          participant_id: string
          status: string
          updated_at: string
        }
        Insert: {
          arrival_time?: string | null
          id?: string
          item_id: string
          note?: string | null
          participant_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          arrival_time?: string | null
          id?: string
          item_id?: string
          note?: string | null
          participant_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_participant_stops_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itinerary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_participant_stops_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "itinerary_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_participants: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          contact: string | null
          id: string
          invited_at: string
          invited_by: string
          itinerary_id: string
          responded_at: string | null
          rsvp_status: string
          user_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          contact?: string | null
          id?: string
          invited_at?: string
          invited_by: string
          itinerary_id: string
          responded_at?: string | null
          rsvp_status?: string
          user_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          contact?: string | null
          id?: string
          invited_at?: string
          invited_by?: string
          itinerary_id?: string
          responded_at?: string | null
          rsvp_status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_participants_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_participants_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_participants_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
            foreignKeyName: "notifications_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_items: {
        Row: {
          created_at: string | null
          event_id: number | null
          id: string
          note: string | null
          plan_id: string
          sort_order: number
          start_time: string | null
          title: string
          venue_id: number | null
        }
        Insert: {
          created_at?: string | null
          event_id?: number | null
          id?: string
          note?: string | null
          plan_id: string
          sort_order?: number
          start_time?: string | null
          title: string
          venue_id?: number | null
        }
        Update: {
          created_at?: string | null
          event_id?: number | null
          id?: string
          note?: string | null
          plan_id?: string
          sort_order?: number
          start_time?: string | null
          title?: string
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events_deduplicated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "plan_items_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_participants: {
        Row: {
          created_at: string | null
          id: string
          plan_id: string
          responded_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan_id: string
          responded_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          plan_id?: string
          responded_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_participants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_suggestions: {
        Row: {
          content: Json
          created_at: string | null
          id: string
          plan_id: string
          status: string
          suggestion_type: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string | null
          id?: string
          plan_id: string
          status?: string
          suggestion_type: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string | null
          id?: string
          plan_id?: string
          status?: string
          suggestion_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_suggestions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          creator_id: string
          description: string | null
          id: string
          plan_date: string
          plan_time: string | null
          portal_id: string | null
          share_token: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          description?: string | null
          id?: string
          plan_date: string
          plan_time?: string | null
          portal_id?: string | null
          share_token?: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          description?: string | null
          id?: string
          plan_date?: string
          plan_time?: string | null
          portal_id?: string | null
          share_token?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
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
            referencedRelation: "portals"
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
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
        ]
      }
      portals: {
        Row: {
          account_id: string | null
          branding: Json | null
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
          settings: Json | null
          slug: string
          status: string | null
          tagline: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          account_id?: string | null
          branding?: Json | null
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
          settings?: Json | null
          slug: string
          status?: string | null
          tagline?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          account_id?: string | null
          branding?: Json | null
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
          settings?: Json | null
          slug?: string
          status?: string | null
          tagline?: string | null
          updated_at?: string | null
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
          name: string
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
          season: string | null
          session_end: string | null
          session_start: string | null
          slug: string | null
          source_id: number | null
          status: string
          tags: string[] | null
          updated_at: string
          venue_id: number | null
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
          name: string
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
          season?: string | null
          session_end?: string | null
          session_start?: string | null
          slug?: string | null
          source_id?: number | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          venue_id?: number | null
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
          name?: string
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
          season?: string | null
          session_end?: string | null
          session_start?: string | null
          slug?: string | null
          source_id?: number | null
          status?: string
          tags?: string[] | null
          updated_at?: string
          venue_id?: number | null
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
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "programs_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "series_festival_id_fkey"
            columns: ["festival_id"]
            isOneToOne: false
            referencedRelation: "festivals"
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
          active_months: number[] | null
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "user_regular_spots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
      venue_claims: {
        Row: {
          claimed_at: string | null
          created_at: string | null
          id: number
          portal_id: string | null
          proof_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          user_id: string
          venue_id: number
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string | null
          id?: number
          portal_id?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          updated_at?: string | null
          user_id: string
          venue_id: number
        }
        Update: {
          claimed_at?: string | null
          created_at?: string | null
          id?: number
          portal_id?: string | null
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          venue_id?: number
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
            referencedRelation: "portals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_claims_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_claims_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_enrichment_log_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_enrichment_proposals_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_features: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string | null
          feature_type: string
          id: number
          image_url: string | null
          is_active: boolean | null
          is_free: boolean | null
          is_seasonal: boolean | null
          price_note: string | null
          slug: string
          sort_order: number | null
          start_date: string | null
          title: string
          updated_at: string | null
          url: string | null
          venue_id: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          feature_type?: string
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          is_free?: boolean | null
          is_seasonal?: boolean | null
          price_note?: string | null
          slug: string
          sort_order?: number | null
          start_date?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
          venue_id: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          feature_type?: string
          id?: number
          image_url?: string | null
          is_active?: boolean | null
          is_free?: boolean | null
          is_seasonal?: boolean | null
          price_note?: string | null
          slug?: string
          sort_order?: number | null
          start_date?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_features_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_features_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
          sort_order: number | null
          title: string
          url: string | null
          venue_id: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          highlight_type: string
          id?: never
          image_url?: string | null
          sort_order?: number | null
          title: string
          url?: string | null
          venue_id: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          highlight_type?: string
          id?: never
          image_url?: string | null
          sort_order?: number | null
          title?: string
          url?: string | null
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_highlights_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_highlights_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_inventory_snapshots: {
        Row: {
          arrival_date: string
          captured_at: string
          captured_for_date: string
          created_at: string
          id: string
          inventory_scope: string
          metadata: Json
          nights: number
          provider_id: string
          records: Json
          sample_sites: Json
          source_url: string | null
          total_results: number | null
          updated_at: string
          venue_id: number
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
          provider_id: string
          records?: Json
          sample_sites?: Json
          source_url?: string | null
          total_results?: number | null
          updated_at?: string
          venue_id: number
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
          provider_id?: string
          records?: Json
          sample_sites?: Json
          source_url?: string | null
          total_results?: number | null
          updated_at?: string
          venue_id?: number
          window_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_inventory_snapshots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_inventory_snapshots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_occasions: {
        Row: {
          confidence: number
          created_at: string
          id: number
          occasion: string
          source: string
          venue_id: number
        }
        Insert: {
          confidence?: number
          created_at?: string
          id?: number
          occasion: string
          source?: string
          venue_id: number
        }
        Update: {
          confidence?: number
          created_at?: string
          id?: number
          occasion?: string
          source?: string
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_occasions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_occasions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_specials: {
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
          price_note: string | null
          source_url: string | null
          start_date: string | null
          time_end: string | null
          time_start: string | null
          title: string
          type: string
          updated_at: string | null
          venue_id: number
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
          price_note?: string | null
          source_url?: string | null
          start_date?: string | null
          time_end?: string | null
          time_start?: string | null
          title: string
          type: string
          updated_at?: string | null
          venue_id: number
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
          price_note?: string | null
          source_url?: string | null
          start_date?: string | null
          time_end?: string | null
          time_start?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          venue_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "venue_specials_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_specials_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
          accepts_reservations: boolean | null
          active: boolean | null
          address: string | null
          aliases: string[] | null
          beltline_adjacent: boolean | null
          beltline_segment: string | null
          beltline_walk_minutes: number | null
          blurhash: string | null
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
          instagram: string | null
          is_adult: boolean | null
          is_chain: boolean | null
          is_event_venue: boolean | null
          is_experience: boolean | null
          is_verified: boolean | null
          last_verified_at: string | null
          lat: number | null
          lng: number | null
          location_designator: string
          marta_lines: string[] | null
          marta_walk_minutes: number | null
          meal_duration_max_minutes: number | null
          meal_duration_min_minutes: number | null
          menu_highlights: Json | null
          menu_url: string | null
          name: string
          nearest_marta_station: string | null
          neighborhood: string | null
          organization_id: string | null
          parent_venue_id: number | null
          parking: string[] | null
          parking_free: boolean | null
          parking_note: string | null
          parking_source: string | null
          parking_type: string[] | null
          payment_buffer_minutes: number | null
          payment_notes: string | null
          phone: string | null
          planning_last_verified_at: string | null
          planning_notes: string | null
          price_level: number | null
          reservation_recommended: boolean | null
          reservation_url: string | null
          search_vector: unknown
          service_style: string | null
          short_description: string | null
          slug: string
          spot_type: string | null
          spot_types: string[] | null
          state: string | null
          submitted_by: string | null
          transit_note: string | null
          transit_score: number | null
          typical_duration_minutes: number | null
          typical_price_max: number | null
          typical_price_min: number | null
          venue_type: string | null
          venue_types: string[] | null
          vibes: string[] | null
          walk_in_wait_minutes: number | null
          walkable_neighbor_count: number | null
          website: string | null
          zip: string | null
        }
        Insert: {
          accepts_reservations?: boolean | null
          active?: boolean | null
          address?: string | null
          aliases?: string[] | null
          beltline_adjacent?: boolean | null
          beltline_segment?: string | null
          beltline_walk_minutes?: number | null
          blurhash?: string | null
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
          instagram?: string | null
          is_adult?: boolean | null
          is_chain?: boolean | null
          is_event_venue?: boolean | null
          is_experience?: boolean | null
          is_verified?: boolean | null
          last_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          location_designator?: string
          marta_lines?: string[] | null
          marta_walk_minutes?: number | null
          meal_duration_max_minutes?: number | null
          meal_duration_min_minutes?: number | null
          menu_highlights?: Json | null
          menu_url?: string | null
          name: string
          nearest_marta_station?: string | null
          neighborhood?: string | null
          organization_id?: string | null
          parent_venue_id?: number | null
          parking?: string[] | null
          parking_free?: boolean | null
          parking_note?: string | null
          parking_source?: string | null
          parking_type?: string[] | null
          payment_buffer_minutes?: number | null
          payment_notes?: string | null
          phone?: string | null
          planning_last_verified_at?: string | null
          planning_notes?: string | null
          price_level?: number | null
          reservation_recommended?: boolean | null
          reservation_url?: string | null
          search_vector?: unknown
          service_style?: string | null
          short_description?: string | null
          slug: string
          spot_type?: string | null
          spot_types?: string[] | null
          state?: string | null
          submitted_by?: string | null
          transit_note?: string | null
          transit_score?: number | null
          typical_duration_minutes?: number | null
          typical_price_max?: number | null
          typical_price_min?: number | null
          venue_type?: string | null
          venue_types?: string[] | null
          vibes?: string[] | null
          walk_in_wait_minutes?: number | null
          walkable_neighbor_count?: number | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          accepts_reservations?: boolean | null
          active?: boolean | null
          address?: string | null
          aliases?: string[] | null
          beltline_adjacent?: boolean | null
          beltline_segment?: string | null
          beltline_walk_minutes?: number | null
          blurhash?: string | null
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
          instagram?: string | null
          is_adult?: boolean | null
          is_chain?: boolean | null
          is_event_venue?: boolean | null
          is_experience?: boolean | null
          is_verified?: boolean | null
          last_verified_at?: string | null
          lat?: number | null
          lng?: number | null
          location_designator?: string
          marta_lines?: string[] | null
          marta_walk_minutes?: number | null
          meal_duration_max_minutes?: number | null
          meal_duration_min_minutes?: number | null
          menu_highlights?: Json | null
          menu_url?: string | null
          name?: string
          nearest_marta_station?: string | null
          neighborhood?: string | null
          organization_id?: string | null
          parent_venue_id?: number | null
          parking?: string[] | null
          parking_free?: boolean | null
          parking_note?: string | null
          parking_source?: string | null
          parking_type?: string[] | null
          payment_buffer_minutes?: number | null
          payment_notes?: string | null
          phone?: string | null
          planning_last_verified_at?: string | null
          planning_notes?: string | null
          price_level?: number | null
          reservation_recommended?: boolean | null
          reservation_url?: string | null
          search_vector?: unknown
          service_style?: string | null
          short_description?: string | null
          slug?: string
          spot_type?: string | null
          spot_types?: string[] | null
          state?: string | null
          submitted_by?: string | null
          transit_note?: string | null
          transit_score?: number | null
          typical_duration_minutes?: number | null
          typical_price_max?: number | null
          typical_price_min?: number | null
          venue_type?: string | null
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
            columns: ["parent_venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venues_parent_venue_id_fkey"
            columns: ["parent_venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      walkable_neighbors: {
        Row: {
          distance_miles: number
          neighbor_id: number
          venue_id: number
          walk_minutes: number
        }
        Insert: {
          distance_miles: number
          neighbor_id: number
          venue_id: number
          walk_minutes: number
        }
        Update: {
          distance_miles?: number
          neighbor_id?: number
          venue_id?: number
          walk_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "walkable_neighbors_neighbor_id_fkey"
            columns: ["neighbor_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "walkable_neighbors_neighbor_id_fkey"
            columns: ["neighbor_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "walkable_neighbors_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "walkable_neighbors_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      best_of_venue_scores: {
        Row: {
          algorithm_score: number | null
          venue_id: number | null
        }
        Relationships: []
      }
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
          },
          {
            foreignKeyName: "venue_inventory_snapshots_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
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
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
      portal_attribution_audit: {
        Row: {
          missing_portal: number | null
          pct_missing: number | null
          table_name: string | null
          total: number | null
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
      venue_genre_inference: {
        Row: {
          event_count: number | null
          genre: string | null
          recent_count: number | null
          venue_id: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
            referencedRelation: "best_of_venue_scores"
            referencedColumns: ["venue_id"]
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
    }
    Functions: {
      _portal_id: { Args: never; Returns: string }
      _portal_source_ids: { Args: never; Returns: number[] }
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
      create_friendship: {
        Args: { user_a: string; user_b: string }
        Returns: string
      }
      delete_friendship: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      end_and_start_hang: {
        Args: {
          p_auto_expire_at: string
          p_event_id: number
          p_note: string
          p_portal_id: string
          p_user_id: string
          p_venue_id: number
          p_visibility: string
        }
        Returns: {
          auto_expire_at: string
          created_at: string
          ended_at: string
          event_id: number
          id: string
          note: string
          planned_for: string
          portal_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
          venue_id: number
          visibility: string
        }[]
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
      get_friends_active_hangs: {
        Args: { p_user_id: string }
        Returns: {
          auto_expire_at: string
          created_at: string
          ended_at: string
          event_id: number
          id: string
          note: string
          planned_for: string
          portal_id: string
          profile_avatar_url: string
          profile_display_name: string
          profile_username: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
          venue_id: number
          venue_image_url: string
          venue_name: string
          venue_neighborhood: string
          venue_slug: string
          visibility: string
        }[]
      }
      get_hot_venues: {
        Args: { p_limit?: number; p_portal_id: string }
        Returns: {
          active_count: number
          venue_id: number
          venue_image_url: string
          venue_name: string
          venue_neighborhood: string
          venue_slug: string
        }[]
      }
      get_itinerary_crew: { Args: { p_itinerary_id: string }; Returns: Json }
      get_metro_cities: { Args: { p_city: string }; Returns: string[] }
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
      get_spelling_suggestions: {
        Args: { p_city?: string; p_limit?: number; p_query: string }
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
      get_venue_hang_counts: {
        Args: { p_portal_id: string; p_venue_ids: number[] }
        Returns: {
          active_count: number
          venue_id: number
        }[]
      }
      has_pending_friend_request: {
        Args: { user_a: string; user_b: string }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_blocked: { Args: { user_a: string; user_b: string }; Returns: boolean }
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
      portal_can_access_event: {
        Args: {
          p_category_id: string
          p_portal_id: string
          p_source_id: number
        }
        Returns: boolean
      }
      rebuild_entity_search_terms: { Args: never; Returns: undefined }
      rebuild_entity_search_terms_scoped: {
        Args: { p_city?: string; p_full?: boolean; p_since?: string }
        Returns: undefined
      }
      refresh_available_filters: { Args: never; Returns: undefined }
      refresh_entity_tag_summary: { Args: never; Returns: undefined }
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
          p_city?: string
          p_limit?: number
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
      search_places_ranked: {
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
      unaccent: { Args: { "": string }; Returns: string }
      update_live_events: { Args: never; Returns: undefined }
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
