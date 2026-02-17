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

describe("portal isolation guardrails", () => {
  it("core portal routes use shared scope/context helpers", () => {
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
    ];

    const missingContext: string[] = [];

    for (const route of routes) {
      const content = read(route);
      if (!content.includes("resolvePortalQueryContext")) {
        missingContext.push(route);
      }
    }

    expect(missingContext).toEqual([]);
  });

  it("critical read paths do not inline raw portal_id eq/is.null filter strings", () => {
    const files = [
      "app/api/feed/route.ts",
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
      "app/api/portals/[slug]/happening-now/route.ts",
      "app/api/portals/[slug]/explore/route.ts",
      "app/api/portals/[slug]/feed/route.ts",
      "app/api/portals/[slug]/destinations/specials/route.ts",
      "lib/search.ts",
    ];

    const offenders: string[] = [];
    for (const file of files) {
      const content = read(file);
      const hasRawScope =
        content.includes("portal_id.eq.") ||
        content.includes("portal_id.is.null");
      if (hasRawScope) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
