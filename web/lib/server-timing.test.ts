import { describe, expect, it, vi } from "vitest";
import { createServerTimingRecorder } from "@/lib/server-timing";

describe("server-timing", () => {
  it("formats measured metrics and a total header", async () => {
    const now = vi
      .spyOn(globalThis.performance, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(20)
      .mockReturnValueOnce(35);

    try {
      const recorder = createServerTimingRecorder();
      await recorder.measure("bootstrap", async () => {});

      expect(recorder.toHeader()).toBe(
        'bootstrap;dur=15.0, total;dur=35.0',
      );
    } finally {
      now.mockRestore();
    }
  });

  it("supports explicit metrics and quoted descriptions", () => {
    const now = vi
      .spyOn(globalThis.performance, "now")
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(12);

    try {
      const recorder = createServerTimingRecorder();
      recorder.addMetric("cache-hit", 0, 'shared "hit"');

      expect(recorder.toHeader()).toBe(
        'cache-hit;dur=0.0;desc="shared \'hit\'", total;dur=12.0',
      );
    } finally {
      now.mockRestore();
    }
  });
});
