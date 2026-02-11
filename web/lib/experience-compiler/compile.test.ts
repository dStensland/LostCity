import { describe, it, expect } from "vitest";
import { compileExperienceSpec } from "./compile";
import { validateExperienceSpec } from "./schema";
import { getVerticalTemplate } from "@/lib/vertical-templates";

const baseContext = {
  portalId: "11111111-1111-1111-1111-111111111111",
  portalSlug: "demo-portal",
  portalType: "business" as const,
  existingFilters: {},
  existingBranding: {},
  existingSettings: {},
};

describe("experience-compiler", () => {
  it("normalizes valid experience spec inputs", () => {
    const result = validateExperienceSpec({
      vertical: "hotel",
      audience: {
        city: " Atlanta ",
        neighborhoods: ["Midtown", "midtown", ""],
        categories: ["food_drink", "food_drink"],
        geo_center: { lat: 33.76, lng: -84.39 },
        geo_radius_km: 6,
      },
      sections: [{ title: "Right Now" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.spec.audience?.city).toBe("Atlanta");
    expect(result.value.spec.audience?.geo_center).toEqual([33.76, -84.39]);
    expect(result.value.spec.audience?.neighborhoods).toEqual(["Midtown"]);
    expect(result.value.spec.audience?.categories).toEqual(["food_drink"]);
  });

  it("compiles hotel defaults from vertical template when sections are omitted", () => {
    const compiled = compileExperienceSpec(
      {
        vertical: "hotel",
      },
      baseContext
    );

    const template = getVerticalTemplate("hotel");

    expect(compiled.sections).toHaveLength(template.sections.length);
    expect(compiled.metadata.feed_type).toBe("destination_specials");
    expect(compiled.portal.settings.vertical).toBe("hotel");
    expect(compiled.warnings.some((w) => w.code === "sections_defaulted")).toBe(true);
  });

  it("deduplicates section slugs and applies section defaults", () => {
    const compiled = compileExperienceSpec(
      {
        vertical: "hotel",
        feed: { default_layout: "grid", items_per_section: 12 },
        sections: [
          { title: "Right Now", section_type: "auto", auto_filter: { when: "today" } },
          { title: "Right Now", section_type: "curated" },
          { title: "Right/Now" },
        ],
      },
      baseContext
    );

    expect(compiled.sections.map((s) => s.slug)).toEqual(["right-now", "right-now-2", "rightnow"]);
    expect(compiled.sections[0].layout).toBe("grid");
    expect(compiled.sections[0].max_items).toBe(12);
    expect(compiled.sections[2].section_type).toBe("curated");
  });

  it("returns validation errors for invalid vertical values", () => {
    const result = validateExperienceSpec({
      vertical: "invalid",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.errors[0]).toContain("vertical");
  });
});
