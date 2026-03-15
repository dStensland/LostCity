import { describe, expect, it } from "vitest";

import {
  getCommittedSearchTypesForQuery,
  shouldNarrowCommittedSearchToEntities,
} from "@/lib/query-intent";

describe("shouldNarrowCommittedSearchToEntities", () => {
  it("narrows short ambiguous proper nouns", () => {
    expect(shouldNarrowCommittedSearchToEntities("callanwolde")).toBe(true);
    expect(shouldNarrowCommittedSearchToEntities("high")).toBe(true);
    expect(shouldNarrowCommittedSearchToEntities("fox")).toBe(true);
  });

  it("does not narrow explicit event-intent queries", () => {
    expect(shouldNarrowCommittedSearchToEntities("live music tonight")).toBe(false);
    expect(shouldNarrowCommittedSearchToEntities("comedy")).toBe(false);
  });

  it("does not narrow explicit venue or location queries", () => {
    expect(shouldNarrowCommittedSearchToEntities("best bar")).toBe(false);
    expect(shouldNarrowCommittedSearchToEntities("o4w")).toBe(false);
  });
});

describe("getCommittedSearchTypesForQuery", () => {
  it("returns venue/organizer only for ambiguous entity queries", () => {
    expect(getCommittedSearchTypesForQuery("masquerade")).toEqual([
      "venue",
      "organizer",
    ]);
  });

  it("keeps the full committed search contract for event-like queries", () => {
    expect(getCommittedSearchTypesForQuery("live music tonight")).toEqual([
      "event",
      "venue",
      "organizer",
    ]);
  });
});
