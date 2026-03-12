import { describe, expect, it } from "vitest";
import {
  getPortalSectionEventLimit,
  isPortalNoEventContentBlockType,
  isPortalNonEventBlockType,
  resolvePortalSectionBlockType,
  shouldKeepPortalSection,
} from "@/lib/portal-section-presentation";

describe("portal-section-presentation", () => {
  it("recognizes non-event block types used in feed filtering", () => {
    expect(isPortalNonEventBlockType("announcement")).toBe(true);
    expect(isPortalNonEventBlockType("nightlife_carousel")).toBe(true);
    expect(isPortalNonEventBlockType("event_cards")).toBe(false);
    expect(isPortalNoEventContentBlockType("announcement")).toBe(true);
    expect(isPortalNoEventContentBlockType("venue_list")).toBe(false);
  });

  it("applies nightlife and community section event limits", () => {
    expect(
      getPortalSectionEventLimit({
        baseLimit: 6,
        isNightlifeSection: true,
        isCommunitySection: false,
      }),
    ).toBe(80);

    expect(
      getPortalSectionEventLimit({
        baseLimit: 6,
        isNightlifeSection: false,
        isCommunitySection: true,
      }),
    ).toBe(10);

    expect(
      getPortalSectionEventLimit({
        baseLimit: 12,
        isNightlifeSection: false,
        isCommunitySection: true,
      }),
    ).toBe(12);
  });

  it("resolves final block types for collapsible event sections", () => {
    expect(
      resolvePortalSectionBlockType({
        requestedBlockType: "event_cards",
        eventCount: 10,
        isCommunitySection: false,
      }),
    ).toBe("collapsible_events");

    expect(
      resolvePortalSectionBlockType({
        requestedBlockType: "event_carousel",
        eventCount: 5,
        isCommunitySection: false,
      }),
    ).toBe("event_list");

    expect(
      resolvePortalSectionBlockType({
        requestedBlockType: "event_cards",
        eventCount: 12,
        isCommunitySection: true,
      }),
    ).toBe("event_cards");
  });

  it("keeps only non-event blocks or event sections with enough content", () => {
    expect(
      shouldKeepPortalSection({
        blockType: "announcement",
        eventCount: 0,
      }),
    ).toBe(true);

    expect(
      shouldKeepPortalSection({
        blockType: "event_cards",
        eventCount: 1,
      }),
    ).toBe(false);

    expect(
      shouldKeepPortalSection({
        blockType: "event_cards",
        eventCount: 2,
      }),
    ).toBe(true);
  });
});
