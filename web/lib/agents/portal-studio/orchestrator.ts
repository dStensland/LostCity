import type {
  AgentReason,
  PortalStudioAgentName,
  PortalStudioInput,
  PortalStudioOutput,
  PortalStudioQualityGate,
  PortalStudioVertical,
} from "./types";
import { getCopywritingFramework } from "./copywriting";

const AGENT_LIBRARY: Array<{
  name: PortalStudioAgentName;
  mission: string;
  sla: string;
  output_contract: string[];
}> = [
  {
    name: "art_direction",
    mission: "Translate brand truth into a premium visual system that feels native to each customer portal.",
    sla: "Design direction packet in < 24h with responsive tokens and anti-pattern list.",
    output_contract: ["design_direction", "visual_rules", "anti_patterns"],
  },
  {
    name: "domain_expertise",
    mission: "Encode world-class domain context so recommendations are operationally relevant, not generic.",
    sla: "Journey map and domain constraints with source requirements per vertical.",
    output_contract: ["hero_journeys", "service_layers", "domain_constraints"],
  },
  {
    name: "product_ux",
    mission: "Construct high-conversion UX flows with low friction and clear next actions.",
    sla: "Information architecture and conversion actions with mobile-first behavior states.",
    output_contract: ["navigation_model", "conversion_stack", "required_states"],
  },
  {
    name: "expert_copywriter",
    mission: "Craft premium, brand-native language that converts with clarity and emotional confidence.",
    sla: "Voice framework + screen-ready copy patterns with CTA hierarchy and fallback states.",
    output_contract: ["voice_system", "narrative_framework", "conversion_copy_patterns"],
  },
  {
    name: "content_curation",
    mission: "Maintain elite quality and strict provenance across federated source ingestion.",
    sla: "Tiering policy, exclusion rules, and provenance labels on all surfaced entities.",
    output_contract: ["source_tiers", "exclusion_policy", "provenance_requirements"],
  },
  {
    name: "architecture_scale",
    mission: "Ensure portal customization scales without fragmenting the platform core.",
    sla: "Composable architecture planes and scale controls that support 10x portal growth.",
    output_contract: ["planes", "scale_controls"],
  },
  {
    name: "security_privacy",
    mission: "Protect tenant boundaries, data integrity, and compliance-critical interactions.",
    sla: "Threat-model controls and audit event schema for every release train.",
    output_contract: ["threat_model_focus", "controls", "audit_events"],
  },
  {
    name: "analytics_hypothesis",
    mission: "Prove value with launch-ready measurement tied to behavior and commercial outcomes.",
    sla: "Hypothesis matrix and KPI instrumentation spec before major design changes ship.",
    output_contract: ["north_star_metric", "launch_hypotheses", "dashboard_modules"],
  },
  {
    name: "roi_storytelling",
    mission: "Convert product quality into credible customer-facing ROI narratives.",
    sla: "Demo proof narrative mapped to outcomes, not feature lists.",
    output_contract: ["customer_value_narrative", "demo_proof_points"],
  },
];

const VERTICAL_DOMAIN_LABEL: Record<PortalStudioVertical, string> = {
  hospital: "Clinical Concierge + Public Health Navigation",
  hotel: "Luxury Hospitality + City Discovery",
  city: "Civic Discovery + Local Participation",
  community: "Neighborhood Connection + Family Utility",
  film: "Film Culture + Showtimes Utility",
};

function toReason(code: string, message: string, weight: number): AgentReason {
  return { code, message, weight };
}

function createVerticalJourneys(vertical: PortalStudioVertical, wayfindingPartner: string): Array<{ journey: string; objective: string }> {
  if (vertical === "hospital") {
    return [
      {
        journey: "Visitor entry -> right campus in one tap",
        objective: `Route users to the correct hospital action with wayfinding via ${wayfindingPartner}.`,
      },
      {
        journey: "Patient companion -> service + amenity support",
        objective: "Surface food, lodging, parking, and family logistics with operational-state filters.",
      },
      {
        journey: "Community overlay -> prevention + wellness",
        objective: "Blend public-health and nonprofit support with strict provenance on each recommendation.",
      },
    ];
  }

  if (vertical === "hotel") {
    return [
      {
        journey: "Guest mode selection -> curated city path",
        objective: "Convert discovery into confident action with high-signal recommendations.",
      },
      {
        journey: "Property-first concierge -> outside-city expansion",
        objective: "Balance on-property anchors with walkable external experiences.",
      },
      {
        journey: "Nightly briefing -> itinerary execution",
        objective: "Increase concierge request conversion through timing-aware sequencing.",
      },
    ];
  }

  return [
    {
      journey: "Intent selection -> focused feed",
      objective: "Reduce exploration friction and improve click depth quality.",
    },
    {
      journey: "Filtered discovery -> trusted action",
      objective: "Ensure every recommendation has provenance, freshness, and clear next step.",
    },
    {
      journey: "Session context -> longitudinal utility",
      objective: "Adapt content by role, time, and local context without interface complexity.",
    },
  ];
}

