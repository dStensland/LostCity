import { describe, it, expect } from "vitest";
import { groupItemsByMonth, type BigStuffItem } from "./load-big-stuff";

const mkItem = (partial: Partial<BigStuffItem>): BigStuffItem => ({
  id: partial.id ?? "x",
  kind: partial.kind ?? "festival",
  title: partial.title ?? "Item",
  startDate: partial.startDate ?? "2026-05-01",
  endDate: partial.endDate ?? null,
  location: partial.location ?? null,
  href: partial.href ?? "/",
});

describe("groupItemsByMonth", () => {
  it("groups items by calendar month within the 6-month horizon", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "1", title: "Shaky Knees", startDate: "2026-05-02", endDate: "2026-05-04" }),
      mkItem({ id: "2", title: "Music Midtown", startDate: "2026-09-13", endDate: "2026-09-14" }),
      mkItem({ id: "3", kind: "tentpole", title: "Peachtree Rd Race", startDate: "2026-07-04", location: "Buckhead" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);

    expect(grouped).toHaveLength(6);
    expect(grouped.map((g) => g.monthKey)).toEqual([
      "2026-04","2026-05","2026-06","2026-07","2026-08","2026-09",
    ]);
    expect(grouped[1].items).toHaveLength(1);
    expect(grouped[1].items[0].title).toBe("Shaky Knees");
    expect(grouped[3].items[0].title).toBe("Peachtree Rd Race");
  });

  it("caps items per month at 3 and counts overflow", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "1", title: "A", startDate: "2026-05-01" }),
      mkItem({ id: "2", title: "B", startDate: "2026-05-05" }),
      mkItem({ id: "3", title: "C", startDate: "2026-05-10" }),
      mkItem({ id: "4", title: "D", startDate: "2026-05-15" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);
    const may = grouped.find((g) => g.monthKey === "2026-05");

    expect(may?.items).toHaveLength(3);
    expect(may?.overflowCount).toBe(1);
  });

  it("excludes items with startDate <= today (forward-only filter)", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "past", startDate: "2026-04-10" }),
      mkItem({ id: "today", startDate: "2026-04-18" }),
      mkItem({ id: "future", startDate: "2026-04-25" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);
    const apr = grouped.find((g) => g.monthKey === "2026-04");

    expect(apr?.items).toHaveLength(1);
    expect(apr?.items[0].id).toBe("future");
  });

  it("returns empty-items buckets for months with no data", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "may", startDate: "2026-05-02" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);

    expect(grouped).toHaveLength(6);
    expect(grouped.filter((g) => g.items.length === 0)).toHaveLength(5);
  });

  it("marks the current month with isCurrentMonth=true", () => {
    const grouped = groupItemsByMonth([], "2026-04-18", 6);
    expect(grouped[0].isCurrentMonth).toBe(true);
    expect(grouped.slice(1).every((g) => !g.isCurrentMonth)).toBe(true);
  });

  it("handles year rollover (Nov 2026 → Apr 2027)", () => {
    const today = "2026-11-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "dec", title: "New Year's Eve ATL", startDate: "2026-12-31" }),
      mkItem({ id: "jan", title: "MLK Day Parade", startDate: "2027-01-19" }),
    ];

    const grouped = groupItemsByMonth(items, today, 6);

    expect(grouped.map((g) => g.monthKey)).toEqual([
      "2026-11","2026-12","2027-01","2027-02","2027-03","2027-04",
    ]);
    expect(grouped[1].items[0].title).toBe("New Year's Eve ATL");
    expect(grouped[2].items[0].title).toBe("MLK Day Parade");
  });

  it("silently drops items beyond the horizon ceiling", () => {
    const today = "2026-04-18";
    const items: BigStuffItem[] = [
      mkItem({ id: "in", startDate: "2026-09-30" }),  // month 6, inside
      mkItem({ id: "out", startDate: "2026-10-01" }), // month 7, dropped
    ];

    const grouped = groupItemsByMonth(items, today, 6);
    const allItems = grouped.flatMap((g) => g.items);

    expect(allItems).toHaveLength(1);
    expect(allItems[0].id).toBe("in");
  });
});
