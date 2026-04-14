import { describe, it, expect } from "vitest";
import { classifyIntent } from "@/lib/search/understanding/intent";
import { tokenize } from "@/lib/search/understanding/tokenize";

function intentFor(q: string) {
  return classifyIntent(q, tokenize(q));
}

describe("classifyIntent", () => {
  it("defaults to find_event for freeform queries", () => {
    expect(intentFor("jazz").type).toBe("find_event");
    expect(intentFor("live music").type).toBe("find_event");
  });

  it("classifies place-ish queries as find_venue", () => {
    expect(intentFor("coffee shops").type).toBe("find_venue");
    expect(intentFor("restaurants near me").type).toBe("find_venue");
  });

  it("classifies bare category names as browse_category", () => {
    expect(intentFor("comedy").type).toBe("browse_category");
    expect(intentFor("food").type).toBe("browse_category");
  });

  it("returns unknown for pathological input", () => {
    expect(intentFor("").type).toBe("unknown");
  });

  it("returns confidence between 0 and 1", () => {
    const i = intentFor("jazz brunch");
    expect(i.confidence).toBeGreaterThanOrEqual(0);
    expect(i.confidence).toBeLessThanOrEqual(1);
  });
});