function createServiceLayers(vertical: PortalStudioVertical): string[] {
  if (vertical === "hospital") {
    return [
      "Hospital directory + campus companions",
      "Wayfinding bridge + contact escalation",
      "On-site amenities and nearby essentials",
      "Public health, food access, and wellness federation",
    ];
  }
  if (vertical === "hotel") {
    return [
      "Property concierge and signature venues",
      "Destination discovery with live relevance",
      "Itinerary composition and concierge handoff",
      "Membership / VIP policy overlays",
    ];
  }
  return [
    "Federated local content feed",
    "Intent-aware discovery and filtering",
    "Action-oriented detail and map routing",
    "Trust and provenance overlays",
  ];
}

function defaultVisualRules(vertical: PortalStudioVertical): string[] {
  const base = [
    "Use brand-native palette and typography with no generic fallback aesthetic.",
    "One dominant primary action per viewport, with clear secondary alternatives.",
    "Preserve whitespace hierarchy to signal confidence and reduce cognitive load.",
    "Motion is meaningful: reveal hierarchy, state transitions, and action confirmation only.",
  ];

  if (vertical === "hospital") {
    return base.concat([
      "Prioritize calm legibility and operational clarity over decorative effects.",
      "Every urgent state must remain readable at a glance on mobile.",
    ]);
  }

  if (vertical === "hotel") {
    return base.concat([
      "Use cinematic depth and editorial pacing to convey premium hospitality.",
      "Ensure experiential richness without sacrificing booking or concierge conversion.",
    ]);
  }

  return base;
}

function nonGoals(): string[] {
  return [
    "Public developer API before launch validation.",
    "Self-serve portal admin/generation workflows before initial customer proof.",
    "Any source presentation without visible provenance and policy eligibility.",
  ];
}

function curationExclusions(excludedCompetitors: string[]): string[] {
  if (excludedCompetitors.length === 0) {
    return ["No competitor exclusions specified; default vertical policy still applies."];
  }
  return excludedCompetitors.map((competitor) => `Exclude competitor-owned sources and partner assets: ${competitor}.`);
}

function scorecardForVertical(vertical: PortalStudioVertical, lifecycle: PortalStudioInput["session"]["lifecycle"]): PortalStudioOutput["scorecard"] {
  const base = vertical === "hospital"
    ? { experience: 90, trust: 96, security: 94, scale: 91 }
    : vertical === "hotel"
      ? { experience: 92, trust: 90, security: 92, scale: 90 }
      : { experience: 88, trust: 89, security: 91, scale: 89 };

  const lifecycleBoost = lifecycle === "launch" ? 3 : lifecycle === "pilot" ? 1 : 0;

  const experienceScore = Math.min(99, base.experience + lifecycleBoost);
  const trustScore = Math.min(99, base.trust + lifecycleBoost);
  const securityScore = Math.min(99, base.security + lifecycleBoost);
  const scaleScore = Math.min(99, base.scale + lifecycleBoost);
  const launchReadinessScore = Math.round((experienceScore + trustScore + securityScore + scaleScore) / 4);

  return {
    experience_score: experienceScore,
    trust_score: trustScore,
    security_score: securityScore,
    scale_score: scaleScore,
    launch_readiness_score: launchReadinessScore,
  };
}

