import { describe, expect, it } from "vitest";
import {
  getPrimarySeasonalExhibition,
  isPlaceInSeason,
  formatCadence,
  type SeasonalExhibition,
} from "../seasonal";

function ex(
  id: string,
  opening: string,
  closing: string,
  schedule?: SeasonalExhibition["operating_schedule"],
): SeasonalExhibition {
  return {
    id,
    place_id: 1,
    exhibition_type: "seasonal",
    opening_date: opening,
    closing_date: closing,
    operating_schedule: schedule ?? null,
    title: `Exhibition ${id}`,
  };
}

describe("getPrimarySeasonalExhibition", () => {
  it("returns null for empty array", () => {
    expect(getPrimarySeasonalExhibition([], new Date("2026-05-01"))).toBeNull();
  });

  it("returns the only exhibition when there's one", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    expect(getPrimarySeasonalExhibition([e], new Date("2026-05-01"))?.id).toBe("a");
  });

  it("prefers the exhibition with the latest opening_date on overlap", () => {
    // Yule Forest: Pumpkin Oct-Nov, Christmas tree Nov-Dec, overlap week
    const pumpkin = ex("pumpkin", "2026-10-01", "2026-11-10");
    const xmas = ex("xmas", "2026-11-05", "2026-12-24");
    const result = getPrimarySeasonalExhibition(
      [pumpkin, xmas],
      new Date("2026-11-08"),
    );
    expect(result?.id).toBe("xmas");
  });

  it("breaks ties by earliest closing_date (urgency)", () => {
    const a = ex("a", "2026-04-11", "2026-06-08");
    const b = ex("b", "2026-04-11", "2026-07-15");
    const result = getPrimarySeasonalExhibition(
      [a, b],
      new Date("2026-05-01"),
    );
    expect(result?.id).toBe("a");
  });
});

describe("isPlaceInSeason", () => {
  it("returns off-season when no exhibitions", () => {
    const result = isPlaceInSeason([], new Date("2026-07-15"));
    expect(result.status).toBe("off-season");
    expect(result.activeCount).toBe(0);
    expect(result.daysToOpen).toBeNull();
  });

  it("returns active when today is within a season window", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    const result = isPlaceInSeason([e], new Date("2026-05-01"));
    expect(result.status).toBe("active");
    expect(result.activeCount).toBe(1);
  });

  it("returns pre-open when within 28 days of opening", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    const result = isPlaceInSeason([e], new Date("2026-03-20"));
    expect(result.status).toBe("pre-open");
    expect(result.daysToOpen).toBe(22);
  });

  it("returns off-season when more than 28 days pre-open", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    const result = isPlaceInSeason([e], new Date("2026-01-01"));
    expect(result.status).toBe("off-season");
  });

  it("returns grace when 1-7 days post-close", () => {
    const e = ex("a", "2026-04-11", "2026-06-08");
    const result = isPlaceInSeason([e], new Date("2026-06-11"));
    expect(result.status).toBe("grace");
  });

  it("counts active exhibitions on overlap", () => {
    const pumpkin = ex("pumpkin", "2026-10-01", "2026-11-10");
    const xmas = ex("xmas", "2026-11-05", "2026-12-24");
    const result = isPlaceInSeason([pumpkin, xmas], new Date("2026-11-08"));
    expect(result.status).toBe("active");
    expect(result.activeCount).toBe(2);
  });
});

describe("formatCadence", () => {
  it("returns 'Every day' when all days have hours", () => {
    const schedule: SeasonalExhibition["operating_schedule"] = {
      days: {
        monday: { open: "10:00", close: "18:00" },
        tuesday: { open: "10:00", close: "18:00" },
        wednesday: { open: "10:00", close: "18:00" },
        thursday: { open: "10:00", close: "18:00" },
        friday: { open: "10:00", close: "18:00" },
        saturday: { open: "10:00", close: "18:00" },
        sunday: { open: "10:00", close: "18:00" },
      },
    };
    expect(formatCadence(schedule)).toBe("Every day 10–6");
  });

  it("formats weekend-only cadence", () => {
    const schedule: SeasonalExhibition["operating_schedule"] = {
      days: {
        saturday: { open: "10:30", close: "18:00" },
        sunday: { open: "10:30", close: "18:00" },
      },
    };
    expect(formatCadence(schedule)).toBe("Sat–Sun 10:30–6");
  });

  it("formats contiguous weekday range", () => {
    const schedule: SeasonalExhibition["operating_schedule"] = {
      days: {
        friday: { open: "17:30", close: "22:00" },
        saturday: { open: "17:30", close: "22:00" },
        sunday: { open: "17:30", close: "22:00" },
      },
    };
    expect(formatCadence(schedule)).toBe("Fri–Sun 5:30pm–10");
  });

  it("uses default_hours when per-day is empty", () => {
    const schedule: SeasonalExhibition["operating_schedule"] = {
      default_hours: { open: "17:30", close: "21:30" },
    };
    expect(formatCadence(schedule)).toBe("Nightly 5:30pm–9:30");
  });

  it("returns empty string when no schedule", () => {
    expect(formatCadence(null)).toBe("");
  });
});
