import { describe, expect, it } from "vitest";
import {
  buildFollowPortalScopeFilter,
  getUserFollowedEntityIds,
} from "@/lib/follows";

type MockFollowRow = {
  follower_id: string;
  followed_venue_id: number | null;
  followed_organization_id: string | null;
  portal_id: string | null;
};

class MockFollowsQuery {
  private followerId: string | null = null;
  private portalScopeFilter: string | null = null;

  constructor(private readonly rows: MockFollowRow[]) {}

  select() {
    return this;
  }

  eq(column: string, value: string) {
    if (column === "follower_id") this.followerId = value;
    return this;
  }

  or(filter: string) {
    this.portalScopeFilter = filter;
    return this;
  }

  private applyPortalScope(rows: MockFollowRow[]): MockFollowRow[] {
    if (!this.portalScopeFilter) return rows;

    const scopedMatch = this.portalScopeFilter.match(/^portal_id\.eq\.([0-9a-f-]{36})/i);
    const scopedPortalId = scopedMatch?.[1] || null;
    const includeUnscoped = this.portalScopeFilter.includes("portal_id.is.null");

    if (!scopedPortalId) return rows;
    return rows.filter((row) => {
      if (row.portal_id === scopedPortalId) return true;
      if (includeUnscoped && row.portal_id === null) return true;
      return false;
    });
  }

  private run() {
    const base = this.rows.filter((row) => row.follower_id === this.followerId);
    return this.applyPortalScope(base).map((row) => ({
      followed_venue_id: row.followed_venue_id,
      followed_organization_id: row.followed_organization_id,
    }));
  }

  then<TResult1 = { data: Array<{ followed_venue_id: number | null; followed_organization_id: string | null }> }, TResult2 = never>(
    onfulfilled?: ((value: { data: Array<{ followed_venue_id: number | null; followed_organization_id: string | null }> }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.run() }).then(onfulfilled, onrejected);
  }
}

function createMockSupabase(rows: MockFollowRow[]) {
  return {
    from(table: string) {
      if (table !== "follows") {
        throw new Error(`Unexpected table: ${table}`);
      }
      return new MockFollowsQuery(rows);
    },
  };
}

describe("buildFollowPortalScopeFilter", () => {
  it("returns null when portalId is missing", () => {
    expect(buildFollowPortalScopeFilter(null, true)).toBeNull();
  });

  it("returns scoped+unscoped filter when includeUnscoped=true", () => {
    const portalId = "11111111-1111-1111-1111-111111111111";
    expect(buildFollowPortalScopeFilter(portalId, true)).toBe(
      `portal_id.eq.${portalId},portal_id.is.null`,
    );
  });

  it("returns strict scoped filter when includeUnscoped=false", () => {
    const portalId = "11111111-1111-1111-1111-111111111111";
    expect(buildFollowPortalScopeFilter(portalId, false)).toBe(
      `portal_id.eq.${portalId}`,
    );
  });
});

describe("getUserFollowedEntityIds", () => {
  const rows: MockFollowRow[] = [
    {
      follower_id: "u1",
      followed_venue_id: 10,
      followed_organization_id: null,
      portal_id: null,
    },
    {
      follower_id: "u1",
      followed_venue_id: 10,
      followed_organization_id: null,
      portal_id: "11111111-1111-1111-1111-111111111111",
    },
    {
      follower_id: "u1",
      followed_venue_id: null,
      followed_organization_id: "org-1",
      portal_id: "11111111-1111-1111-1111-111111111111",
    },
    {
      follower_id: "u1",
      followed_venue_id: null,
      followed_organization_id: "org-2",
      portal_id: "22222222-2222-2222-2222-222222222222",
    },
    {
      follower_id: "u2",
      followed_venue_id: 88,
      followed_organization_id: "org-9",
      portal_id: null,
    },
  ];

  it("returns all followed entities when portalId is not provided", async () => {
    const supabase = createMockSupabase(rows);
    const result = await getUserFollowedEntityIds(supabase as never, "u1");

    expect(result.followedVenueIds).toEqual([10]);
    expect(result.followedOrganizationIds.sort()).toEqual(["org-1", "org-2"]);
  });

  it("includes unscoped follows when portalId is provided and includeUnscoped=true", async () => {
    const supabase = createMockSupabase(rows);
    const result = await getUserFollowedEntityIds(supabase as never, "u1", {
      portalId: "11111111-1111-1111-1111-111111111111",
      includeUnscoped: true,
    });

    expect(result.followedVenueIds).toEqual([10]);
    expect(result.followedOrganizationIds).toEqual(["org-1"]);
  });

  it("enforces strict portal scope when includeUnscoped=false", async () => {
    const supabase = createMockSupabase(rows);
    const result = await getUserFollowedEntityIds(supabase as never, "u1", {
      portalId: "11111111-1111-1111-1111-111111111111",
      includeUnscoped: false,
    });

    expect(result.followedVenueIds).toEqual([10]);
    expect(result.followedOrganizationIds).toEqual(["org-1"]);
  });
});