function executionStages(): PortalStudioOutput["execution_protocol"]["stages"] {
  return [
    {
      stage: "Scope lock",
      objective: "Freeze strategic guardrails and scope boundaries before visual or UX work.",
      artifact: "/docs/portal-factory/templates/00-portal-intake.md",
      gate: "Scope is explicit and non-goals are documented.",
    },
    {
      stage: "Persona outcomes",
      objective: "Map jobs-to-be-done to concrete actions and measurable outcomes.",
      artifact: "/docs/portal-factory/templates/01-persona-outcome-matrix.md",
      gate: "Each persona has first, fallback, and continuation actions.",
    },
    {
      stage: "Source contract",
      objective: "Define allowed tiers, exclusions, and required provenance fields.",
      artifact: "/docs/portal-factory/templates/02-source-attribution-contract.md",
      gate: "Attribution contract is complete and testable.",
    },
    {
      stage: "Unified design brief",
      objective: "Set one client-native design system with persona adaptation rules.",
      artifact: "/docs/portal-factory/templates/03-design-system-brief.md",
      gate: "System-level visual and interaction rules are approved.",
    },
    {
      stage: "Quality proofing",
      objective: "Run deterministic launch-readiness checks before sign-off.",
      artifact: "/docs/portal-factory/templates/04-quality-gate-scorecard.md",
      gate: "All critical gates pass on desktop and mobile.",
    },
    {
      stage: "Launch proof",
      objective: "Track hypothesis outcomes and decide iterate/scale with evidence.",
      artifact: "/docs/portal-factory/templates/05-launch-hypothesis-dashboard.md",
      gate: "North-star and hypothesis metrics are instrumented and reporting.",
    },
  ];
}

function qualityGates(vertical: PortalStudioVertical): PortalStudioQualityGate[] {
  const base: PortalStudioQualityGate[] = [
    {
      id: "brand_fidelity",
      title: "Brand fidelity",
      pass_criteria: "Portal is visually native to client brand with no generic fallback aesthetic.",
      severity: "critical",
    },
    {
      id: "action_clarity",
      title: "Action clarity",
      pass_criteria: "Primary next action is visible in under ten seconds.",
      severity: "critical",
    },
    {
      id: "attribution_integrity",
      title: "Attribution integrity",
      pass_criteria: "Every recommendation displays source and trust context at decision time.",
      severity: "critical",
    },
    {
      id: "persona_coherence",
      title: "Persona coherence",
      pass_criteria: "Persona changes adjust priority and defaults without fragmenting IA.",
      severity: "high",
    },
    {
      id: "mobile_quality",
      title: "Mobile quality",
      pass_criteria: "Critical flows complete cleanly on small screens.",
      severity: "critical",
    },
    {
      id: "security_boundary",
      title: "Security boundary",
      pass_criteria: "Portal-scoped authorization and policy checks are enforced end-to-end.",
      severity: "critical",
    },
  ];

  if (vertical === "hospital") {
    base.push({
      id: "scope_guardrail",
      title: "Scope guardrail",
      pass_criteria: "No clinical advice or care-coordination behavior appears in portal flows.",
      severity: "critical",
    });
  }

  if (vertical === "hotel") {
    base.push({
      id: "premium_storytelling",
      title: "Premium storytelling",
      pass_criteria: "Experiential richness is preserved without obscuring booking/conversion actions.",
      severity: "high",
    });
  }

  return base;
}

