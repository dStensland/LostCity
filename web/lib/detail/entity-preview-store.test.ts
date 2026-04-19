import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  publishEntityPreview,
  peekEntityPreview,
  buildEntityRef,
  __clearStoreForTests,
  __storeSizeForTests,
  type EventSeed,
  type SpotSeed,
} from "./entity-preview-store";

const eventSeed = (id: number, title = "Show"): EventSeed => ({
  kind: "event",
  id,
  title,
});

const spotSeed = (slug: string, name = "Place"): SpotSeed => ({
  kind: "spot",
  slug,
  name,
});

describe("entity-preview-store", () => {
  beforeEach(() => {
    __clearStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    __clearStoreForTests();
  });

  describe("publish + peek", () => {
    it("round-trips a seeded payload", () => {
      const ref = buildEntityRef("event", 123);
      publishEntityPreview(ref, eventSeed(123, "Shaky Knees"));

      const got = peekEntityPreview(ref);
      expect(got).toEqual({ kind: "event", id: 123, title: "Shaky Knees" });
    });

    it("returns null for an unknown ref", () => {
      expect(peekEntityPreview(buildEntityRef("event", 999))).toBeNull();
    });

    it("keeps different kinds isolated", () => {
      publishEntityPreview(buildEntityRef("event", 1), eventSeed(1));
      publishEntityPreview(buildEntityRef("spot", "1"), spotSeed("1"));

      expect(peekEntityPreview(buildEntityRef("event", 1))?.kind).toBe("event");
      expect(peekEntityPreview(buildEntityRef("spot", "1"))?.kind).toBe("spot");
    });

    it("overwrites on re-publish", () => {
      const ref = buildEntityRef("event", 1);
      publishEntityPreview(ref, eventSeed(1, "First"));
      publishEntityPreview(ref, eventSeed(1, "Second"));

      const got = peekEntityPreview(ref);
      expect((got as EventSeed).title).toBe("Second");
      expect(__storeSizeForTests()).toBe(1);
    });
  });

  describe("TTL", () => {
    it("expires entries after 60s", () => {
      vi.useFakeTimers({ now: 1_000_000 });
      const ref = buildEntityRef("event", 1);
      publishEntityPreview(ref, eventSeed(1));

      vi.advanceTimersByTime(59_000);
      expect(peekEntityPreview(ref)).not.toBeNull();

      vi.advanceTimersByTime(2_000); // now 61s elapsed
      expect(peekEntityPreview(ref)).toBeNull();
    });

    it("re-publish within TTL refreshes the window", () => {
      vi.useFakeTimers({ now: 1_000_000 });
      const ref = buildEntityRef("event", 1);
      publishEntityPreview(ref, eventSeed(1));

      vi.advanceTimersByTime(50_000);
      publishEntityPreview(ref, eventSeed(1, "Refreshed"));

      vi.advanceTimersByTime(50_000); // 100s from original, 50s from republish
      const got = peekEntityPreview(ref);
      expect(got).not.toBeNull();
      expect((got as EventSeed).title).toBe("Refreshed");
    });

    it("expired peek evicts the entry", () => {
      vi.useFakeTimers({ now: 1_000_000 });
      const ref = buildEntityRef("event", 1);
      publishEntityPreview(ref, eventSeed(1));
      vi.advanceTimersByTime(61_000);

      peekEntityPreview(ref);
      expect(__storeSizeForTests()).toBe(0);
    });
  });

  describe("LRU eviction", () => {
    it("caps store size at MAX_ENTRIES (200)", () => {
      for (let i = 0; i < 205; i++) {
        publishEntityPreview(buildEntityRef("event", i), eventSeed(i));
      }
      expect(__storeSizeForTests()).toBe(200);
    });

    it("evicts oldest-by-insertion when full", () => {
      for (let i = 0; i < 200; i++) {
        publishEntityPreview(buildEntityRef("event", i), eventSeed(i));
      }
      // Adding one more evicts entry 0.
      publishEntityPreview(buildEntityRef("event", 200), eventSeed(200));

      expect(peekEntityPreview(buildEntityRef("event", 0))).toBeNull();
      expect(peekEntityPreview(buildEntityRef("event", 1))).not.toBeNull();
      expect(peekEntityPreview(buildEntityRef("event", 200))).not.toBeNull();
    });

    it("republishing an existing ref does not trigger eviction", () => {
      for (let i = 0; i < 200; i++) {
        publishEntityPreview(buildEntityRef("event", i), eventSeed(i));
      }
      // Refresh entry 0 — should NOT evict anyone; size stays at 200.
      publishEntityPreview(buildEntityRef("event", 0), eventSeed(0, "refreshed"));

      expect(__storeSizeForTests()).toBe(200);
      expect(peekEntityPreview(buildEntityRef("event", 0))).not.toBeNull();
      // But entry 0 is now the most-recent, so next eviction targets entry 1.
      publishEntityPreview(buildEntityRef("event", 201), eventSeed(201));
      expect(peekEntityPreview(buildEntityRef("event", 1))).toBeNull();
      expect(peekEntityPreview(buildEntityRef("event", 0))).not.toBeNull();
    });
  });

  describe("buildEntityRef", () => {
    it("formats ref as kind:key", () => {
      expect(buildEntityRef("event", 123)).toBe("event:123");
      expect(buildEntityRef("spot", "high-museum")).toBe("spot:high-museum");
      expect(buildEntityRef("neighborhood", "old-fourth-ward")).toBe(
        "neighborhood:old-fourth-ward",
      );
    });
  });
});
