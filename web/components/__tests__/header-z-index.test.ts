/**
 * Regression test: header dropdown z-index stacking
 *
 * Dropdowns (hamburger menu, user menu, notifications) must paint ABOVE the
 * mobile nav bar.  This breaks whenever a parent element between the dropdown
 * and the <header> gets a z-index, because that creates a new stacking context
 * and scopes the dropdown's z-index inside it.
 *
 * Rule: inside <header>, NO element that is an ancestor of a dropdown should
 * set a Tailwind z-* class. Only the dropdowns themselves (and the <header>)
 * may carry z-index.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const COMPONENTS_DIR = path.resolve(__dirname, "..");

function readComponent(filename: string): string {
  return fs.readFileSync(path.join(COMPONENTS_DIR, filename), "utf-8");
}

// Extract all Tailwind z-index classes from a string
function extractZClasses(source: string): { className: string; line: number }[] {
  const results: { className: string; line: number }[] = [];
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    // Match z-N, z-[N], -z-N patterns in className strings
    const matches = lines[i].matchAll(/\bz-\[?\d+\]?/g);
    for (const m of matches) {
      results.push({ className: m[0], line: i + 1 });
    }
  }
  return results;
}

// Parse a z-index value from a Tailwind class like "z-50" or "z-[200]"
function parseZ(cls: string): number {
  const bracketMatch = cls.match(/z-\[(\d+)\]/);
  if (bracketMatch) return parseInt(bracketMatch[1], 10);
  const plainMatch = cls.match(/z-(\d+)/);
  if (plainMatch) return parseInt(plainMatch[1], 10);
  return 0;
}

describe("Header z-index stacking", () => {
  it("UserMenu dropdown must have z-index >= 200", () => {
    const source = readComponent("UserMenu.tsx");
    const allZ = extractZClasses(source);

    const dropdownZ = allZ.find((z) => parseZ(z.className) >= 100);
    expect(dropdownZ, "UserMenu dropdown must have a z-index class").toBeDefined();
    expect(parseZ(dropdownZ!.className)).toBeGreaterThanOrEqual(200);
  });

  it("NotificationDropdown must have z-index >= 200", () => {
    const source = readComponent("NotificationDropdown.tsx");
    const allZ = extractZClasses(source);

    const dropdownZ = allZ.find((z) => parseZ(z.className) >= 100);
    expect(dropdownZ, "NotificationDropdown must have a z-index class").toBeDefined();
    expect(parseZ(dropdownZ!.className)).toBeGreaterThanOrEqual(200);
  });

  it("StandardHeader action container must not use inline stacking-context styles", () => {
    const source = readComponent("headers/StandardHeader.tsx");
    const actionContainer = source.match(/<div[^>]*className="[^"]*portal-feed-actions[^"]*"[^>]*>/s);

    expect(actionContainer, "Could not find portal-feed-actions container in StandardHeader").toBeTruthy();
    expect(
      actionContainer![0],
      "portal-feed-actions must not set filter/transform/backdropFilter/perspective because it traps dropdown z-index"
    ).not.toMatch(/\bstyle=\{\{[^}]*\b(filter|transform|backdropFilter|perspective)\b/i);
  });
});
