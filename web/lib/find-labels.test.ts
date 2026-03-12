import { describe, expect, it } from "vitest";
import {
  getFindSearchSubtitle,
  getFindTypeLabel,
} from "@/lib/find-labels";

describe("find-labels", () => {
  it("uses places for destinations in user-facing copy", () => {
    expect(getFindTypeLabel("destinations")).toBe("Places");
    expect(getFindSearchSubtitle("venue")).toBe("Search places");
  });

  it("keeps event copy unchanged", () => {
    expect(getFindTypeLabel("events")).toBe("Events");
    expect(getFindSearchSubtitle("event")).toBe("Search events");
  });
});
