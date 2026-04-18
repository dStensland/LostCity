import type { RawEventRow } from "./build-show-payload";

export const SCORE = {
  CURATOR_PICK: 100,
  FLAGSHIP_OR_TENTPOLE: 80,
  MAJOR: 60,
  FESTIVAL: 50,
  ONE_NIGHT_TITLE: 30,
} as const;

/**
 * Signals a one-night / unrepeatable show by title pattern. Deliberately
 * excludes "feat." — that appears in normal collab billings (e.g. "Artist A
 * feat. Artist B") and is not a one-night signal.
 */
export const ONE_NIGHT_PATTERN =
  /\b(release party|farewell|finale|residency finale|one night)\b/i;

export function scoreShow(
  row: Pick<
    RawEventRow,
    | "is_curator_pick"
    | "importance"
    | "is_tentpole"
    | "festival_id"
    | "title"
  >,
): number {
  if (row.is_curator_pick) return SCORE.CURATOR_PICK;
  if (row.importance === "flagship" || row.is_tentpole) {
    return SCORE.FLAGSHIP_OR_TENTPOLE;
  }
  if (row.importance === "major") return SCORE.MAJOR;
  if (row.festival_id) return SCORE.FESTIVAL;
  if (ONE_NIGHT_PATTERN.test(row.title)) return SCORE.ONE_NIGHT_TITLE;
  return 0;
}
