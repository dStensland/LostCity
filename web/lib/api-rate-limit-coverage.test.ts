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

describe("API rate limiting coverage", () => {
  it("ensures all API routes call applyRateLimit", () => {
    const apiRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../app/api"
    );
    const routes = collectRouteFiles(apiRoot);

    // Routes that are exempt from rate limiting:
    // - Public data endpoints (cached, high-volume, no auth)
    // - Development/feature routes that aren't production APIs yet
    const exemptPatterns = [
      "neighborhoods/boundaries",  // Static GeoJSON boundary data, heavily cached
      "neighborhoods/events",      // Read-only aggregated public data
      "goblinday/",                // Development feature, not yet a public API
    ];

    const missing = routes.filter((routePath) => {
      const isExempt = exemptPatterns.some((pattern) =>
        routePath.includes(pattern)
      );
      if (isExempt) return false;

      const content = fs.readFileSync(routePath, "utf-8");
      return !content.includes("applyRateLimit");
    });

    expect(missing).toEqual([]);
  });
});
