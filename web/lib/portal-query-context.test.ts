import { describe, expect, it } from "vitest";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";

type PortalRow = {
  id: string;
  slug: string;
  status: string;
  filters: Record<string, unknown> | string | null;
};

class MockPortalQuery {
  private readonly rows: PortalRow[];
  private filters: Record<string, string> = {};

  constructor(rows: PortalRow[]) {
    this.rows = rows;
  }

  select() {
    return this;
  }

  eq(column: string, value: string) {
    this.filters[column] = value;
    return this;
  }

  async maybeSingle(): Promise<{ data: PortalRow | null }> {
    const match = this.rows.find((row) => {
      for (const [key, value] of Object.entries(this.filters)) {
        const rowValue = row[key as keyof PortalRow];
        if (String(rowValue) !== value) return false;
      }
      return true;
    });
    return { data: match || null };
  }
}

function createMockSupabase(rows: PortalRow[]) {
  return {
    from(table: string) {
      if (table !== "portals") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return new MockPortalQuery(rows);
    },
  };
}

describe("resolvePortalQueryContext", () => {
  const rows: PortalRow[] = [
    {
      id: "11111111-1111-1111-1111-111111111111",
      slug: "atlanta",
      status: "active",
      filters: { city: "Atlanta", categories: ["music"] },
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      slug: "emory-demo",
      status: "active",
      filters: JSON.stringify({
        city: "Atlanta",
        cities: ["Atlanta", "Decatur"],
        neighborhoods: ["Druid Hills"],
      }),
    },
  ];

  it("resolves by slug (portal param) and parses filters", async () => {
    const supabase = createMockSupabase(rows);
    const params = new URLSearchParams({ portal: "atlanta" });
    const result = await resolvePortalQueryContext(supabase as never, params);

    expect(result.portalId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.portalSlug).toBe("atlanta");
    expect(result.filters.city).toBe("Atlanta");
    expect(result.filters.categories).toEqual(["music"]);
    expect(result.hasPortalParamMismatch).toBe(false);
  });

  it("resolves alias slug to canonical slug", async () => {
    const supabase = createMockSupabase(rows);
    const params = new URLSearchParams({ portal: "atlanta-test" });
    const result = await resolvePortalQueryContext(supabase as never, params);

    expect(result.portalId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.portalSlug).toBe("atlanta");
    expect(result.hasPortalParamMismatch).toBe(false);
  });

  it("resolves by portal_id when only UUID is provided", async () => {
    const supabase = createMockSupabase(rows);
    const params = new URLSearchParams({
      portal_id: "22222222-2222-2222-2222-222222222222",
    });
    const result = await resolvePortalQueryContext(supabase as never, params);

    expect(result.portalId).toBe("22222222-2222-2222-2222-222222222222");
    expect(result.portalSlug).toBe("emory-demo");
    expect(result.filters.city).toBe("Atlanta");
    expect(result.filters.cities).toEqual(["Atlanta", "Decatur"]);
    expect(result.filters.neighborhoods).toEqual(["Druid Hills"]);
    expect(result.hasPortalParamMismatch).toBe(false);
  });

  it("prefers slug when both slug and portal_id are present", async () => {
    const supabase = createMockSupabase(rows);
    const params = new URLSearchParams({
      portal: "atlanta",
      portal_id: "22222222-2222-2222-2222-222222222222",
    });
    const result = await resolvePortalQueryContext(supabase as never, params);

    expect(result.portalId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.portalSlug).toBe("atlanta");
    expect(result.hasPortalParamMismatch).toBe(true);
  });

  it("supports legacy portal=<uuid> for backward compatibility", async () => {
    const supabase = createMockSupabase(rows);
    const params = new URLSearchParams({
      portal: "22222222-2222-2222-2222-222222222222",
    });
    const result = await resolvePortalQueryContext(supabase as never, params);

    expect(result.portalId).toBe("22222222-2222-2222-2222-222222222222");
    expect(result.portalSlug).toBe("emory-demo");
    expect(result.hasPortalParamMismatch).toBe(false);
  });

  it("marks no mismatch when slug and portal_id reference the same portal", async () => {
    const supabase = createMockSupabase(rows);
    const params = new URLSearchParams({
      portal: "atlanta",
      portal_id: "11111111-1111-1111-1111-111111111111",
    });
    const result = await resolvePortalQueryContext(supabase as never, params);

    expect(result.portalId).toBe("11111111-1111-1111-1111-111111111111");
    expect(result.portalSlug).toBe("atlanta");
    expect(result.hasPortalParamMismatch).toBe(false);
  });

  it("returns null context when portal is unknown", async () => {
    const supabase = createMockSupabase(rows);
    const params = new URLSearchParams({ portal: "unknown-portal" });
    const result = await resolvePortalQueryContext(supabase as never, params);

    expect(result.portalId).toBeNull();
    expect(result.portalSlug).toBe("unknown-portal");
    expect(result.filters).toEqual({});
    expect(result.hasPortalParamMismatch).toBe(false);
  });
});
