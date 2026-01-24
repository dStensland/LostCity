import { isAdmin } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getFederationStats, getSourcesWithOwnership } from "@/lib/federation";

export const dynamic = "force-dynamic";

// GET /api/admin/federation/stats - Get federation statistics
export async function GET() {
  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const stats = await getFederationStats();
  const sources = await getSourcesWithOwnership();

  // Group sources by owner portal
  const sourcesByPortal = new Map<string | null, typeof sources>();
  for (const source of sources) {
    const key = source.ownerPortalId;
    if (!sourcesByPortal.has(key)) {
      sourcesByPortal.set(key, []);
    }
    sourcesByPortal.get(key)!.push(source);
  }

  // Convert to array for JSON response
  const portalSummaries: {
    portalId: string | null;
    portalName: string | null;
    portalSlug: string | null;
    sourceCount: number;
    sharedSourceCount: number;
  }[] = [];

  for (const [portalId, portalSources] of sourcesByPortal) {
    const firstSource = portalSources[0];
    portalSummaries.push({
      portalId,
      portalName: firstSource?.ownerPortal?.name || (portalId === null ? "Global" : "Unknown"),
      portalSlug: firstSource?.ownerPortal?.slug || null,
      sourceCount: portalSources.length,
      sharedSourceCount: portalSources.filter(
        (s) => s.sharingRule && s.sharingRule.shareScope !== "none"
      ).length,
    });
  }

  // Sort by source count descending
  portalSummaries.sort((a, b) => b.sourceCount - a.sourceCount);

  return NextResponse.json({
    stats,
    portalSummaries,
    sources: sources.slice(0, 50), // Limit to first 50 for dashboard
  });
}
