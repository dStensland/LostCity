import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

function collectRouteFiles(dir: string, files: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectRouteFiles(fullPath, files);
      continue;
    }
    if (entry.isFile() && entry.name === "route.ts") {
      files.push(fullPath);
    }
  }
  return files;
}

// Tables that require portal attribution on writes
const PORTAL_ATTRIBUTED_TABLES = [
  "inferred_preferences",
  "event_rsvps",
  "saved_items",
  "follows",
  "hidden_events",
  "activity_reactions",
  "activities",
  "event_calendar_saves",
];

// Routes that are explicitly exempt from portal attribution
// (e.g., portal-scoped routes that get portal_id from the URL slug directly)
const EXEMPT_ROUTES = [
  "/api/portals/", // Portal-scoped routes get portal_id from slug
  "/api/auth/",    // Auth routes don't write to attributed tables
  "/api/push/",    // Push subscription management
  "/api/admin/",   // Admin routes
];

describe("Portal attribution coverage", () => {
  it("ensures write routes to user-activity tables include portal attribution", () => {
    const apiRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../app/api"
    );
    const routes = collectRouteFiles(apiRoot);

    const missing: string[] = [];

    for (const routePath of routes) {
      const content = fs.readFileSync(routePath, "utf-8");

      // Skip routes that don't have POST/PUT/PATCH (read-only routes)
      if (
        !content.includes("export async function POST") &&
        !content.includes("export async function PUT") &&
        !content.includes("export async function PATCH")
      ) {
        continue;
      }

      // Skip exempt routes
      const relativePath = routePath.replace(apiRoot, "/api");
      if (EXEMPT_ROUTES.some((exempt) => relativePath.startsWith(exempt))) {
        continue;
      }

      // Check if route writes to any portal-attributed table
      const writesToAttributedTable = PORTAL_ATTRIBUTED_TABLES.some(
        (table) =>
          content.includes(`.from("${table}")`) &&
          (content.includes(".insert(") ||
            content.includes(".upsert(") ||
            content.includes(".update("))
      );

      if (!writesToAttributedTable) {
        continue;
      }

      // Route writes to an attributed table — verify it has portal attribution
      const hasPortalAttribution =
        content.includes("resolvePortalId") ||
        content.includes("portal_id") ||
        content.includes("portalId");

      if (!hasPortalAttribution) {
        missing.push(relativePath);
      }
    }

    expect(missing).toEqual([]);
  });

  it("enforces shared attribution guard on critical behavioral write routes", () => {
    const libRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      ".."
    );

    const criticalRoutes = [
      "app/api/rsvp/route.ts",
      "app/api/saved/route.ts",
      "app/api/follow/route.ts",
      "app/api/events/hide/route.ts",
      "app/api/reactions/route.ts",
      "app/api/personalization/feedback/route.ts",
      "app/api/personalization/hide/route.ts",
      "app/api/signals/track/route.ts",
      "app/api/onboarding/complete/route.ts",
      "app/api/user/calendar/save/route.ts",
    ];

    const missing: string[] = [];

    for (const relativePath of criticalRoutes) {
      const fullPath = path.join(libRoot, relativePath);
      const content = fs.readFileSync(fullPath, "utf-8");

      const usesGuard =
        content.includes("resolvePortalAttributionForWrite") &&
        content.includes('from "@/lib/portal-attribution"');

      if (!usesGuard) {
        missing.push(relativePath);
      }
    }

    expect(missing).toEqual([]);
  });

  it("ensures search venue RPC callers pass city parameter", () => {
    const libRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      ".."
    );
    const searchFile = path.join(libRoot, "lib", "unified-search.ts");
    const content = fs.readFileSync(searchFile, "utf-8");

    // Every call to search_venues_ranked should include p_city
    const rpcCalls = content.match(/search_venues_ranked.*?\}\)/gs) || [];
    for (const call of rpcCalls) {
      expect(call).toContain("p_city");
    }
  });
});
