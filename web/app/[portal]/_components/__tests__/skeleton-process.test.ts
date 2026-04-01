import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../..");

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf-8");
}

describe("portal skeleton process guardrails", () => {
  it("keeps route skeleton markers for every required portal loading surface", () => {
    const routeLoader = read("loading.tsx");
    const pageFile = read("page.tsx");
    const eventLoader = read("events/[id]/loading.tsx");
    const happeningLoader = read("happening-now/loading.tsx");

    expect(routeLoader).toContain('data-skeleton-route="portal-root"');
    expect(pageFile).toContain('data-skeleton-route="feed-view"');
    expect(pageFile).toContain('data-skeleton-route="happening-view"');
    expect(pageFile).toContain('data-skeleton-route="places-view"');
    expect(eventLoader).toContain('data-skeleton-route="event-detail"');
    expect(happeningLoader).toContain('data-skeleton-route="happening-now"');
  });

  it("uses the shared skeleton vertical resolver in loading files", () => {
    const routeLoader = read("loading.tsx");
    const eventLoader = read("events/[id]/loading.tsx");
    const happeningLoader = read("happening-now/loading.tsx");

    // Root loading.tsx is a server component — uses inferSkeletonVerticalFromSlug
    expect(routeLoader).toContain("inferSkeletonVerticalFromSlug");

    // Sub-route loaders are client components — use resolveSkeletonVertical
    for (const source of [eventLoader, happeningLoader]) {
      expect(source).toContain("resolveSkeletonVertical");
    }
  });
});
