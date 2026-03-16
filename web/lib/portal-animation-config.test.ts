import { describe, expect, it } from "vitest";
import { getVerticalStyles } from "@/lib/portal-animation-config";

describe("getVerticalStyles", () => {
  it("normalizes legacy aliases before resolving styles", () => {
    expect(getVerticalStyles("civic")).toContain('[data-vertical="community"]');
  });

  it("returns null for supported default-style verticals", () => {
    expect(getVerticalStyles("family")).toBeNull();
    expect(getVerticalStyles("sports")).toBeNull();
  });

  it("returns null for unsupported values", () => {
    expect(getVerticalStyles("unknown")).toBeNull();
  });
});
