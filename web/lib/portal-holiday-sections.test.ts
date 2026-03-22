import { describe, expect, it } from "vitest";
import { buildPortalHolidaySections } from "@/lib/portal-holiday-sections";

describe("portal-holiday-sections", () => {
  it("returns no holiday sections before the seasonal window opens", () => {
    expect(buildPortalHolidaySections(new Date("2026-01-19T12:00:00Z"))).toEqual(
      [],
    );
  });

  it("returns late-January seasonal sections once the window opens", () => {
    const sections = buildPortalHolidaySections(
      new Date("2026-01-20T12:00:00Z"),
    );

    expect(sections.map((section) => section.slug)).toEqual([
      "valentines-day",
      "lunar-new-year",
      "black-history-month",
    ]);
  });

  it("returns overlapping February sections, including short windows", () => {
    const sections = buildPortalHolidaySections(
      new Date("2026-02-12T12:00:00Z"),
    );

    expect(sections.map((section) => section.slug)).toEqual([
      "friday-the-13th",
      "valentines-day",
      "mardi-gras",
      "lunar-new-year",
      "black-history-month",
    ]);
  });

  it("returns March seasonal sections with St. Patrick's Day", () => {
    const sections = buildPortalHolidaySections(
      new Date("2026-03-12T12:00:00Z"),
    );

    expect(sections.map((section) => section.slug)).toEqual([
      "st-patricks-day",
    ]);
  });
});
