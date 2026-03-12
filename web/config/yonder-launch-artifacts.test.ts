import { describe, expect, it } from "vitest";
import {
  getYonderLaunchArtifactsForQuest,
  YONDER_LAUNCH_ARTIFACTS,
  YONDER_LAUNCH_ARTIFACT_QUESTS,
} from "./yonder-launch-artifacts";

describe("yonder-launch-artifacts", () => {
  it("keeps launch quest ids aligned with actual launch artifacts", () => {
    const questIds = new Set(YONDER_LAUNCH_ARTIFACT_QUESTS.map((quest) => quest.id));
    for (const artifact of YONDER_LAUNCH_ARTIFACTS) {
      expect(artifact.questIds.length).toBeGreaterThan(0);
      for (const questId of artifact.questIds) {
        expect(questIds.has(questId)).toBe(true);
      }
    }
  });

  it("excludes Tiny Doors from the Yonder launch artifact set", () => {
    const titles = YONDER_LAUNCH_ARTIFACTS.map((artifact) => artifact.title.toLowerCase());
    expect(titles.some((title) => title.includes("tiny doors"))).toBe(false);
  });

  it("returns quest artifacts in launch priority order", () => {
    const starter = getYonderLaunchArtifactsForQuest("starter");
    expect(starter.length).toBeGreaterThan(0);
    expect(starter[0]?.launchPriority).toBeGreaterThanOrEqual(
      starter[starter.length - 1]?.launchPriority ?? 0,
    );
  });

  it("uses only valid relationship modeling states", () => {
    for (const artifact of YONDER_LAUNCH_ARTIFACTS) {
      expect([
        "standalone_spot",
        "parent_destination",
        "child_landmark",
      ]).toContain(artifact.relationshipKind);
      if (artifact.relationshipKind === "child_landmark") {
        expect(artifact.parentSpotSlug).toBeTruthy();
      }
    }
  });
});
