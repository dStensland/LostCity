import { describe, expect, it } from "vitest";
import { getPortalVertical } from "@/lib/portal";
import type { Portal } from "@/lib/portal-context";

function buildPortal(settings?: Portal["settings"]): Portal {
  return {
    id: "portal-id",
    slug: "example",
    name: "Example",
    tagline: null,
    portal_type: "event",
    status: "active",
    visibility: "public",
    filters: {},
    branding: {},
    settings: settings || {},
  };
}

describe("getPortalVertical", () => {
  it("maps civic portals onto the community vertical shell", () => {
    expect(getPortalVertical(buildPortal({ vertical: "civic" }))).toBe("community");
  });

  it("preserves existing vertical values", () => {
    expect(getPortalVertical(buildPortal({ vertical: "community" }))).toBe("community");
    expect(getPortalVertical(buildPortal({ vertical: "hotel" }))).toBe("hotel");
  });

  it("falls back to city when no vertical is configured", () => {
    expect(getPortalVertical(buildPortal())).toBe("city");
  });
});
