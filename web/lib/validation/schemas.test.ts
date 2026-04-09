import { describe, it, expect } from "vitest";
import { paginationSchema, uuidSchema, portalSlugSchema, sortSchema } from "./schemas";

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
