import { describe, expect, it } from "vitest";
import { shortVenueName } from "./short-venue-name";

describe("shortVenueName", () => {
  it("strips leading 'The '", () => {
    expect(shortVenueName("The EARL")).toBe("EARL");
    expect(shortVenueName("The Tabernacle")).toBe("Tabernacle");
  });

  it("strips leading 'Atlanta '", () => {
    expect(shortVenueName("Atlanta Symphony Hall")).toBe("Symphony Hall");
  });

  it("strips parenthetical room suffixes", () => {
    expect(shortVenueName("Smith's Olde Bar (Music Room)")).toBe("Smith's Olde Bar");
    expect(shortVenueName("Some Venue (Atrium)")).toBe("Some Venue");
  });

  it("strips dash-separated room suffixes", () => {
    expect(shortVenueName("Eddie's Attic — Listening Room")).toBe("Eddie's Attic");
    expect(shortVenueName("Big Theater - Main Stage")).toBe("Big Theater");
    expect(shortVenueName("Some Place – Lounge")).toBe("Some Place");
  });

  it("leaves names without strippable tokens unchanged", () => {
    expect(shortVenueName("Terminal West")).toBe("Terminal West");
    expect(shortVenueName("Variety Playhouse")).toBe("Variety Playhouse");
    expect(shortVenueName("Aisle 5")).toBe("Aisle 5");
  });

  it("handles empty and falsy input gracefully", () => {
    expect(shortVenueName("")).toBe("");
  });

  it("does not strip 'The' from the middle of names", () => {
    expect(shortVenueName("Hard Rock The Mill")).toBe("Hard Rock The Mill");
  });
});
