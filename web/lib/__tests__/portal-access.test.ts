import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCanonicalPortalRedirect } from "@/lib/portal-access";

/**
 * Tests for the helper that powers Phase 5's portal-attribution check
 * in the events API. The same helper is used by the canonical event +
 * exhibition pages — overlay behavior must match those.
 *
 * Contract:
 *   - sourceId or portalId missing → null (no redirect — allow render)
 *   - source IS federated to current portal → null (allow)
 *   - source NOT federated AND has owner portal → return owner portal slug
 *   - source NOT federated AND no owner → null (defensive)
 */

const supabaseMock = vi.hoisted(() => {
  const portalSourceAccess: Record<string, unknown> = { data: null };
  const sources: Record<string, unknown> = { data: null };

  const fromHandlers: Record<
    string,
    () => {
      select: () => {
        eq: (...args: unknown[]) => {
          eq?: (...args: unknown[]) => { maybeSingle: () => Promise<unknown> };
          maybeSingle: () => Promise<unknown>;
        };
      };
    }
  > = {
    portal_source_access: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(portalSourceAccess),
          }),
        }),
      }),
    }),
    sources: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(sources),
        }),
      }),
    }),
  };

  return {
    portalSourceAccess,
    sources,
    client: {
      from: (table: string) => {
        const handler = fromHandlers[table];
        if (!handler) throw new Error(`Unmocked table: ${table}`);
        return handler();
      },
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(supabaseMock.client),
}));

describe("getCanonicalPortalRedirect", () => {
  beforeEach(() => {
    supabaseMock.portalSourceAccess.data = null;
    supabaseMock.sources.data = null;
  });

  it("returns null when sourceId is missing", async () => {
    const result = await getCanonicalPortalRedirect(null, "portal-a");
    expect(result).toBeNull();
  });

  it("returns null when sourceId is undefined", async () => {
    const result = await getCanonicalPortalRedirect(undefined, "portal-a");
    expect(result).toBeNull();
  });

  it("returns null when currentPortalId is missing", async () => {
    const result = await getCanonicalPortalRedirect(42, undefined);
    expect(result).toBeNull();
  });

  it("returns null when source is federated to current portal", async () => {
    supabaseMock.portalSourceAccess.data = { portal_id: "portal-a" };
    const result = await getCanonicalPortalRedirect(42, "portal-a");
    expect(result).toBeNull();
  });

  it("returns canonical portal slug when source is NOT federated", async () => {
    // No federation row in portal_source_access
    supabaseMock.portalSourceAccess.data = null;
    // Source's owner portal is 'arts'
    supabaseMock.sources.data = {
      owner_portal_id: "owner-portal-id",
      portal: { slug: "arts" },
    };
    const result = await getCanonicalPortalRedirect(42, "portal-a");
    expect(result).toBe("arts");
  });

  it("returns null when source has no owner portal (defensive)", async () => {
    supabaseMock.portalSourceAccess.data = null;
    supabaseMock.sources.data = {
      owner_portal_id: null,
      portal: null,
    };
    const result = await getCanonicalPortalRedirect(42, "portal-a");
    expect(result).toBeNull();
  });

  it("returns null when sources lookup returns no row at all", async () => {
    supabaseMock.portalSourceAccess.data = null;
    supabaseMock.sources.data = null;
    const result = await getCanonicalPortalRedirect(42, "portal-a");
    expect(result).toBeNull();
  });
});
