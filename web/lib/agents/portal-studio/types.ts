export type PortalStudioVertical = "hotel" | "hospital" | "city" | "community" | "film";
export type PortalStudioLifecycle = "discovery" | "prototype" | "pilot" | "launch";
export type PortalStudioCommercialFocus = "engagement" | "sales" | "operations";

export type PortalStudioAgentName =
  | "art_direction"
  | "domain_expertise"
  | "product_ux"
  | "expert_copywriter"
  | "content_curation"
  | "architecture_scale"
  | "security_privacy"
  | "analytics_hypothesis"
  | "roi_storytelling";

export type AgentReason = {
  code: string;
  message: string;
  weight: number;
};

export type StudioPortal = {
  id: string;
  slug: string;
  name: string;
  vertical: PortalStudioVertical;
};

export type StudioSession = {
  lifecycle: PortalStudioLifecycle;
  commercialFocus: PortalStudioCommercialFocus;
  wayfindingPartner: string;
  excludedCompetitors: string[];
};

export type PortalStudioInput = {
  requestId: string;
  now: Date;
  portal: StudioPortal;
  session: StudioSession;
};

export type PortalStudioQualityGate = {
  id: string;
  title: string;
  pass_criteria: string;
  severity: "critical" | "high" | "medium";
};

export type PortalStudioOutput = {
  request_id: string;
  generated_at: string;
  portal: StudioPortal;
  strategy_locks: {
    strict_source_attribution: boolean;
    public_developer_api: "iceboxed";
    self_serve_admin_generation: "deferred_until_customer_validation";
    foundation_goal: "scale_ready_secure_multi_tenant";
  };
  non_goals: string[];
  execution_protocol: {
    stages: Array<{
      stage: string;
      objective: string;
      artifact: string;
      gate: string;
    }>;
    vertical_invariants: string[];
    client_variability: string[];
  };
  quality_gates: PortalStudioQualityGate[];
  feedback_learning_loop: {
    rule: string;
    required_actions: string[];
  };
  active_agents: Array<{
    name: PortalStudioAgentName;
    mission: string;
    sla: string;
    output_contract: string[];
  }>;
  blueprint: {
    art_direction: {
      design_direction: string;
      visual_rules: string[];
      anti_patterns: string[];
    };
    domain_experience: {
      domain: string;
      hero_journeys: Array<{ journey: string; objective: string }>;
      service_layers: string[];
    };
    product_ux: {
      navigation_model: string;
      conversion_stack: string[];
      required_states: string[];
    };
    copywriting: {
      voice_system: string[];
      narrative_framework: string[];
      conversion_copy_patterns: string[];
    };
    content_curation: {
      source_tiers: Array<{ tier: string; criteria: string }>;
      exclusion_policy: string[];
      provenance_requirements: string[];
    };
    architecture_scale: {
      planes: Array<{ name: string; responsibility: string }>;
      scale_controls: string[];
    };
    security_privacy: {
      threat_model_focus: string[];
      controls: string[];
      audit_events: string[];
    };
    analytics_hypothesis: {
      north_star_metric: string;
      launch_hypotheses: Array<{ hypothesis: string; proof_metric: string }>;
      dashboard_modules: string[];
    };
    roi_storytelling: {
      customer_value_narrative: string[];
      demo_proof_points: string[];
    };
  };
  scorecard: {
    experience_score: number;
    trust_score: number;
    security_score: number;
    scale_score: number;
    launch_readiness_score: number;
  };
  delivery_plan: Array<{
    phase: string;
    duration: string;
    outcomes: string[];
  }>;
  agent_reasons: Record<PortalStudioAgentName, AgentReason[]>;
};
