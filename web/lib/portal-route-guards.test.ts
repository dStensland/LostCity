import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function read(relativePath: string): string {
  const libRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
  );
  return fs.readFileSync(path.join(libRoot, relativePath), "utf-8");
}

describe("portal route guardrails", () => {
  it("core discovery routes reject portal param mismatches", () => {
    const routes = [
      "app/api/feed/route.ts",
      "app/api/search/route.ts",
      "app/api/search/instant/route.ts",
      "app/api/timeline/route.ts",
      "app/api/trending/route.ts",
      "app/api/tonight/route.ts",
      "app/api/events/[id]/route.ts",
      "app/api/events/live/route.ts",
      "app/api/events/search/route.ts",
      "app/api/calendar/route.ts",
      "app/api/classes/route.ts",
      "app/api/series/[slug]/route.ts",
      "app/api/around-me/route.ts",
      "app/api/spots/route.ts",
      "app/api/festivals/[slug]/route.ts",
      "app/api/venues/[id]/events/route.ts",
      "app/api/activities/popular/route.ts",
    ];

    const missing: string[] = [];
    for (const route of routes) {
      const content = read(route);
      if (!content.includes("hasPortalParamMismatch")) {
        missing.push(route);
      }
    }

    expect(missing).toEqual([]);
  });
});
