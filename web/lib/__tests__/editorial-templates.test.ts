import { describe, it, expect } from "vitest";
import {
  generateEditorialCallout,
  CATEGORY_LABELS,
  getTimingPhrase,
  type TemplateContext,
} from "../editorial-templates";

const makeCtx = (overrides: Partial<TemplateContext> = {}): TemplateContext => ({
  events: [],
  sectionType: "tonight",
  categoryCounts: {},
  holidays: [],
  ...overrides,
});

describe("generateEditorialCallout", () => {
  describe("tentpole / festival priority", () => {
    it("returns callout for an event with festival_id", () => {
      const ctx = makeCtx({
        sectionType: "tonight",
        events: [
          {
            title: "Atlanta Jazz Festival",
            category_id: "music",
            festival_id: "ajf-2026",
            is_tentpole: false,
          },
        ],
      });

      const result = generateEditorialCallout(ctx);
      expect(result).not.toBeNull();
      expect(result!.highlightText).toBe(
        "Atlanta's biggest music event starts tonight."
      );
      expect(result!.remainderText).toBe("Atlanta Jazz Festival — don't miss it.");
    });

    it("returns callout for an event with is_tentpole set", () => {
      const ctx = makeCtx({
        sectionType: "this_weekend",
        events: [
          {
            title: "Dragon Con",
            category_id: "community",
            is_tentpole: true,
            festival_id: null,
          },
        ],
      });

      const result = generateEditorialCallout(ctx);
      expect(result).not.toBeNull();
      expect(result!.highlightText).toBe(
        "Atlanta's biggest community event starts this weekend."
      );
      expect(result!.remainderText).toBe("Dragon Con — don't miss it.");
    });

    it("uses the first tentpole event when multiple events are present", () => {
      const ctx = makeCtx({
        sectionType: "coming_up",
        events: [
          { title: "Regular Event", category_id: "arts", is_tentpole: false, festival_id: null },
          { title: "Huge Festival", category_id: "food_drink", is_tentpole: true, festival_id: null },
        ],
      });

      const result = generateEditorialCallout(ctx);
      expect(result).not.toBeNull();
      expect(result!.remainderText).toBe("Huge Festival — don't miss it.");
    });
  });

  describe("holiday / occasion priority", () => {
    it("returns holiday callout when holidays array is non-empty", () => {
      const ctx = makeCtx({
        sectionType: "tonight",
        events: [
          { title: "Event A" },
          { title: "Event B" },
          { title: "Event C" },
        ],
        holidays: [{ name: "St. Patrick's Day", date: "2026-03-17" }],
      });

      const result = generateEditorialCallout(ctx);
      expect(result).not.toBeNull();
      expect(result!.highlightText).toBe("St. Patrick's Day is tonight.");
      expect(result!.remainderText).toBe("3 events celebrating across Atlanta.");
    });

    it("uses singular 'event' when only 1 event is in section", () => {
      const ctx = makeCtx({
        sectionType: "this_weekend",
        events: [{ title: "Parade" }],
        holidays: [{ name: "Fourth of July", date: "2026-07-04" }],
      });

      const result = generateEditorialCallout(ctx);
      expect(result!.remainderText).toBe("1 event celebrating across Atlanta.");
    });
  });

  describe("high density priority", () => {
    it("returns density callout when a category has more than 10 events", () => {
      const ctx = makeCtx({
        sectionType: "this_weekend",
        categoryCounts: { music: 12, arts: 3 },
        events: Array.from({ length: 12 }, (_, i) => ({ title: `Concert ${i}` })),
      });

      const result = generateEditorialCallout(ctx);
      expect(result).not.toBeNull();
      expect(result!.highlightText).toBe("12 music events this weekend.");
      expect(result!.remainderText).toBe(
        "More than usual — Atlanta's music scene is buzzing."
      );
    });

    it("picks the highest-count category when multiple are above threshold", () => {
      const ctx = makeCtx({
        sectionType: "tonight",
        categoryCounts: { music: 15, arts: 11 },
        events: [],
      });

      const result = generateEditorialCallout(ctx);
      expect(result!.highlightText).toBe("15 music events tonight.");
    });

    it("returns null when no category exceeds 10", () => {
      const ctx = makeCtx({
        categoryCounts: { music: 10, arts: 5 },
        events: [],
      });

      expect(generateEditorialCallout(ctx)).toBeNull();
    });
  });

  describe("null / no match", () => {
    it("returns null when no signals are present", () => {
      const ctx = makeCtx({
        events: [
          { title: "Small Event", category_id: "arts" },
        ],
        categoryCounts: { arts: 2 },
        holidays: [],
      });

      expect(generateEditorialCallout(ctx)).toBeNull();
    });

    it("returns null for empty context", () => {
      expect(generateEditorialCallout(makeCtx())).toBeNull();
    });
  });

  describe("priority ordering", () => {
    it("festival wins over holiday when both signals are present", () => {
      const ctx = makeCtx({
        sectionType: "tonight",
        events: [
          {
            title: "Peach Music Festival",
            category_id: "music",
            festival_id: "pmf-2026",
            is_tentpole: false,
          },
        ],
        holidays: [{ name: "Summer Solstice", date: "2026-06-21" }],
      });

      const result = generateEditorialCallout(ctx);
      // Tentpole/festival is priority 1 — should win
      expect(result!.highlightText).toBe(
        "Atlanta's biggest music event starts tonight."
      );
    });

    it("festival wins over high density when both signals are present", () => {
      const ctx = makeCtx({
        sectionType: "tonight",
        events: [
          {
            title: "Grand Opening Fest",
            category_id: "arts",
            festival_id: "gof-2026",
            is_tentpole: false,
          },
        ],
        categoryCounts: { arts: 15 },
      });

      const result = generateEditorialCallout(ctx);
      expect(result!.highlightText).toBe(
        "Atlanta's biggest art event starts tonight."
      );
    });

    it("holiday wins over high density when no festival present", () => {
      const ctx = makeCtx({
        sectionType: "this_weekend",
        events: Array.from({ length: 15 }, (_, i) => ({
          title: `Concert ${i}`,
          category_id: "music",
        })),
        categoryCounts: { music: 15 },
        holidays: [{ name: "Thanksgiving", date: "2026-11-26" }],
      });

      const result = generateEditorialCallout(ctx);
      expect(result!.highlightText).toBe("Thanksgiving is this weekend.");
    });
  });

  describe("category label mapping", () => {
    it("maps all known category keys to their readable labels", () => {
      expect(CATEGORY_LABELS["music"]).toBe("music");
      expect(CATEGORY_LABELS["comedy"]).toBe("comedy");
      expect(CATEGORY_LABELS["food_drink"]).toBe("food & drink");
      expect(CATEGORY_LABELS["arts"]).toBe("art");
      expect(CATEGORY_LABELS["nightlife"]).toBe("nightlife");
      expect(CATEGORY_LABELS["sports"]).toBe("sports");
      expect(CATEGORY_LABELS["community"]).toBe("community");
      expect(CATEGORY_LABELS["film"]).toBe("film");
      expect(CATEGORY_LABELS["theatre"]).toBe("theatre");
      expect(CATEGORY_LABELS["wellness"]).toBe("wellness");
      expect(CATEGORY_LABELS["education"]).toBe("education");
      expect(CATEGORY_LABELS["family"]).toBe("family");
    });

    it("uses food & drink label in tentpole callout", () => {
      const ctx = makeCtx({
        sectionType: "tonight",
        events: [
          { title: "Taste of Atlanta", category_id: "food_drink", is_tentpole: true },
        ],
      });

      const result = generateEditorialCallout(ctx);
      expect(result!.highlightText).toBe(
        "Atlanta's biggest food & drink event starts tonight."
      );
    });
  });

  describe("timing phrase mapping", () => {
    it("maps all section types to correct timing phrases", () => {
      expect(getTimingPhrase("tonight")).toBe("tonight");
      expect(getTimingPhrase("right_now")).toBe("tonight");
      expect(getTimingPhrase("this_weekend")).toBe("this weekend");
      expect(getTimingPhrase("this_week")).toBe("this week");
      expect(getTimingPhrase("coming_up")).toBe("this week");
      expect(getTimingPhrase("planning_horizon")).toBe("coming up");
      expect(getTimingPhrase("unknown_section")).toBe("soon");
    });
  });

  describe("cityName", () => {
    it("defaults to Atlanta when cityName is not provided", () => {
      const ctx = makeCtx({
        sectionType: "tonight",
        events: [{ title: "Big Show", is_tentpole: true, category_id: "music" }],
      });

      const result = generateEditorialCallout(ctx);
      expect(result!.highlightText).toContain("Atlanta's");
    });

    it("uses the provided cityName in tentpole callout", () => {
      const ctx = makeCtx({
        sectionType: "tonight",
        cityName: "Nashville",
        events: [{ title: "Big Show", is_tentpole: true, category_id: "music" }],
      });

      const result = generateEditorialCallout(ctx);
      expect(result!.highlightText).toBe(
        "Nashville's biggest music event starts tonight."
      );
    });
  });
});
