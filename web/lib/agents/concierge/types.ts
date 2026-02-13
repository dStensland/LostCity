export type ConciergePersona =
  | "first_time"
  | "business_traveler"
  | "weekend_couple"
  | "wellness_guest"
  | "club_member";

export type ConciergeIntent = "business" | "romance" | "night_out" | "wellness";
export type ConciergeView = "operate" | "property" | "explore";
export type ConciergeDiscoveryFocus = "any" | "live_music" | "comedy" | "sports" | "arts";
export type ConciergeFoodFocus = "any" | "cocktails" | "sports_bar" | "mexican" | "coffee" | "rooftop";
export type ConciergeMode = "safe" | "elevated" | "adventurous";

export type AgentReason = {
  code: string;
  message: string;
  weight: number;
};

export type FeedEvent = {
  id: string | number;
  title?: string | null;
  start_date?: string | null;
  start_time?: string | null;
  category?: string | null;
  subcategory?: string | null;
  venue_name?: string | null;
  venue?: { name?: string | null } | null;
  is_free?: boolean | null;
};

export type FeedSection = {
  title?: string | null;
  slug?: string | null;
  events?: FeedEvent[] | null;
};

export type ConciergeDestination = {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    venue_type: string | null;
  };
  proximity_tier: "walkable" | "close" | "destination";
  proximity_label: string;
  special_state: "active_now" | "starting_soon" | "none";
  top_special: {
    title: string;
    type: string;
    confidence: "high" | "medium" | "low" | null;
    starts_in_minutes: number | null;
    remaining_minutes: number | null;
    last_verified_at: string | null;
  } | null;
  next_event: {
    title: string;
    start_date: string;
    start_time: string | null;
  } | null;
};

export type SourceAccessDetail = {
  sourceId: number;
  sourceName: string;
  accessibleCategories: string[] | null;
  accessType: "owner" | "global" | "subscription";
};

export type OrchestratorPortal = {
  id: string;
  slug: string;
  name: string;
};

export type OrchestratorSessionInput = {
  persona?: string | null;
  intent?: string | null;
  view?: string | null;
  discoveryFocus?: string | null;
  foodFocus?: string | null;
  mode?: string | null;
};

export type ConciergeOrchestrationInput = {
  requestId: string;
  now: Date;
  portal: OrchestratorPortal;
  session: OrchestratorSessionInput;
  sourceAccess: SourceAccessDetail[];
  sections: FeedSection[];
  destinations: ConciergeDestination[];
  liveDestinations: ConciergeDestination[];
};

export type ConciergeOrchestrationOutput = {
  request_id: string;
  generated_at: string;
  portal_slug: string;
  session: {
    persona: ConciergePersona;
    intent: ConciergeIntent;
    view: ConciergeView;
    discovery_focus: ConciergeDiscoveryFocus;
    food_focus: ConciergeFoodFocus;
    mode: ConciergeMode;
  };
  recommendations: {
    top_event_ids: string[];
    top_destination_ids: number[];
    itinerary: Array<{
      id: string;
      kind: "event" | "destination";
      title: string;
      eta_minutes: number;
      reason: string;
    }>;
  };
  guest_explainers: string[];
  agent_outputs: {
    federation_access: {
      allowed_source_count: number;
      owner_source_count: number;
      global_source_count: number;
      subscription_source_count: number;
      reasons: AgentReason[];
    };
    signal_freshness: {
      average_confidence_score: number;
      high_confidence_count: number;
      stale_count: number;
      reasons: AgentReason[];
    };
    persona_intent: {
      persona: ConciergePersona;
      intent: ConciergeIntent;
      reasons: AgentReason[];
    };
    experience_routing: {
      view: ConciergeView;
      priority_sections: string[];
      reasons: AgentReason[];
    };
    event_discovery: {
      top_event_ids: string[];
      reasons_by_event: Record<string, AgentReason[]>;
    };
    food_drink_curator: {
      top_destination_ids: number[];
      reasons_by_destination: Record<string, AgentReason[]>;
    };
    property_club: {
      member_mode: boolean;
      highlights: string[];
      reasons: AgentReason[];
    };
    itinerary_composer: {
      steps: Array<{
        id: string;
        kind: "event" | "destination";
        title: string;
        eta_minutes: number;
        reason: string;
      }>;
    };
    art_direction: {
      direction_title: string;
      tone_keywords: string[];
      photography_brief: string;
      ui_rules: string[];
    };
    ux_architecture: {
      flow_title: string;
      flow_steps: Array<{
        title: string;
        detail: string;
      }>;
      primary_action: string;
    };
    voice_narrative: {
      hero_title: string;
      hero_subtitle: string;
      briefing_title: string;
      summary: string;
    };
  };
};
