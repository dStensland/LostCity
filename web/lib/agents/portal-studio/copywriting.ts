import type { PortalStudioVertical } from "./types";

export type PortalCopywritingFramework = {
  voice_system: string[];
  narrative_framework: string[];
  conversion_copy_patterns: string[];
};

export function getCopywritingFramework(vertical: PortalStudioVertical): PortalCopywritingFramework {
  const voiceSystem = [
    "Lead with confidence and calm; remove filler and speculative language.",
    "Use precise action verbs and plain-language outcomes in every CTA.",
    "Keep trust context visible without legalistic or robotic tone.",
  ];

  const conversionPatterns = [
    "Primary CTA names an immediate action, not a generic destination.",
    "Secondary CTA clarifies fallback path and expected outcome.",
    "Section intros explain user benefit in one sentence before details.",
    "No placeholder/wireframe copy in shippable demo surfaces.",
  ];

  if (vertical === "hospital") {
    return {
      voice_system: voiceSystem.concat([
        "Use reassuring, non-clinical language focused on logistics and support.",
      ]),
      narrative_framework: [
        "Problem frame: care journeys feel stressful and fragmented.",
        "Resolution frame: one trusted entrypoint to campus + community support.",
        "Proof frame: strict attribution, wayfinding continuity, and open-now utility.",
      ],
      conversion_copy_patterns: conversionPatterns.concat([
        "Prioritize 'Book Visit', 'Get Directions', and 'View Services' semantics.",
      ]),
    };
  }

  if (vertical === "hotel") {
    return {
      voice_system: voiceSystem.concat([
        "Blend editorial warmth with decisive concierge utility.",
      ]),
      narrative_framework: [
        "Problem frame: generic city guides lack context and confidence.",
        "Resolution frame: property-aware discovery with premium pacing.",
        "Proof frame: curated moments, timing-aware actions, and conversion lift.",
      ],
      conversion_copy_patterns: conversionPatterns.concat([
        "Prioritize itinerary-ready verbs and time-sensitive prompts.",
      ]),
    };
  }

  return {
    voice_system: voiceSystem,
    narrative_framework: [
      "Problem frame: discovery overload with low-trust recommendations.",
      "Resolution frame: clear intent paths with provenance-first guidance.",
      "Proof frame: faster action completion and higher return usage.",
    ],
    conversion_copy_patterns: conversionPatterns,
  };
}

