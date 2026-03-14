import { describe, expect, it } from "vitest";

import {
  applyCommittedEntityQueryBoost,
  analyzeQueryIntent,
  type SearchResult,
} from "@/lib/unified-search";

function makeResult(
  overrides: Partial<SearchResult> & Pick<SearchResult, "type" | "title">,
): SearchResult {
  return {
    id: 1,
    href: "/atlanta",
    score: 100,
    ...overrides,
  };
}

describe("applyCommittedEntityQueryBoost", () => {
  it("prefers exact venue matches over organizers and long event titles for ambiguous proper nouns", () => {
    const intent = analyzeQueryIntent("callanwolde");

    const venueBoost = applyCommittedEntityQueryBoost(
      "callanwolde",
      makeResult({ type: "venue", title: "Callanwolde Fine Arts Center" }),
      intent,
    );
    const organizerBoost = applyCommittedEntityQueryBoost(
      "callanwolde",
      makeResult({ type: "organizer", title: "Callanwolde Fine Arts Center" }),
      intent,
    );
    const eventBoost = applyCommittedEntityQueryBoost(
      "callanwolde",
      makeResult({
        type: "event",
        title: "Callanwolde Creative Camp: Creative Camp Week of July 6",
      }),
      intent,
    );

    expect(venueBoost).toBeGreaterThan(organizerBoost);
    expect(organizerBoost).toBeGreaterThan(eventBoost);
  });

  it("does not apply the ambiguity boost to category-like event-intent queries", () => {
    const intent = analyzeQueryIntent("live music tonight");

    const venueBoost = applyCommittedEntityQueryBoost(
      "live music tonight",
      makeResult({ type: "venue", title: "Live at the Battery" }),
      intent,
    );

    expect(venueBoost).toBe(0);
  });

  it("gives venues extra weight for location-ish shorthand queries", () => {
    const intent = analyzeQueryIntent("o4w");

    const venueBoost = applyCommittedEntityQueryBoost(
      "o4w",
      makeResult({ type: "venue", title: "O4W Pizza" }),
      intent,
    );
    const eventBoost = applyCommittedEntityQueryBoost(
      "o4w",
      makeResult({ type: "event", title: "O4W Summer Social" }),
      intent,
    );

    expect(venueBoost).toBeGreaterThan(eventBoost);
  });

  it("prefers whole-token venue matches over loose prefixes for short ambiguous proper nouns", () => {
    const intent = analyzeQueryIntent("fox");

    const theatreBoost = applyCommittedEntityQueryBoost(
      "fox",
      makeResult({
        type: "venue",
        title: "Fox Theatre - Atlanta",
        metadata: { isEventVenue: true, dataQuality: 83 },
      }),
      intent,
    );
    const bbqBoost = applyCommittedEntityQueryBoost(
      "fox",
      makeResult({
        type: "venue",
        title: "Fox Bros. Bar-B-Q",
        metadata: { dataQuality: 72 },
      }),
      intent,
    );
    const coffeeBoost = applyCommittedEntityQueryBoost(
      "fox",
      makeResult({
        type: "venue",
        title: "Foxtail Coffee - Midtown",
        metadata: { dataQuality: 88 },
      }),
      intent,
    );

    expect(theatreBoost).toBeGreaterThan(bbqBoost);
    expect(bbqBoost).toBeGreaterThan(coffeeBoost);
  });

  it("treats leading-article venue names as exact matches for short proper nouns", () => {
    const intent = analyzeQueryIntent("earl");

    const theEarlBoost = applyCommittedEntityQueryBoost(
      "earl",
      makeResult({
        type: "venue",
        title: "The Earl",
        metadata: { isEventVenue: true, dataQuality: 77 },
      }),
      intent,
    );
    const strandBoost = applyCommittedEntityQueryBoost(
      "earl",
      makeResult({
        type: "venue",
        title: "Earl Smith Strand Theatre",
        metadata: { isEventVenue: true, dataQuality: 77 },
      }),
      intent,
    );

    expect(theEarlBoost).toBeGreaterThan(strandBoost);
  });

  it("prefers the canonical venue over room variants for venue-family proper nouns", () => {
    const intent = analyzeQueryIntent("masquerade");

    const canonicalBoost = applyCommittedEntityQueryBoost(
      "masquerade",
      makeResult({
        type: "venue",
        title: "The Masquerade",
        metadata: { isEventVenue: true, dataQuality: 77 },
      }),
      intent,
    );
    const roomBoost = applyCommittedEntityQueryBoost(
      "masquerade",
      makeResult({
        type: "venue",
        title: "The Masquerade - Hell",
        metadata: { isEventVenue: true, dataQuality: 77 },
      }),
      intent,
    );

    expect(canonicalBoost).toBeGreaterThan(roomBoost);
  });

  it("uses editorial prominence to break short-query venue ties", () => {
    const intent = analyzeQueryIntent("high");

    const museumBoost = applyCommittedEntityQueryBoost(
      "high",
      makeResult({
        type: "venue",
        title: "High Museum of Art",
        metadata: { isEventVenue: true, dataQuality: 92, exploreFeatured: true },
      }),
      intent,
    );
    const nightlifeBoost = applyCommittedEntityQueryBoost(
      "high",
      makeResult({
        type: "venue",
        title: "High Society Buckhead",
        metadata: { isEventVenue: true, dataQuality: 92 },
      }),
      intent,
    );

    expect(museumBoost).toBeGreaterThan(nightlifeBoost);
  });
});
