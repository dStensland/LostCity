import { describe, expect, it } from "vitest";
import {
  createFindFilterSnapshot,
  diffFindFilterKeys,
  resolveFindDetailTarget,
} from "@/lib/analytics/find-tracking";

describe("find-tracking", () => {
  it("builds a stable snapshot for event filters", () => {
    const snapshot = createFindFilterSnapshot(
      {
        search: "jazz",
        categories: ["music", "art"],
        date: "weekend",
      },
      "events"
    );

    expect(snapshot.activeKeys).toEqual(["search", "categories", "date"]);
    expect(snapshot.activeCount).toBe(3);
    expect(snapshot.signature).toBe("search:jazz|categories:music,art|date:weekend");
  });

  it("diffs changed keys within the same find type", () => {
    const prev = createFindFilterSnapshot({ categories: "music", date: "today" }, "events");
    const next = createFindFilterSnapshot({ categories: "music,comedy", date: "weekend" }, "events");

    expect(diffFindFilterKeys(prev, next)).toEqual(["categories", "date"]);
  });

  it("resolves event, destination, and series detail targets", () => {
    expect(resolveFindDetailTarget("/forth?event=22", "forth")).toEqual({
      targetKind: "find_event_detail",
      targetId: "22",
      targetUrl: "/forth?event=22",
    });

    expect(resolveFindDetailTarget("/forth?spot=st-regis", "forth")).toEqual({
      targetKind: "find_destination_detail",
      targetId: "st-regis",
      targetUrl: "/forth?spot=st-regis",
    });

    expect(resolveFindDetailTarget("/forth/series/late-night-cinema", "forth")).toEqual({
      targetKind: "find_series_detail",
      targetId: "late-night-cinema",
      targetUrl: "/forth/series/late-night-cinema",
    });
  });

  it("ignores links outside the active portal", () => {
    expect(resolveFindDetailTarget("/other?event=99", "forth")).toBeNull();
  });
});
