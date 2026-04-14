import { describe, it, expect } from "vitest";
import { linkEntities } from "@/lib/search/understanding/entities";
import { tokenize } from "@/lib/search/understanding/tokenize";

describe("linkEntities (Phase 0 stub)", () => {
  it("returns an empty array for any input", () => {
    const entities = linkEntities("jazz brunch", tokenize("jazz brunch"), {
      portal_id: "test",
      portal_slug: "atlanta",
    });
    expect(entities).toEqual([]);
  });

  it("accepts empty tokens without error", () => {
    expect(linkEntities("", [], { portal_id: "x", portal_slug: "y" })).toEqual([]);
  });
});
