import type {
  AgentReason,
  ConciergeDestination,
  ConciergeDiscoveryFocus,
  ConciergeFoodFocus,
  ConciergeIntent,
  ConciergeMode,
  ConciergeOrchestrationInput,
  ConciergeOrchestrationOutput,
  ConciergePersona,
  ConciergeView,
  FeedEvent,
} from "./types";

const VALID_PERSONAS: ConciergePersona[] = [
  "first_time",
  "business_traveler",
  "weekend_couple",
  "wellness_guest",
  "club_member",
];

const VALID_INTENTS: ConciergeIntent[] = ["business", "romance", "night_out", "wellness"];
const VALID_VIEWS: ConciergeView[] = ["operate", "property", "explore"];
const VALID_DISCOVERY: ConciergeDiscoveryFocus[] = ["any", "live_music", "comedy", "sports", "arts"];
const VALID_FOOD: ConciergeFoodFocus[] = ["any", "cocktails", "sports_bar", "mexican", "coffee", "rooftop"];
const VALID_MODES: ConciergeMode[] = ["safe", "elevated", "adventurous"];

const PERSONA_DEFAULTS: Record<ConciergePersona, { intent: ConciergeIntent; view: ConciergeView }> = {
  first_time: { intent: "night_out", view: "explore" },
  business_traveler: { intent: "business", view: "operate" },
  weekend_couple: { intent: "romance", view: "property" },
  wellness_guest: { intent: "wellness", view: "property" },
  club_member: { intent: "night_out", view: "property" },
};

const DISCOVERY_KEYWORDS: Record<Exclude<ConciergeDiscoveryFocus, "any">, string[]> = {
  live_music: ["music", "concert", "band", "dj", "jazz", "showcase", "open mic"],
  comedy: ["comedy", "stand-up", "standup", "improv", "laugh"],
  sports: ["sports", "game", "match", "watch party", "soccer", "football", "basketball", "baseball", "hockey"],
  arts: ["exhibition", "museum", "gallery", "film", "cinema", "theatre", "theater", "orchestra", "arts"],
};

const FOOD_FOCUS_CONFIG: Record<Exclude<ConciergeFoodFocus, "any">, { venueTypes: string[]; keywords: string[] }> = {
  cocktails: {
    venueTypes: ["bar", "rooftop", "distillery", "nightclub"],
    keywords: ["cocktail", "martini", "speakeasy", "mixology", "aperitivo"],
  },
  sports_bar: {
    venueTypes: ["sports_bar", "bar", "brewery"],
    keywords: ["sports", "watch", "game", "match"],
  },
  mexican: {
    venueTypes: ["restaurant", "food_hall", "bar"],
    keywords: ["mexican", "taco", "taqueria", "mezcal", "cantina"],
  },
  coffee: {
    venueTypes: ["coffee_shop", "restaurant", "food_hall"],
    keywords: ["coffee", "espresso", "cafe", "bakery", "brunch"],
  },
  rooftop: {
    venueTypes: ["rooftop", "bar", "restaurant"],
    keywords: ["rooftop", "terrace", "skyline", "patio"],
  },
};

const MODE_LABELS: Record<ConciergeMode, string> = {
  safe: "Low-friction timing",
  elevated: "Signature premium flow",
  adventurous: "Bolder city exploration",
};

const INTENT_LABELS: Record<ConciergeIntent, string> = {
  business: "business-efficient",
  romance: "romantic",
  night_out: "night-out",
  wellness: "wellness-led",
};

const DISCOVERY_LABELS: Record<Exclude<ConciergeDiscoveryFocus, "any">, string> = {
  live_music: "live music",
  comedy: "comedy",
  sports: "sports",
  arts: "arts and culture",
};

const FOOD_LABELS: Record<Exclude<ConciergeFoodFocus, "any">, string> = {
  cocktails: "great cocktails",
  sports_bar: "sports bar energy",
  mexican: "Mexican food",
  coffee: "coffee and casual spots",
  rooftop: "rooftop venues",
};

function isValid<T extends string>(value: string | null | undefined, allowed: readonly T[]): value is T {
  return !!value && allowed.includes(value as T);
}

function normalizeText(value: string | null | undefined): string {
  return (value || "").toLowerCase().trim();
}

