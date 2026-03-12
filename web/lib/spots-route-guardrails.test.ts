import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function read(relativePath: string): string {
  const libRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  return fs.readFileSync(path.join(libRoot, relativePath), "utf-8");
}

describe("spots route guardrails", () => {
  it("uses shared portal context resolution and mismatch handling", () => {
    const content = read("app/api/spots/route.ts");

    expect(content).toContain("getCachedPortalQueryContext");
    expect(content).toContain("resolvePortalQueryContext");
    expect(content).toContain("hasPortalParamMismatch");
    expect(content).toContain("PORTAL_PARAM_MISMATCH_ERROR");
  });

  it("keeps the event-led discovery fast path and guarded fallback", () => {
    const content = read("app/api/spots/route.ts");

    expect(content).toContain("shouldUseEventLedSpotsDiscovery");
    expect(content).toContain("get_spot_event_counts");
    expect(content).toContain("event_led_fallback");
    expect(content).toContain(
      "Spots event-led discovery failed; falling back to venue-first path",
    );
  });
});
