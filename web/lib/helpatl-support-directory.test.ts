import {
  getHelpAtlSupportDirectorySections,
  getHelpAtlSupportDirectoryStats,
} from "@/lib/helpatl-support-directory";
import { isHelpAtlSupportDirectoryEnabled } from "@/lib/helpatl-support";

describe("helpatl support directory", () => {
  it("only enables the support directory for HelpATL", () => {
    expect(isHelpAtlSupportDirectoryEnabled("helpatl")).toBe(true);
    expect(isHelpAtlSupportDirectoryEnabled("atlanta")).toBe(false);
  });

  it("builds sections with deduplicated organizations", () => {
    const sections = getHelpAtlSupportDirectorySections();

    expect(sections.length).toBeGreaterThan(0);

    for (const section of sections) {
      expect(section.organizationCount).toBe(section.organizations.length);
      expect(new Set(section.organizations.map((organization) => organization.id)).size).toBe(
        section.organizations.length
      );
    }
  });

  it("reports directory-level stats", () => {
    const stats = getHelpAtlSupportDirectoryStats();

    expect(stats.totalOrganizations).toBeGreaterThan(0);
    expect(stats.totalTracks).toBeGreaterThan(0);
    expect(stats.totalSections).toBeGreaterThan(0);
  });

  it("keeps Work, Money & Daily Life above the minimum breadth target", () => {
    const sections = getHelpAtlSupportDirectorySections();
    const workSection = sections.find((section) => section.key === "work-daily-life");

    expect(workSection).toBeDefined();
    expect(workSection?.organizationCount).toBeGreaterThanOrEqual(20);
  });
});
