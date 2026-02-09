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
  it("UnifiedHeader content bar must NOT have z-index (prevents stacking context that traps dropdowns)", () => {
    const source = readComponent("UnifiedHeader.tsx");
    const lines = source.split("\n");

    // Find the content bar: the div with px-4 py-2 flex items-center gap-4
    // This is the direct child of <header> that wraps all the interactive elements
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes("px-4") &&
        line.includes("py-2") &&
        line.includes("flex items-center gap-4")
      ) {
        const hasZ = /\bz-\[?\d+\]?/.test(line);
        expect(hasZ, `Content bar (line ${i + 1}) must not have z-index — it creates a stacking context that traps dropdown z-indexes`).toBe(false);
      }
    }
  });

  it("UnifiedHeader mobile nav bar must NOT have z-index that could paint over dropdowns", () => {
    const source = readComponent("UnifiedHeader.tsx");
    const lines = source.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // The mobile nav: sm:hidden nav with border-t
      if (line.includes("sm:hidden") && line.includes("border-t") && line.includes("<nav")) {
        const zMatch = line.match(/\bz-\[?(\d+)\]?/);
        if (zMatch) {
          const zValue = parseZ(zMatch[0]);
          expect(zValue, `Mobile nav bar (line ${i + 1}) has z-${zValue} which creates a stacking context — dropdowns will render behind it`).toBe(0);
        }
      }
    }
  });

  it("no intermediate z-index values inside header (only <header> itself and dropdowns may have z-index)", () => {
    const source = readComponent("UnifiedHeader.tsx");
    const lines = source.split("\n");
    const allZ = extractZClasses(source);

    // Find which lines belong to the <header> element's opening tag (may span multiple lines)
    const headerTagLines = new Set<number>();
    let inHeaderTag = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("<header")) inHeaderTag = true;
      if (inHeaderTag) headerTagLines.add(i + 1);
      if (inHeaderTag && lines[i].includes(">")) inHeaderTag = false;
    }

    const suspiciousZ = allZ.filter((z) => {
      const val = parseZ(z.className);
      // Skip: z-0 (harmless), the <header> tag itself, and dropdown-level z (>=200)
      if (val === 0 || val >= 200) return false;
      if (headerTagLines.has(z.line)) return false;
      return true;
    });

    for (const sz of suspiciousZ) {
      expect.unreachable(
        `Line ${sz.line}: ${sz.className} inside header creates a stacking context that traps dropdown z-indexes. Remove it.`
      );
    }
  });

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
});
