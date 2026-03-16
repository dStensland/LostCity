import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const FAMILY_DIR = path.resolve(__dirname);

function readFamilyFile(filename: string): string {
  return fs.readFileSync(path.join(FAMILY_DIR, filename), "utf-8");
}

describe("Family feed regressions", () => {
  it("uses live calendar and crew surfaces instead of placeholders", () => {
    const source = readFamilyFile("FamilyFeed.tsx");

    expect(source).not.toContain("function CalendarPlaceholder");
    expect(source).not.toContain("function CrewPlaceholder");
    expect(source).toContain("<CalendarView");
    expect(source).toContain("<CrewPanel");
  });

  it("does not link sidebar crew setup to a missing crew route", () => {
    const source = readFamilyFile("FamilyFeed.tsx");

    expect(source).not.toContain("href={`/${portalSlug}/crew`}");
    expect(source).toContain("onOpenCrew");
  });

  it("family calendar is backed by real family data sources", () => {
    const source = readFamilyFile("CalendarView.tsx");

    expect(source).toContain("/api/school-calendar");
    expect(source).toContain("/api/programs?");
    expect(source).toContain("/api/programs/registration-radar");
  });
});
