import { describe, it, expect } from "vitest";
import { getPresearchConfig } from "@/lib/search/presearch-config";

describe("getPresearchConfig", () => {
  it("returns atlanta config", () => {
    const config = getPresearchConfig("atlanta");
    expect(config.quickIntents.length).toBeGreaterThan(0);
    expect(config.categories.length).toBeGreaterThan(0);
    expect(config.neighborhoods.length).toBeGreaterThan(0);
  });

  it("returns an empty neighborhoods array for unknown portals", () => {
    const config = getPresearchConfig("unknown-portal");
    expect(config.neighborhoods).toEqual([]);
  });

  it("quick intents have label + href", () => {
    const config = getPresearchConfig("atlanta");
    for (const intent of config.quickIntents) {
      expect(intent.label).toBeTruthy();
      expect(intent.href).toBeTruthy();
    }
  });
});
