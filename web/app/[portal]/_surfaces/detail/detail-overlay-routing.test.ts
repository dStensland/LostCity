import { describe, expect, it } from "vitest";
import {
  buildDetailCloseFallbackUrl,
  hasDetailOverlayTarget,
  resolveDetailOverlayTarget,
} from "./detail-entry-contract";

describe("detail overlay routing", () => {
  it("resolves event overlay targets from query params", () => {
    const params = new URLSearchParams("event=42&lane=events");

    expect(resolveDetailOverlayTarget(params)).toEqual({
      kind: "event",
      id: 42,
    });
    expect(hasDetailOverlayTarget(params)).toBe(true);
  });

  it("ignores invalid event ids", () => {
    const params = new URLSearchParams("event=abc");

    expect(resolveDetailOverlayTarget(params)).toBeNull();
    expect(hasDetailOverlayTarget(params)).toBe(false);
  });

  it("builds close fallback urls without detail params", () => {
    const params = new URLSearchParams(
      "lane=events&event=42&search=jazz&festival=shaky-knees",
    );

    expect(buildDetailCloseFallbackUrl("/atlanta/explore", params)).toBe(
      "/atlanta/explore?lane=events&search=jazz",
    );
  });
});
