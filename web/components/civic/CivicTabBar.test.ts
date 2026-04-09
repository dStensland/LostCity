import { describe, expect, it } from "vitest";
import { getCivicTabs, isCivicTabActive } from "@/components/civic/CivicTabBar";

describe("CivicTabBar", () => {
  it("includes the support tab for HelpATL only", () => {
    expect(getCivicTabs("helpatl").map((tab) => tab.key)).toContain("support");
    expect(getCivicTabs("atlanta").map((tab) => tab.key)).not.toContain("support");
  });

  it("marks the support route as active", () => {
    const params = new URLSearchParams();

    expect(isCivicTabActive("support", "/helpatl/support", params, "helpatl")).toBe(true);
    expect(isCivicTabActive("support", "/helpatl", params, "helpatl")).toBe(false);
  });

  it("keeps calendar activation scoped to the explore route", () => {
    const params = new URLSearchParams({ tab: "calendar" });

    expect(isCivicTabActive("calendar", "/helpatl/explore", params, "helpatl")).toBe(true);
    expect(isCivicTabActive("calendar", "/helpatl/support", params, "helpatl")).toBe(false);
  });
});
