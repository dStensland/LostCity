import { describe, it, expect } from "vitest";
import { buildFindUrl } from "@/lib/find-url";

describe("buildFindUrl", () => {
  it("builds base explore URL with no params", () => {
    expect(buildFindUrl({ portalSlug: "atlanta" })).toBe("/atlanta?view=find");
  });

  it("builds lane URL", () => {
    expect(buildFindUrl({ portalSlug: "atlanta", lane: "events" })).toBe(
      "/atlanta?view=find&lane=events"
    );
  });

  it("builds search URL with canonical param name", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", search: "jazz" })
    ).toBe("/atlanta?view=find&lane=events&search=jazz");
  });

  it("builds date filter URL", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", date: "today" })
    ).toBe("/atlanta?view=find&lane=events&date=today");
  });

  it("builds categories filter URL", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", categories: "music" })
    ).toBe("/atlanta?view=find&lane=events&categories=music");
  });

  it("builds price filter URL", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", price: "free" })
    ).toBe("/atlanta?view=find&lane=events&price=free");
  });

  it("encodes search values", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", search: "live jazz & blues" })
    ).toBe("/atlanta?view=find&lane=events&search=live+jazz+%26+blues");
  });

  it("omits undefined params", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", search: undefined })
    ).toBe("/atlanta?view=find&lane=events");
  });
});