export function runPortalStudioOrchestration(input: PortalStudioInput): PortalStudioOutput {
  const { portal, session } = input;
  const nowIso = input.now.toISOString();

  const agentReasons: Record<PortalStudioAgentName, AgentReason[]> = {
    art_direction: [
      toReason("brand_native", `Visual system tuned to ${portal.name} brand direction`, 0.95),
      toReason("premium_expression", "Portal should sell platform quality through aesthetic confidence", 0.88),
    ],
    domain_expertise: [
      toReason("vertical_fit", `Domain playbook loaded for ${portal.vertical}`, 0.94),
      toReason("journey_precision", "Primary journeys optimized for role-specific outcomes", 0.86),
    ],
    product_ux: [
      toReason("action_clarity", "One primary next action surfaced in under 10 seconds", 0.9),
      toReason("mobile_priority", "Critical flows hardened for mobile-first completion", 0.84),
    ],
    expert_copywriter: [
      toReason("premium_voice", "Customer-facing language must feel premium, clear, and brand-native", 0.92),
      toReason("conversion_language", "Copy should increase action confidence and reduce hesitation", 0.87),
    ],
    content_curation: [
      toReason("attribution_lock", "Strict provenance remains visible on every recommendation", 0.98),
      toReason("federation_quality", "Source tiering enforces trust and reduces noise", 0.9),
    ],
    architecture_scale: [
      toReason("multi_tenant", "Composable planes protect platform coherence across many portals", 0.91),
      toReason("operational_scale", "Rollout model supports rapid portal expansion without forks", 0.85),
    ],
    security_privacy: [
      toReason("defense_in_depth", "Tenant boundaries and policy checks enforced at every API edge", 0.95),
      toReason("auditability", "Action and attribution events are immutable and queryable", 0.88),
    ],
    analytics_hypothesis: [
      toReason("proof_over_features", "Prioritize hypothesis validation before self-serve expansion", 0.96),
      toReason("launch_instrumentation", "Conversion + trust + retention metrics wired before scale marketing", 0.89),
    ],
    roi_storytelling: [
      toReason("outcome_narrative", "Demo experience tied to measurable customer impact", 0.9),
      toReason("sales_enablement", "Use portal outputs to support enterprise buying confidence", 0.84),
    ],
  };

  return {
    request_id: input.requestId,
    generated_at: nowIso,
    portal: portal,
    strategy_locks: {
      strict_source_attribution: true,
      public_developer_api: "iceboxed",
      self_serve_admin_generation: "deferred_until_customer_validation",
      foundation_goal: "scale_ready_secure_multi_tenant",
    },
    non_goals: nonGoals(),
    execution_protocol: {
      stages: executionStages(),
      vertical_invariants: [
        "Federation, Experience, Trust, and Insight planes remain consistent.",
        "Security model and tenant isolation are unchanged across clients.",
        "Provenance requirements are always enforced.",
        "Quality gates block launch when critical criteria fail.",
      ],
      client_variability: [
        "Brand expression, typography, color tokens, and voice.",
        "Persona weighting and default mode choices.",
        "Source pack composition and exclusion policy details.",
        "Primary CTA semantics and partner integration endpoints.",
        "KPI weights and ROI proof narrative emphasis.",
      ],
    },
    quality_gates: qualityGates(portal.vertical),
    feedback_learning_loop: {
      rule: "Every review issue must become a product fix plus a process improvement.",
      required_actions: [
        "Ship immediate fix in current portal.",
        "Capture root cause in intake/template terms.",
        "Update playbook artifacts to prevent recurrence.",
      ],
    },
    active_agents: AGENT_LIBRARY,
    blueprint: {
      art_direction: {
        design_direction: `${portal.name} signature system: editorial precision, premium utility, brand-native trust.`,
        visual_rules: defaultVisualRules(portal.vertical),
        anti_patterns: [
          "Generic template UI that looks interchangeable between portals.",
          "Overly literal copy blocks without emotional and strategic framing.",
          "Decorative complexity that obscures primary actions or trust context.",
        ],
      },
      domain_experience: {
        domain: VERTICAL_DOMAIN_LABEL[portal.vertical],
        hero_journeys: createVerticalJourneys(portal.vertical, session.wayfindingPartner),
        service_layers: createServiceLayers(portal.vertical),
      },
      product_ux: {
        navigation_model: "Action-first triad: Feed, Find, Community with vertical-specific companion layers.",
        conversion_stack: [
          "Primary action rail with booking/directions/services semantics.",
          "Mode-aware routing (visitor/patient/staff or guest/intent).",
          "Context panel with objective + trust guardrail + partner integration state.",
        ],
        required_states: [
          "Loading, empty, and degraded data states preserve trust and usability.",
          "Late-hour state shifts prioritize open-now and operationally available options.",
          "Fallback path remains available when partner integrations are unavailable.",
        ],
      },
      copywriting: getCopywritingFramework(portal.vertical),
      content_curation: {
        source_tiers: [
          { tier: "Tier 1 Trusted", criteria: "Owned customer data, official institutions, verified public agencies." },
          { tier: "Tier 2 Strategic", criteria: "Vetted nonprofits and civic partners with consistent metadata quality." },
          { tier: "Tier 3 Opportunistic", criteria: "Supplemental sources used only with provenance and confidence labels." },
        ],
        exclusion_policy: curationExclusions(session.excludedCompetitors),
        provenance_requirements: [
          "Every recommendation carries source, freshness, and trust tags.",
          "Attribution metadata is immutable once emitted to user surfaces.",
          "Low-confidence items are clearly labeled and never primary CTA defaults.",
        ],
      },
      architecture_scale: {
        planes: [
          { name: "Federation Plane", responsibility: "Ingestion, normalization, dedupe, and source policy enforcement." },
          { name: "Experience Plane", responsibility: "Portal-specific composition, theming, and agent orchestration." },
          { name: "Trust Plane", responsibility: "Provenance, policy checks, confidence scoring, and exclusions." },
          { name: "Insight Plane", responsibility: "Analytics, hypothesis metrics, and ROI reporting surfaces." },
        ],
        scale_controls: [
          "Policy-pack driven behavior toggles per portal without code forks.",
          "Shared orchestration contracts so new agent roles plug in safely.",
          "Versioned API payload contracts for predictable client rollouts.",
          "Queue-backed expensive enrichments to preserve p95 latency targets.",
        ],
      },
      security_privacy: {
        threat_model_focus: [
          "Cross-tenant data leakage via portal scoping failures.",
          "Prompt or metadata injection through untrusted source fields.",
          "Privileged action abuse in admin and analytics surfaces.",
        ],
        controls: [
          "Portal-scoped access checks on all read/write routes.",
          "RLS + least-privilege service role separation for ingestion vs serving.",
          "Strict input validation/sanitization for query and payload fields.",
          "Signed audit trail for critical decisions and user-impacting actions.",
          "CSP, security headers, and dependency vulnerability monitoring.",
        ],
        audit_events: [
          "source_policy_enforced",
          "attribution_rendered",
          "conversion_action_clicked",
          "wayfinding_opened",
          "admin_policy_updated",
        ],
      },
      analytics_hypothesis: {
        north_star_metric: session.commercialFocus === "sales"
          ? "Qualified customer demo conversion rate"
          : session.commercialFocus === "operations"
            ? "Successful action completion under 10 seconds"
            : "High-confidence action CTR per session",
        launch_hypotheses: [
          {
            hypothesis: "Action-first IA improves primary CTA conversion versus baseline feed browsing.",
            proof_metric: "Primary CTA click-through rate and completion depth.",
          },
          {
            hypothesis: "Visible provenance increases trust-driven repeat usage.",
            proof_metric: "7-day return rate among users exposed to provenance labels.",
          },
          {
            hypothesis: "Mode-aware flows reduce time-to-right-action in high-stress contexts.",
            proof_metric: "Median time-to-first-successful action by mode.",
          },
        ],
        dashboard_modules: [
          "Conversion action rail performance by mode and target kind.",
          "Attribution compliance and source quality distribution.",
          "Partner integration success/failure and fallback usage.",
          "Journey drop-off and completion by portal and audience mode.",
        ],
      },
      roi_storytelling: {
        customer_value_narrative: [
          "Demonstrate that white-label portals can feel fully bespoke while running on shared federation infrastructure.",
          "Show faster user decisions with higher trust through provenance-first curation.",
          "Connect engagement and conversion data directly to enterprise buyer outcomes.",
        ],
        demo_proof_points: [
          "Brand-native art direction system mapped to customer visual identity.",
          "Domain-specialized concierge flows with measurable action completion gains.",
          "Security and scale architecture that supports enterprise rollout confidence.",
        ],
      },
    },
    scorecard: scorecardForVertical(portal.vertical, session.lifecycle),
    delivery_plan: [
      {
        phase: "Phase 1: Elite Blueprint Sprint",
        duration: "1-2 weeks",
        outcomes: [
          "Finalize brand-native visual direction and critical journeys.",
          "Lock source policy pack including exclusions and provenance requirements.",
          "Ship conversion action architecture with analytics hooks.",
        ],
      },
      {
        phase: "Phase 2: High-Fidelity Demo + Proofing",
        duration: "2-3 weeks",
        outcomes: [
          "Launch portal-specific demo with production-grade UI and fallback states.",
          "Run hypothesis dashboard reviews and tune flows by mode.",
          "Document sales proof points and enterprise architecture narrative.",
        ],
      },
      {
        phase: "Phase 3: Scale Foundation Hardening",
        duration: "2 weeks",
        outcomes: [
          "Promote reusable policy packs and agent contracts to shared platform modules.",
          "Harden security controls, audit coverage, and threat model gaps.",
          "Prepare controlled expansion to additional customer portals.",
        ],
      },
    ],
    agent_reasons: agentReasons,
  };
}
