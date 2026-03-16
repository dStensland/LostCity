import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: fromMock,
  },
}));

import {
  entityFamilyUsesCategoryConstraints,
  getPortalSourceAccess,
  isEventCategoryAllowedForSourceAccess,
  type PortalSourceAccess,
} from "@/lib/federation";

function buildSourceAccess(
  entityFamily: PortalSourceAccess["entityFamily"],
  categoryConstraints: Array<[number, string[] | null]>,
): PortalSourceAccess {
  return {
    entityFamily,
    sourceIds: categoryConstraints.map(([sourceId]) => sourceId),
    categoryConstraints: new Map(categoryConstraints),
    accessDetails: [],
  };
}

function buildQueryResult<T>(result: T, eqCallsUntilResolve: number) {
  let eqCallCount = 0;
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => {
      eqCallCount += 1;
      if (eqCallCount >= eqCallsUntilResolve) {
        return Promise.resolve(result);
      }
      return builder;
    }),
  };
  return builder;
}

beforeEach(() => {
  fromMock.mockReset();
});

describe("entityFamilyUsesCategoryConstraints", () => {
  it("only treats events as category-constrained today", () => {
    expect(entityFamilyUsesCategoryConstraints("events")).toBe(true);
    expect(entityFamilyUsesCategoryConstraints("programs")).toBe(false);
    expect(entityFamilyUsesCategoryConstraints("exhibitions")).toBe(false);
  });
});

describe("isEventCategoryAllowedForSourceAccess", () => {
  it("enforces source category constraints for event families", () => {
    const access = buildSourceAccess("events", [[10, ["music", "film"]]]);

    expect(isEventCategoryAllowedForSourceAccess(access, 10, "music")).toBe(true);
    expect(isEventCategoryAllowedForSourceAccess(access, 10, "sports")).toBe(false);
  });

  it("ignores category constraints for non-event families", () => {
    const access = buildSourceAccess("programs", [[10, ["music"]]]);

    expect(isEventCategoryAllowedForSourceAccess(access, 10, "sports")).toBe(true);
  });

  it("allows rows when no category metadata exists", () => {
    const access = buildSourceAccess("events", [[10, null]]);

    expect(isEventCategoryAllowedForSourceAccess(access, 10, "music")).toBe(true);
    expect(isEventCategoryAllowedForSourceAccess(access, 99, "music")).toBe(true);
    expect(isEventCategoryAllowedForSourceAccess(access, 10, null)).toBe(true);
  });
});

describe("getPortalSourceAccess", () => {
  it("reads event access from the legacy category-aware view", async () => {
    fromMock.mockReturnValueOnce(
      buildQueryResult(
        {
          data: [
            {
              source_id: 10,
              source_name: "Example Events",
              accessible_categories: ["music"],
              access_type: "subscription",
            },
          ],
          error: null,
        },
        1,
      ),
    );

    const access = await getPortalSourceAccess("portal-events", {
      entityFamily: "events",
    });

    expect(fromMock).toHaveBeenCalledWith("portal_source_access");
    expect(access.entityFamily).toBe("events");
    expect(access.sourceIds).toEqual([10]);
    expect(access.categoryConstraints.get(10)).toEqual(["music"]);
  });

  it("reads non-event access from the entity-family view", async () => {
    fromMock.mockReturnValueOnce(
      buildQueryResult(
        {
          data: [
            {
              source_id: 21,
              source_name: "Example Programs",
              entity_family: "programs",
              access_type: "subscription",
            },
          ],
          error: null,
        },
        2,
      ),
    );

    const access = await getPortalSourceAccess("portal-programs", {
      entityFamily: "programs",
    });

    expect(fromMock).toHaveBeenCalledWith("portal_source_entity_access");
    expect(access.entityFamily).toBe("programs");
    expect(access.sourceIds).toEqual([21]);
    expect(access.categoryConstraints.get(21)).toBeNull();
  });
});