function toEventId(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

function flattenEvents(sections: ConciergeOrchestrationInput["sections"]): FeedEvent[] {
  const seen = new Set<string>();
  const events: FeedEvent[] = [];

  for (const section of sections || []) {
    for (const event of section.events || []) {
      const id = toEventId(event.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      events.push(event);
    }
  }
  return events;
}

function eventVenueName(event: FeedEvent): string {
  if (event.venue_name && typeof event.venue_name === "string") return event.venue_name;
  if (event.venue && typeof event.venue.name === "string") return event.venue.name;
  return "";
}

function eventSearchBlob(event: FeedEvent): string {
  return [
    normalizeText(event.title || ""),
    normalizeText(event.category || ""),
    normalizeText(event.subcategory || ""),
    normalizeText(eventVenueName(event)),
  ].join(" ");
}

function getConfidenceScore(confidence: string | null | undefined): number {
  const value = normalizeText(confidence);
  if (value === "high") return 1;
  if (value === "medium") return 0.7;
  if (value === "low") return 0.4;
  return 0.5;
}

function minutesSince(isoValue: string | null | undefined, now: Date): number | null {
  if (!isoValue) return null;
  const parsed = Date.parse(isoValue);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.round((now.getTime() - parsed) / 60000));
}

function routePriority(view: ConciergeView, intent: ConciergeIntent): string[] {
  if (view === "property") {
    return ["signature_venues", "amenities", "live_now", "briefing"];
  }
  if (view === "explore") {
    return ["live_now", "beltline_route", "briefing", "itinerary"];
  }
  if (intent === "business") {
    return ["briefing", "live_now", "itinerary", "in_room_services"];
  }
  return ["live_now", "briefing", "itinerary", "in_room_services"];
}

function destinationStateScore(destination: ConciergeDestination): number {
  if (destination.special_state === "active_now") return 8;
  if (destination.special_state === "starting_soon") return 5;
  return 2;
}

function destinationProximityScore(destination: ConciergeDestination): number {
  if (destination.proximity_tier === "walkable") return 5;
  if (destination.proximity_tier === "close") return 3;
  return 1;
}

function destinationEta(destination: ConciergeDestination): number {
  if (destination.proximity_tier === "walkable") return 12;
  if (destination.proximity_tier === "close") return 24;
  return 38;
}

function daypart(now: Date): "morning" | "afternoon" | "evening" | "late_night" {
  const hour = now.getHours();
  if (hour >= 6 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 23) return "evening";
  return "late_night";
}

function toReason(code: string, message: string, weight: number): AgentReason {
  return { code, message, weight };
}

function scoreEventForFocus(event: FeedEvent, focus: ConciergeDiscoveryFocus, now: Date): { score: number; reasons: AgentReason[] } {
  const reasons: AgentReason[] = [];
  let score = 1;
  const blob = eventSearchBlob(event);

  if (focus !== "any") {
    const keywords = DISCOVERY_KEYWORDS[focus];
    const matches = keywords.filter((keyword) => blob.includes(keyword));
    if (matches.length > 0) {
      score += 8 + matches.length;
      reasons.push(toReason("focus_keyword", `Matches ${focus.replace("_", " ")} signals`, 0.9));
    }
  } else {
    reasons.push(toReason("broad_mix", "Included in broad discovery mix", 0.55));
  }

  if (event.is_free) {
    score += 1;
    reasons.push(toReason("complimentary", "Complimentary signal improves utility", 0.45));
  }

  if (event.start_date && event.start_date.length >= 10) {
    const todayIso = now.toISOString().slice(0, 10);
    if (event.start_date === todayIso) {
      score += 2;
      reasons.push(toReason("today_relevance", "Happens today", 0.7));
    }
  }

  return { score, reasons };
}

function scoreDestinationForFoodFocus(
  destination: ConciergeDestination,
  focus: ConciergeFoodFocus
): { score: number; reasons: AgentReason[] } {
  let score = destinationStateScore(destination) + destinationProximityScore(destination) + getConfidenceScore(destination.top_special?.confidence) * 2;
  const reasons: AgentReason[] = [
    toReason("state", `Special state ${destination.special_state.replace("_", " ")}`, 0.7),
    toReason("proximity", `Proximity tier ${destination.proximity_tier}`, 0.66),
  ];

  if (focus === "any") {
    reasons.push(toReason("broad_mix", "Balanced destination mix", 0.5));
    return { score, reasons };
  }

  const config = FOOD_FOCUS_CONFIG[focus];
  const venueType = normalizeText(destination.venue.venue_type);
  const nameBlob = `${normalizeText(destination.venue.name)} ${normalizeText(destination.top_special?.title || "")}`;
  if (config.venueTypes.includes(venueType)) {
    score += 6;
    reasons.push(toReason("venue_type_fit", `Venue type matches ${focus.replace("_", " ")}`, 0.92));
  }

  const keywordMatches = config.keywords.filter((keyword) => nameBlob.includes(keyword));
  if (keywordMatches.length > 0) {
    score += 4 + keywordMatches.length;
    reasons.push(toReason("keyword_fit", "Title or venue signals match requested taste", 0.83));
  }

  return { score, reasons };
}

export function runConciergeOrchestration(input: ConciergeOrchestrationInput): ConciergeOrchestrationOutput {
  const now = input.now;
  const persona: ConciergePersona = isValid(input.session.persona, VALID_PERSONAS) ? input.session.persona : "first_time";
  const defaultForPersona = PERSONA_DEFAULTS[persona];
  const intent: ConciergeIntent = isValid(input.session.intent, VALID_INTENTS) ? input.session.intent : defaultForPersona.intent;
  const view: ConciergeView = isValid(input.session.view, VALID_VIEWS) ? input.session.view : defaultForPersona.view;
  const discoveryFocus: ConciergeDiscoveryFocus = isValid(input.session.discoveryFocus, VALID_DISCOVERY)
    ? input.session.discoveryFocus
    : "any";
  const foodFocus: ConciergeFoodFocus = isValid(input.session.foodFocus, VALID_FOOD) ? input.session.foodFocus : "any";
  const mode: ConciergeMode = isValid(input.session.mode, VALID_MODES) ? input.session.mode : "safe";

  const sourceCount = input.sourceAccess.length;
  const ownerSourceCount = input.sourceAccess.filter((item) => item.accessType === "owner").length;
  const globalSourceCount = input.sourceAccess.filter((item) => item.accessType === "global").length;
  const subscriptionSourceCount = input.sourceAccess.filter((item) => item.accessType === "subscription").length;

  const federationReasons: AgentReason[] = [
    toReason("source_access", `${sourceCount} accessible sources in federation scope`, 0.95),
    toReason("source_mix", `${ownerSourceCount} owned, ${subscriptionSourceCount} subscribed, ${globalSourceCount} global`, 0.75),
  ];

  const confidenceScores = input.destinations.map((destination) => getConfidenceScore(destination.top_special?.confidence));
  const averageConfidenceScore = confidenceScores.length > 0
    ? Number((confidenceScores.reduce((sum, value) => sum + value, 0) / confidenceScores.length).toFixed(2))
    : 0;
  let staleCount = 0;
  let highConfidenceCount = 0;
  for (const destination of input.destinations) {
    if (normalizeText(destination.top_special?.confidence) === "high") highConfidenceCount += 1;
    const ageMinutes = minutesSince(destination.top_special?.last_verified_at, now);
    if (ageMinutes !== null && ageMinutes > 24 * 60) staleCount += 1;
  }

  const freshnessReasons: AgentReason[] = [
    toReason("confidence_avg", `Average confidence ${averageConfidenceScore}`, 0.73),
    toReason("freshness_window", `${staleCount} destinations exceed 24h freshness window`, staleCount === 0 ? 0.88 : 0.51),
  ];

  const personaReasons: AgentReason[] = [
    toReason("persona_resolution", `Resolved persona ${persona.replace("_", " ")}`, 0.87),
    toReason("intent_resolution", `Intent set to ${intent.replace("_", " ")}`, 0.84),
  ];

  const prioritySections = routePriority(view, intent);
  const routingReasons: AgentReason[] = [
    toReason("view_selection", `View ${view} aligns with intent ${intent.replace("_", " ")}`, 0.82),
    toReason("section_priority", `Priority sections ${prioritySections.join(", ")}`, 0.71),
  ];

  const events = flattenEvents(input.sections);
  const scoredEvents = events.map((event) => {
    const { score, reasons } = scoreEventForFocus(event, discoveryFocus, now);
    return { event, score, reasons };
  }).sort((a, b) => b.score - a.score);
  const topEventIds = scoredEvents
    .slice(0, 12)
    .map((item) => toEventId(item.event.id))
    .filter(Boolean);
  const reasonsByEvent = Object.fromEntries(
    scoredEvents.slice(0, 12).map((item) => [toEventId(item.event.id), item.reasons])
  );

  const scoredDestinations = input.destinations
    .map((destination) => {
      const { score, reasons } = scoreDestinationForFoodFocus(destination, foodFocus);
      return { destination, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
  const topDestinationIds = scoredDestinations.slice(0, 14).map((item) => item.destination.venue.id);
  const reasonsByDestination = Object.fromEntries(
    scoredDestinations.slice(0, 14).map((item) => [String(item.destination.venue.id), item.reasons])
  );

  const memberMode = persona === "club_member";
  const propertyHighlights = memberMode
    ? [
      "Prioritize FORTH Club spaces and member benefits in evening flow.",
      "Respect club etiquette, guest allowances, and laptop-hour windows.",
      "Route through signature rooms before external exploration.",
    ]
    : [
      "Balance property anchors with walkable city options.",
      "Prefer higher-confidence specials for immediate decisions.",
      "Keep concierge handoff concise and execution-ready.",
    ];
  const propertyReasons: AgentReason[] = [
    toReason("profile_layer", memberMode ? "Club member guidance enabled" : "Guest guidance enabled", 0.86),
  ];

  const eventById = new Map(scoredEvents.map((item) => [toEventId(item.event.id), item.event]));
  const destinationById = new Map(scoredDestinations.map((item) => [item.destination.venue.id, item.destination]));

  const itinerary: ConciergeOrchestrationOutput["recommendations"]["itinerary"] = [];
  const pushDestinationStep = (destinationId: number, reason: string) => {
    const destination = destinationById.get(destinationId);
    if (!destination) return;
    itinerary.push({
      id: `dest-${destination.venue.id}`,
      kind: "destination",
      title: destination.venue.name,
      eta_minutes: destinationEta(destination),
      reason,
    });
  };

  if (topEventIds.length > 0) {
    const firstEvent = eventById.get(topEventIds[0]);
    if (firstEvent) {
      itinerary.push({
        id: `event-${toEventId(firstEvent.id)}`,
        kind: "event",
        title: String(firstEvent.title || "Featured event"),
        eta_minutes: 0,
        reason: "Lead event selected from focus-ranked stack.",
      });
    }
  }

  if (mode === "safe") {
    topDestinationIds.slice(0, 3).forEach((destinationId) => {
      pushDestinationStep(destinationId, "Chosen for reliable timing and proximity.");
    });
  } else if (mode === "elevated") {
    const premium = scoredDestinations
      .filter((item) => ["rooftop", "bar", "restaurant"].includes(normalizeText(item.destination.venue.venue_type)))
      .map((item) => item.destination.venue.id);
    const chosen = premium.concat(topDestinationIds).slice(0, 3);
    chosen.forEach((destinationId) => {
      pushDestinationStep(destinationId, "Chosen for premium room quality and signature atmosphere.");
    });
  } else {
    const adventurous = scoredDestinations
      .filter((item) => item.destination.proximity_tier !== "walkable")
      .map((item) => item.destination.venue.id);
    const chosen = adventurous.concat(topDestinationIds).slice(0, 3);
    chosen.forEach((destinationId) => {
      pushDestinationStep(destinationId, "Chosen for higher-energy exploration beyond immediate radius.");
    });
  }

  const currentDaypart = daypart(now);
  const personaLabel = persona === "first_time"
    ? "First-Time Guest"
    : persona === "business_traveler"
      ? "Business Traveler"
      : persona === "weekend_couple"
        ? "Weekend Couple"
        : persona === "wellness_guest"
          ? "Wellness Guest"
          : "FORTH Club Member";

  const heroTitle = currentDaypart === "morning"
    ? "Good Morning, FORTH Guests"
    : currentDaypart === "afternoon"
      ? "Your FORTH Afternoon Plan"
      : currentDaypart === "evening"
        ? "Tonight at FORTH"
        : "Late-Night FORTH Guide";

  const heroSubtitle = memberMode
    ? "Member-aware routing now blends club privileges, signature venues, and live confidence signals."
    : "Guest guidance now prioritizes accuracy, walkability, and quick decisions from live destination signals.";
  const briefingTitle = `${personaLabel} Briefing`;
  const summary = `Mode ${MODE_LABELS[mode]} with ${topEventIds.length} focused events and ${topDestinationIds.length} destination candidates.`;
  const guestExplainers: string[] = [];
  guestExplainers.push(`Tailored for ${personaLabel} with a ${INTENT_LABELS[intent]} plan.`);
  if (foodFocus !== "any") {
    guestExplainers.push(`You prioritized ${FOOD_LABELS[foodFocus]}, so matching venues are ranked first.`);
  } else if (discoveryFocus !== "any") {
    guestExplainers.push(`You prioritized ${DISCOVERY_LABELS[discoveryFocus]}, so matching events are surfaced first.`);
  } else {
    guestExplainers.push("Picks are balanced by live availability, walkability, and data confidence.");
  }
  if (highConfidenceCount > 0) {
    guestExplainers.push(`${highConfidenceCount} nearby options have high-confidence live signals.`);
  } else {
    guestExplainers.push("No high-confidence live signals yet, so broader reliable options are included.");
  }

  const artDirectionTitle = memberMode ? "Private Club Hospitality" : "Premium Guest Concierge";
  const artDirectionKeywords = memberMode
    ? ["refined", "club-led", "evening-forward"]
    : ["warm", "cinematic", "destination-led"];
  const photographyBrief = memberMode
    ? "Prioritize intimate, service-forward imagery of club, dining, and elevated interiors."
    : "Prioritize high-quality hospitality imagery showing rooms, destinations, and real guest moments.";
  const uiRules = [
    "Keep one primary decision per block.",
    "Use whitespace to separate moments instead of dense controls.",
    "Keep headlines guest-facing and avoid technical language.",
  ];

  const flowTitle = "Tonight, In Three Moves";
  const flowSteps = [
    {
      title: "Set your vibe",
      detail: "Choose who this night is for so we can tune pacing and style.",
    },
    {
      title: "Pick your craving",
      detail: "Tell us what you want most right now: events, drinks, food, or a mix.",
    },
    {
      title: "Move with confidence",
      detail: "Follow a clean, timed plan based on live availability and distance.",
    },
  ];
  const primaryAction = "Build Tonight's Plan";

  return {
    request_id: input.requestId,
    generated_at: now.toISOString(),
    portal_slug: input.portal.slug,
    session: {
      persona,
      intent,
      view,
      discovery_focus: discoveryFocus,
      food_focus: foodFocus,
      mode,
    },
    recommendations: {
      top_event_ids: topEventIds,
      top_destination_ids: topDestinationIds,
      itinerary,
    },
    guest_explainers: guestExplainers,
    agent_outputs: {
      federation_access: {
        allowed_source_count: sourceCount,
        owner_source_count: ownerSourceCount,
        global_source_count: globalSourceCount,
        subscription_source_count: subscriptionSourceCount,
        reasons: federationReasons,
      },
      signal_freshness: {
        average_confidence_score: averageConfidenceScore,
        high_confidence_count: highConfidenceCount,
        stale_count: staleCount,
        reasons: freshnessReasons,
      },
      persona_intent: {
        persona,
        intent,
        reasons: personaReasons,
      },
      experience_routing: {
        view,
        priority_sections: prioritySections,
        reasons: routingReasons,
      },
      event_discovery: {
        top_event_ids: topEventIds,
        reasons_by_event: reasonsByEvent,
      },
      food_drink_curator: {
        top_destination_ids: topDestinationIds,
        reasons_by_destination: reasonsByDestination,
      },
      property_club: {
        member_mode: memberMode,
        highlights: propertyHighlights,
        reasons: propertyReasons,
      },
      itinerary_composer: {
        steps: itinerary,
      },
      art_direction: {
        direction_title: artDirectionTitle,
        tone_keywords: artDirectionKeywords,
        photography_brief: photographyBrief,
        ui_rules: uiRules,
      },
      ux_architecture: {
        flow_title: flowTitle,
        flow_steps: flowSteps,
        primary_action: primaryAction,
      },
      voice_narrative: {
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        briefing_title: briefingTitle,
        summary,
      },
    },
  };
}
