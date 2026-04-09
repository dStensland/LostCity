import { describe, it, expect } from "vitest";
import { paginationSchema, uuidSchema, portalSlugSchema, sortSchema, positiveIntSchema, rsvpBodySchema } from "./schemas";

describe("paginationSchema", () => {
  it("applies defaults when no values provided", () => {
    const result = paginationSchema.parse({});
    expect(result).toEqual({ limit: 20, offset: 0 });
  });

  it("accepts valid values", () => {
    const result = paginationSchema.parse({ limit: "50", offset: "10" });
    expect(result).toEqual({ limit: 50, offset: 10 });
  });

  it("caps limit at 100", () => {
    const result = paginationSchema.parse({ limit: "999" });
    expect(result.limit).toBe(100);
  });

  it("rejects negative offset", () => {
    expect(() => paginationSchema.parse({ offset: "-5" })).toThrow();
  });

  it("coerces string numbers from query params", () => {
    const result = paginationSchema.parse({ limit: "25", offset: "5" });
    expect(result).toEqual({ limit: 25, offset: 5 });
  });
});

describe("uuidSchema", () => {
  it("accepts valid UUIDs", () => {
    const result = uuidSchema.parse("550e8400-e29b-41d4-a716-446655440000");
    expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid UUIDs", () => {
    expect(() => uuidSchema.parse("not-a-uuid")).toThrow();
    expect(() => uuidSchema.parse("")).toThrow();
  });
});

describe("portalSlugSchema", () => {
  it("lowercases and trims the slug", () => {
    expect(portalSlugSchema.parse("Atlanta")).toBe("atlanta");
    expect(portalSlugSchema.parse("  FORTH  ")).toBe("forth");
  });

  it("rejects empty strings", () => {
    expect(() => portalSlugSchema.parse("")).toThrow();
  });

  it("accepts hyphens", () => {
    expect(portalSlugSchema.parse("lost-arts")).toBe("lost-arts");
  });

  it("rejects path traversal characters", () => {
    expect(() => portalSlugSchema.parse("../../admin")).toThrow();
    expect(() => portalSlugSchema.parse("portal/slug")).toThrow();
  });

  it("rejects slugs over 50 characters", () => {
    expect(() => portalSlugSchema.parse("a".repeat(51))).toThrow();
  });
});

describe("sortSchema", () => {
  it("accepts valid sort params", () => {
    const schema = sortSchema(["date", "name", "relevance"]);
    const result = schema.parse({ sort_by: "date", sort_order: "desc" });
    expect(result).toEqual({ sort_by: "date", sort_order: "desc" });
  });

  it("defaults sort_order to asc", () => {
    const schema = sortSchema(["date", "name"]);
    const result = schema.parse({ sort_by: "date" });
    expect(result).toEqual({ sort_by: "date", sort_order: "asc" });
  });

  it("rejects invalid sort_by values", () => {
    const schema = sortSchema(["date", "name"]);
    expect(() => schema.parse({ sort_by: "invalid" })).toThrow();
  });
});

describe("positiveIntSchema", () => {
  it("accepts positive integers", () => {
    const result = positiveIntSchema.parse(5);
    expect(result).toBe(5);
  });

  it("coerces string numbers", () => {
    const result = positiveIntSchema.parse("42");
    expect(result).toBe(42);
  });

  it("rejects zero", () => {
    expect(() => positiveIntSchema.parse(0)).toThrow();
  });

  it("rejects negative numbers", () => {
    expect(() => positiveIntSchema.parse(-5)).toThrow();
    expect(() => positiveIntSchema.parse("-10")).toThrow();
  });

  it("rejects non-numeric strings", () => {
    expect(() => positiveIntSchema.parse("abc")).toThrow();
    expect(() => positiveIntSchema.parse("")).toThrow();
  });
});

describe("rsvpBodySchema", () => {
  it("accepts valid RSVP body", () => {
    const result = rsvpBodySchema.parse({
      event_id: 42,
      status: "going",
    });
    expect(result).toEqual({
      event_id: 42,
      status: "going",
      visibility: "friends", // default
    });
  });

  it("accepts all valid status values", () => {
    for (const status of ["going", "interested", "went"]) {
      const result = rsvpBodySchema.parse({ event_id: 1, status });
      expect(result.status).toBe(status);
    }
  });

  it("defaults visibility to friends", () => {
    const result = rsvpBodySchema.parse({ event_id: 1, status: "going" });
    expect(result.visibility).toBe("friends");
  });

  it("accepts explicit visibility", () => {
    const result = rsvpBodySchema.parse({
      event_id: 1,
      status: "going",
      visibility: "public",
    });
    expect(result.visibility).toBe("public");
  });

  it("rejects invalid status", () => {
    expect(() =>
      rsvpBodySchema.parse({ event_id: 1, status: "maybe" })
    ).toThrow();
  });

  it("rejects non-positive event_id", () => {
    expect(() =>
      rsvpBodySchema.parse({ event_id: 0, status: "going" })
    ).toThrow();
    expect(() =>
      rsvpBodySchema.parse({ event_id: -1, status: "going" })
    ).toThrow();
  });

  it("rejects non-integer event_id", () => {
    expect(() =>
      rsvpBodySchema.parse({ event_id: 1.5, status: "going" })
    ).toThrow();
  });

  it("accepts optional notify_friends", () => {
    const result = rsvpBodySchema.parse({
      event_id: 1,
      status: "going",
      notify_friends: true,
    });
    expect(result.notify_friends).toBe(true);
  });
});
