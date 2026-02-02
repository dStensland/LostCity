import { describe, it, expect } from "vitest";
import {
  isValidUUID,
  isValidString,
  isValidPositiveInt,
  parseIntParam,
  parseFloatParam,
  isValidEnum,
  isValidStringArray,
  isValidUrl,
  sanitizeString,
  escapeSQLPattern,
} from "./api-utils";

describe("api-utils", () => {
  describe("isValidUUID", () => {
    it("validates correct UUIDs", () => {
      expect(isValidUUID("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isValidUUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(true);
    });

    it("rejects invalid UUIDs", () => {
      expect(isValidUUID("not-a-uuid")).toBe(false);
      expect(isValidUUID("550e8400-e29b-41d4-a716")).toBe(false);
      expect(isValidUUID("")).toBe(false);
      expect(isValidUUID(null)).toBe(false);
      expect(isValidUUID(undefined)).toBe(false);
      expect(isValidUUID(123)).toBe(false);
    });
  });

  describe("isValidString", () => {
    it("validates strings within length constraints", () => {
      expect(isValidString("hello")).toBe(true);
      expect(isValidString("a")).toBe(true);
      expect(isValidString("a".repeat(1000))).toBe(true);
    });

    it("rejects strings outside length constraints", () => {
      expect(isValidString("")).toBe(false);
      expect(isValidString("a".repeat(1001))).toBe(false);
    });

    it("rejects non-strings", () => {
      expect(isValidString(123)).toBe(false);
      expect(isValidString(null)).toBe(false);
      expect(isValidString(undefined)).toBe(false);
      expect(isValidString({})).toBe(false);
    });

    it("respects custom length constraints", () => {
      expect(isValidString("ab", 2, 5)).toBe(true);
      expect(isValidString("a", 2, 5)).toBe(false);
      expect(isValidString("abcdef", 2, 5)).toBe(false);
    });
  });

  describe("isValidPositiveInt", () => {
    it("validates positive integers", () => {
      expect(isValidPositiveInt(1)).toBe(true);
      expect(isValidPositiveInt(100)).toBe(true);
      expect(isValidPositiveInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    });

    it("rejects non-positive or non-integers", () => {
      expect(isValidPositiveInt(0)).toBe(false);
      expect(isValidPositiveInt(-1)).toBe(false);
      expect(isValidPositiveInt(1.5)).toBe(false);
      expect(isValidPositiveInt(NaN)).toBe(false);
      expect(isValidPositiveInt(Infinity)).toBe(false);
    });
  });

  describe("parseIntParam", () => {
    it("parses valid integers", () => {
      expect(parseIntParam("123")).toBe(123);
      expect(parseIntParam("-456")).toBe(-456);
      expect(parseIntParam("0")).toBe(0);
    });

    it("returns null for invalid values", () => {
      expect(parseIntParam("abc")).toBe(null);
      expect(parseIntParam("12.34")).toBe(12); // parseInt behavior
      expect(parseIntParam("")).toBe(null);
      expect(parseIntParam(null)).toBe(null);
    });

    it("respects default values", () => {
      expect(parseIntParam(null, 50)).toBe(50);
      expect(parseIntParam("", 50)).toBe(50);
      expect(parseIntParam("abc", 50)).toBe(null); // Invalid is null, not default
    });
  });

  describe("parseFloatParam", () => {
    it("parses valid floats", () => {
      expect(parseFloatParam("123.45")).toBe(123.45);
      expect(parseFloatParam("-456.78")).toBe(-456.78);
      expect(parseFloatParam("0")).toBe(0);
    });

    it("returns null for invalid values", () => {
      expect(parseFloatParam("abc")).toBe(null);
      expect(parseFloatParam("")).toBe(null);
      expect(parseFloatParam(null)).toBe(null);
    });

    it("respects default values", () => {
      expect(parseFloatParam(null, 3.14)).toBe(3.14);
      expect(parseFloatParam("", 3.14)).toBe(3.14);
    });
  });

  describe("isValidEnum", () => {
    const STATUSES = ["pending", "active", "completed"] as const;

    it("validates values in enum", () => {
      expect(isValidEnum("pending", STATUSES)).toBe(true);
      expect(isValidEnum("active", STATUSES)).toBe(true);
      expect(isValidEnum("completed", STATUSES)).toBe(true);
    });

    it("rejects values not in enum", () => {
      expect(isValidEnum("invalid", STATUSES)).toBe(false);
      expect(isValidEnum("", STATUSES)).toBe(false);
      expect(isValidEnum(123, STATUSES)).toBe(false);
    });
  });

  describe("isValidStringArray", () => {
    it("validates arrays of strings", () => {
      expect(isValidStringArray(["a", "b", "c"])).toBe(true);
      expect(isValidStringArray(["hello"])).toBe(true);
      expect(isValidStringArray([])).toBe(true);
    });

    it("rejects non-arrays or invalid items", () => {
      expect(isValidStringArray("not an array")).toBe(false);
      expect(isValidStringArray([1, 2, 3])).toBe(false);
      expect(isValidStringArray(["a", 1, "b"])).toBe(false);
      expect(isValidStringArray([""])).toBe(false); // Empty strings not valid
    });

    it("respects max items constraint", () => {
      expect(isValidStringArray(["a", "b"], 2)).toBe(true);
      expect(isValidStringArray(["a", "b", "c"], 2)).toBe(false);
    });

    it("respects max item length constraint", () => {
      expect(isValidStringArray(["ab", "cd"], 10, 2)).toBe(true);
      expect(isValidStringArray(["abc", "de"], 10, 2)).toBe(false);
    });
  });

  describe("isValidUrl", () => {
    it("validates http and https URLs", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("http://example.com")).toBe(true);
      expect(isValidUrl("https://example.com/path?query=1")).toBe(true);
    });

    it("rejects invalid URLs", () => {
      expect(isValidUrl("not a url")).toBe(false);
      expect(isValidUrl("ftp://example.com")).toBe(false);
      expect(isValidUrl("javascript:alert(1)")).toBe(false);
      expect(isValidUrl("data:text/html,<h1>Hi</h1>")).toBe(false);
    });
  });

  describe("sanitizeString", () => {
    it("escapes HTML special characters", () => {
      expect(sanitizeString("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;"
      );
      expect(sanitizeString('Hello "World"')).toBe("Hello &quot;World&quot;");
      expect(sanitizeString("A > B < C")).toBe("A &gt; B &lt; C");
    });

    it("trims whitespace", () => {
      expect(sanitizeString("  hello  ")).toBe("hello");
    });

    it("handles normal strings unchanged", () => {
      expect(sanitizeString("Hello World")).toBe("Hello World");
    });
  });

  describe("escapeSQLPattern", () => {
    it("escapes SQL LIKE/ILIKE special characters", () => {
      // Test % wildcard
      expect(escapeSQLPattern("100%")).toBe("100\\%");
      expect(escapeSQLPattern("%off")).toBe("\\%off");

      // Test _ wildcard
      expect(escapeSQLPattern("a_b")).toBe("a\\_b");
      expect(escapeSQLPattern("test_name")).toBe("test\\_name");

      // Test backslash
      expect(escapeSQLPattern("path\\file")).toBe("path\\\\file");
    });

    it("escapes multiple special characters", () => {
      expect(escapeSQLPattern("50% off_sale\\today")).toBe(
        "50\\% off\\_sale\\\\today"
      );
    });

    it("handles normal strings unchanged", () => {
      expect(escapeSQLPattern("Hello World")).toBe("Hello World");
      expect(escapeSQLPattern("concert")).toBe("concert");
    });

    it("prevents SQL pattern injection attacks", () => {
      // Attacker trying to match everything
      expect(escapeSQLPattern("%")).toBe("\\%");
      expect(escapeSQLPattern("%%")).toBe("\\%\\%");

      // Attacker trying single-char wildcards
      expect(escapeSQLPattern("___")).toBe("\\_\\_\\_");

      // Complex attack pattern
      expect(escapeSQLPattern("%admin%")).toBe("\\%admin\\%");
    });
  });
});
