import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import BigStuffSection from "./BigStuffSection";
import type { BigStuffItem } from "@/lib/city-pulse/loaders/big-stuff-shared";

/**
 * Tests for BigStuffSection component-level rendering rules.
 *
 * Pure groupItemsByMonth logic is covered in load-big-stuff.test.ts.
 * These tests cover what the component does with that data:
 * - null guard (no items → renders nothing)
 * - overflow link rendered when overflowCount > 0
 * - hover cascade classes wired correctly on item rows
 *
 * Items must land within the 6-month horizon that groupItemsByMonth builds
 * relative to today. We compute a near-future date at test runtime (2 months
 * out) rather than hardcoding a fixed year, so the test stays valid as real
 * time passes without needing to mock getLocalDateString.
 */

/** Returns a YYYY-MM-DD string offset by `monthsAhead` months from today. */
function futureDate(monthsAhead: number, day = 15): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function makeItem(partial: Partial<BigStuffItem> = {}): BigStuffItem {
  return {
    id: partial.id ?? "x",
    kind: partial.kind ?? "festival",
    title: partial.title ?? "Test Event",
    startDate: partial.startDate ?? futureDate(2),
    endDate: partial.endDate ?? null,
    location: partial.location ?? null,
    href: partial.href ?? "/atlanta/festivals/test-event",
  };
}

describe("BigStuffSection", () => {
  it("renders null when no items", () => {
    const { container } = render(
      <BigStuffSection
        portalSlug="atlanta"
        portalId="test-portal-id"
        initialData={{ items: [] }}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders a +N more link when a month exceeds 3 items", () => {
    // 4 items all in the same future month → 3 visible + 1 overflow
    const baseDate = futureDate(2);
    const month = baseDate.slice(0, 7); // YYYY-MM
    const items: BigStuffItem[] = Array.from({ length: 4 }, (_, i) =>
      makeItem({
        id: `i${i}`,
        startDate: `${month}-${String(i + 10).padStart(2, "0")}`,
        title: `Event ${i + 1}`,
      }),
    );
    const { getByText } = render(
      <BigStuffSection
        portalSlug="atlanta"
        portalId="test-portal-id"
        initialData={{ items }}
      />,
    );
    expect(getByText(/\+1 more/i)).toBeDefined();
  });

  it("hover cascade classes are wired on item rows", () => {
    const items: BigStuffItem[] = [
      makeItem({ id: "a", title: "A Festival", startDate: futureDate(2) }),
    ];
    const { container } = render(
      <BigStuffSection
        portalSlug="atlanta"
        portalId="test-portal-id"
        initialData={{ items }}
      />,
    );

    // The ribbon wrapper must carry the group/ribbon context class.
    const ribbon = container.querySelector("[data-bigstuff-ribbon]");
    expect(ribbon).not.toBeNull();
    expect(ribbon!.className).toContain("group/ribbon");

    // Each item link must carry both sides of the hover cascade.
    // Forward-slashes in Tailwind class names need escaping in CSS selectors.
    const itemLinks = container.querySelectorAll("a[href]");
    // Find the item row link (not the see-all or +N more links)
    const itemLink = Array.from(itemLinks).find((el) =>
      el.className.includes("group/item"),
    );
    expect(itemLink).not.toBeUndefined();
    expect(itemLink!.className).toContain("group-hover/ribbon:opacity-75");
    expect(itemLink!.className).toContain("hover:!opacity-100");
  });
});
