import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";
import { resolvePortalId, extractPortalSlugFromReferer } from "@/lib/portal-resolution";

vi.mock("@/lib/portal-resolution", () => ({
  resolvePortalId: vi.fn(),
  extractPortalSlugFromReferer: vi.fn(() => null),
}));

describe("resolvePortalAttributionForWrite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns portal id when resolution succeeds", async () => {
    vi.mocked(resolvePortalId).mockResolvedValue("portal-123");

    const request = new NextRequest("http://localhost:3000/api/rsvp", {
      method: "POST",
    });

    const result = await resolvePortalAttributionForWrite(request, {
      endpoint: "/api/rsvp",
      body: { event_id: 10, status: "going" },
    });

    expect(result.response).toBeNull();
    expect(result.portalId).toBe("portal-123");
  });

  it("allows missing attribution when no hints are present", async () => {
    vi.mocked(resolvePortalId).mockResolvedValue(null);
    vi.mocked(extractPortalSlugFromReferer).mockReturnValue(null);

    const request = new NextRequest("http://localhost:3000/api/rsvp", {
      method: "POST",
    });

    const result = await resolvePortalAttributionForWrite(request, {
      endpoint: "/api/rsvp",
      body: { event_id: 10, status: "going" },
      requireWhenHinted: true,
    });

    expect(result.response).toBeNull();
    expect(result.portalId).toBeNull();
  });

  it("returns 400 when attribution is hinted but unresolved", async () => {
    vi.mocked(resolvePortalId).mockResolvedValue(null);

    const request = new NextRequest("http://localhost:3000/api/rsvp?portal=atlanta", {
      method: "POST",
    });

    const result = await resolvePortalAttributionForWrite(request, {
      endpoint: "/api/rsvp",
      body: { event_id: 10, status: "going" },
      requireWhenHinted: true,
    });

    expect(result.portalId).toBeNull();
    expect(result.response?.status).toBe(400);
  });
});
