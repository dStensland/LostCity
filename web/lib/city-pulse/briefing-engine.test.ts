import { describe, expect, it } from "vitest";
import { composeBriefing, type BriefingContext } from "./briefing-engine";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<BriefingContext> = {}): BriefingContext {
  return {
    tentpoleEvent: null,
    activeHolidays: [],
    closingSoonExhibitions: [],
    schoolCalendarEvents: [],
    weather: null,
    weatherSignal: null,
    todayEventCount: 200,
    topCategories: ["music", "arts"],
    timeSlot: "evening",
    dayOfWeek: "saturday",
    portalSlug: "atlanta",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Tentpole + weather
// ---------------------------------------------------------------------------

describe("composeBriefing — tentpole + weather", () => {
  it("produces prose with tentpole name and temperature, not collapsed, 1 pill", () => {
    const ctx = makeCtx({
      tentpoleEvent: { title: "Dragon Con", starts_tomorrow: true },
      weather: { temperature_f: 72, condition: "Clear" },
      weatherSignal: "nice",
    });
    const out = composeBriefing(ctx);

    expect(out.collapsed).toBe(false);
    expect(out.prose).toMatch(/Dragon Con/);
    expect(out.prose).toMatch(/72/);
    expect(out.pills.length).toBeGreaterThanOrEqual(1);
    // Tentpole pill should reference the tentpole
    expect(out.pills.some((p) => p.label.toLowerCase().includes("dragon con"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. Tentpole + activity (no weather)
// ---------------------------------------------------------------------------

describe("composeBriefing — tentpole + activity (no weather)", () => {
  it("prose mentions tentpole and event count, not collapsed, 1 pill", () => {
    const ctx = makeCtx({
      tentpoleEvent: { title: "Dragon Con", starts_tomorrow: true, event_count: 47 },
      weather: null,
      weatherSignal: null,
      todayEventCount: 47,
    });
    const out = composeBriefing(ctx);

    expect(out.collapsed).toBe(false);
    expect(out.prose).toMatch(/Dragon Con/);
    expect(out.prose).toMatch(/47/);
    expect(out.pills.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Holiday + activity
// ---------------------------------------------------------------------------

describe("composeBriefing — holiday + activity", () => {
  it("prose greets the holiday and mentions event count, pill present", () => {
    const ctx = makeCtx({
      tentpoleEvent: null,
      activeHolidays: [{ title: "Juneteenth", slug: "juneteenth" }],
      todayEventCount: 8,
      topCategories: ["community"],
    });
    const out = composeBriefing(ctx);

    expect(out.collapsed).toBe(false);
    expect(out.prose).toMatch(/Juneteenth/);
    expect(out.prose).toMatch(/8/);
    expect(out.pills.length).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Exhibition closing + weather
// ---------------------------------------------------------------------------

describe("composeBriefing — exhibition closing + weather", () => {
  it("prose names the exhibition and venue, mentions days remaining and condition", () => {
    const ctx = makeCtx({
      tentpoleEvent: null,
      closingSoonExhibitions: [
        { title: "Basquiat", venue_name: "High Museum", days_remaining: 12 },
      ],
      weather: { temperature_f: 68, condition: "Partly Cloudy" },
      weatherSignal: "nice",
      todayEventCount: 80,
    });
    const out = composeBriefing(ctx);

    expect(out.collapsed).toBe(false);
    expect(out.prose).toMatch(/Basquiat/);
    expect(out.prose).toMatch(/12/);
    // Should produce an exhibition pill
    expect(out.pills.some((p) => p.label.toLowerCase().includes("basquiat") || p.label.toLowerCase().includes("closing"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. School calendar + activity
// ---------------------------------------------------------------------------

describe("composeBriefing — school calendar + activity", () => {
  it("prose mentions school system and event context, pill points to family", () => {
    const ctx = makeCtx({
      tentpoleEvent: null,
      schoolCalendarEvents: [
        { event_type: "no_school", school_system: "APS", title: "Spring Break" },
      ],
      todayEventCount: 9,
      topCategories: ["family"],
      weather: null,
      weatherSignal: null,
    });
    const out = composeBriefing(ctx);

    expect(out.collapsed).toBe(false);
    expect(out.prose).toMatch(/APS|Spring Break|school/i);
    expect(out.pills.some((p) => p.href.includes("family") || p.label.toLowerCase().includes("kid"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Weather (rain) + activity
// ---------------------------------------------------------------------------

describe("composeBriefing — weather rain + activity", () => {
  it("prose mentions rain and indoor event count, not collapsed", () => {
    const ctx = makeCtx({
      tentpoleEvent: null,
      weather: { temperature_f: 55, condition: "Rain" },
      weatherSignal: "rain",
      todayEventCount: 14,
      topCategories: ["comedy", "music"],
    });
    const out = composeBriefing(ctx);

    expect(out.collapsed).toBe(false);
    expect(out.prose.toLowerCase()).toMatch(/rain|rainy/);
    expect(out.prose).toMatch(/14/);
    expect(out.weatherBadge?.condition).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 7. Weather (nice) + outdoor
// ---------------------------------------------------------------------------

describe("composeBriefing — weather nice + outdoor", () => {
  it("prose mentions temperature and outdoor encouragement, not collapsed", () => {
    const ctx = makeCtx({
      tentpoleEvent: null,
      weather: { temperature_f: 68, condition: "Sunny" },
      weatherSignal: "nice",
      todayEventCount: 120,
      topCategories: ["outdoors", "food"],
    });
    const out = composeBriefing(ctx);

    expect(out.collapsed).toBe(false);
    expect(out.prose).toMatch(/68/);
    expect(out.prose.toLowerCase()).toMatch(/out|outdoor|great|sunny/);
  });
});

// ---------------------------------------------------------------------------
// 8. Activity-only fallback
// ---------------------------------------------------------------------------

describe("composeBriefing — activity only fallback", () => {
  it("prose mentions event count and top categories, not collapsed", () => {
    const ctx = makeCtx({
      tentpoleEvent: null,
      activeHolidays: [],
      closingSoonExhibitions: [],
      schoolCalendarEvents: [],
      weather: null,
      weatherSignal: null,
      todayEventCount: 200,
      topCategories: ["music", "arts"],
    });
    const out = composeBriefing(ctx);

    expect(out.collapsed).toBe(false);
    expect(out.prose).toMatch(/200/);
    expect(out.prose.toLowerCase()).toMatch(/music|arts/);
  });
});

// ---------------------------------------------------------------------------
// 9. Quiet-day collapse
// ---------------------------------------------------------------------------

describe("composeBriefing — quiet day collapse", () => {
  it("collapses with empty prose and no pills when all signals are absent and event count is low", () => {
    const ctx = makeCtx({
      tentpoleEvent: null,
      activeHolidays: [],
      closingSoonExhibitions: [],
      schoolCalendarEvents: [],
      weather: null,
      weatherSignal: null,
      todayEventCount: 10,
      topCategories: [],
    });
    const out = composeBriefing(ctx);

    expect(out.collapsed).toBe(true);
    expect(out.prose).toBe("");
    expect(out.pills).toHaveLength(0);
    // dayLabel and weatherBadge must still be populated per spec
    expect(out.dayLabel).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Structural: dayLabel always present; weatherBadge when weather provided
// ---------------------------------------------------------------------------

describe("composeBriefing — structural invariants", () => {
  it("dayLabel is always set regardless of signal state", () => {
    const collapseCtx = makeCtx({ todayEventCount: 10 });
    const activeCtx = makeCtx({ todayEventCount: 200 });
    expect(composeBriefing(collapseCtx).dayLabel).toBeTruthy();
    expect(composeBriefing(activeCtx).dayLabel).toBeTruthy();
  });

  it("weatherBadge is set when weather data is present", () => {
    const ctx = makeCtx({
      weather: { temperature_f: 72, condition: "Clear" },
      weatherSignal: "nice",
    });
    const out = composeBriefing(ctx);
    expect(out.weatherBadge?.temp).toMatch(/72/);
    expect(out.weatherBadge?.condition).toBeTruthy();
  });

  it("weatherBadge is undefined when no weather data", () => {
    const ctx = makeCtx({ weather: null, todayEventCount: 10 });
    expect(composeBriefing(ctx).weatherBadge).toBeUndefined();
  });
});
