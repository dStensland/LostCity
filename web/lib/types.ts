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
    };
  };
};
