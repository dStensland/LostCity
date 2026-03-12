import { describe, expect, it } from "vitest";

import { resolveNeighborhood } from "@/lib/geo";

describe("resolveNeighborhood", () => {
  it("prefers Ponce City Market Area over Old Fourth Ward for PCM coordinates", () => {
    expect(resolveNeighborhood(33.7724, -84.3656)).toBe("Ponce City Market Area");
  });

  it("prefers Krog Street over Inman Park for Krog Market coordinates", () => {
    expect(resolveNeighborhood(33.7575, -84.3641)).toBe("Krog Street");
  });
});
