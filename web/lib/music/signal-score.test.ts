import { describe, expect, it } from "vitest";
import { SCORE, scoreShow, ONE_NIGHT_PATTERN } from "./signal-score";
import { makeRawEventRow } from "./__fixtures__/raw-event";

describe("scoreShow", () => {
  it("returns CURATOR_PICK (100) when is_curator_pick is true", () => {
    expect(
      scoreShow(
        makeRawEventRow({
          is_curator_pick: true,
          importance: "flagship",
          is_tentpole: true,
        }),
      ),
    ).toBe(SCORE.CURATOR_PICK);
  });

  it("returns FLAGSHIP_OR_TENTPOLE (80) when importance is flagship", () => {
    expect(
      scoreShow(makeRawEventRow({ importance: "flagship" })),
    ).toBe(SCORE.FLAGSHIP_OR_TENTPOLE);
  });

  it("returns FLAGSHIP_OR_TENTPOLE (80) when is_tentpole is true", () => {
    expect(
      scoreShow(makeRawEventRow({ is_tentpole: true })),
    ).toBe(SCORE.FLAGSHIP_OR_TENTPOLE);
  });

  it("returns MAJOR (60) when importance is major", () => {
    expect(scoreShow(makeRawEventRow({ importance: "major" }))).toBe(
      SCORE.MAJOR,
    );
  });

  it("returns FESTIVAL (50) when festival_id is set", () => {
    expect(
      scoreShow(makeRawEventRow({ festival_id: "fest-123" })),
    ).toBe(SCORE.FESTIVAL);
  });

  it("returns ONE_NIGHT_TITLE (30) when title matches one-night pattern", () => {
    expect(
      scoreShow(makeRawEventRow({ title: "The Big Release Party" })),
    ).toBe(SCORE.ONE_NIGHT_TITLE);
  });

  it("returns 0 for a generic show with no signals", () => {
    expect(scoreShow(makeRawEventRow({ title: "Weekly Jam Session" }))).toBe(0);
  });

  it('does not match "feat." as a one-night signal (collab billing, not one-night)', () => {
    expect(ONE_NIGHT_PATTERN.test("Artist A feat. Artist B")).toBe(false);
    expect(scoreShow(makeRawEventRow({ title: "Artist A feat. Artist B" }))).toBe(
      0,
    );
  });
});
