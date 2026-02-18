import { describe, expect, it } from "vitest";
import { resolveSupportSourcePolicy } from "@/lib/support-source-policy";

describe("resolveSupportSourcePolicy", () => {
  it("matches by exact slug", () => {
    const result = resolveSupportSourcePolicy({ slug: "nami-georgia" });
    expect(result?.id).toBe("nami-georgia");
  });

  it("prefers specific piedmont cme match over broad piedmont healthcare match", () => {
    const result = resolveSupportSourcePolicy({ slug: "piedmont-healthcare-cme" });
    expect(result?.id).toBe("piedmont-cme");
  });

  it("maps piedmont healthcare nc variant to piedmont events policy", () => {
    const result = resolveSupportSourcePolicy({ slug: "piedmont-healthcare-nc" });
    expect(result?.id).toBe("piedmonthealthcare-events");
  });

  it("falls back to name matching when slug is missing", () => {
    const result = resolveSupportSourcePolicy({ name: "Fulton County Board of Health" });
    expect(result?.id).toBe("fulton-board-health");
  });

  it("returns null when neither slug nor name is provided", () => {
    const result = resolveSupportSourcePolicy({});
    expect(result).toBeNull();
  });
});
