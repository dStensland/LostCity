import { describe, expect, it } from "vitest";
import { computeIntrinsicScore, getCardTier } from "./tier-assignment";

describe("tier-assignment — is_curator_pick", () => {
  it("forces hero tier when is_curator_pick is true, even without other signals", () => {
    expect(getCardTier({ is_curator_pick: true })).toBe("hero");
  });

  it("does not affect tier when is_curator_pick is false", () => {
    expect(getCardTier({ is_curator_pick: false })).toBe("standard");
  });

  it("adds to intrinsic score when true", () => {
    const withPick = computeIntrinsicScore({ is_curator_pick: true });
    const withoutPick = computeIntrinsicScore({ is_curator_pick: false });
    expect(withPick).toBeGreaterThan(withoutPick);
  });
});
