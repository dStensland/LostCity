import { isAdmin, canManagePortal } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type SourceRow = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  owner_portal_id: string | null;
};

type CrawlLogRow = {
  id: number;
  started_at: string;
  status: string | null;
};

// POST /api/admin/sources/[id]/crawl - Trigger a manual crawl for a source
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const sourceId = parseInt(id, 10);

  if (isNaN(sourceId)) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get source info including owner
  const { data: sourceData, error: sourceError } = await supabase
    .from("sources")
    .select("id, name, slug, is_active, owner_portal_id")
    .eq("id", sourceId)
    .single();

  if (sourceError || !sourceData) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const source = sourceData as unknown as SourceRow;

  // Check authorization:
  // - Super admins can trigger any crawl
  // - Portal admins can trigger crawls for sources they own
  const isSuperAdmin = await isAdmin();
  const canManageOwner = source.owner_portal_id
    ? await canManagePortal(source.owner_portal_id)
    : false;

  if (!isSuperAdmin && !canManageOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Check if source is active
  if (!source.is_active) {
    return NextResponse.json(
      { error: "Cannot trigger crawl for inactive source" },
      { status: 400 }
    );
  }

  // Check for recent crawl (within last 5 minutes) to prevent spam
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentCrawlData } = await supabase
    .from("crawl_logs")
    .select("id, started_at, status")
    .eq("source_id", sourceId)
    .gte("started_at", fiveMinutesAgo)
    .order("started_at", { ascending: false })
    .limit(1);

  const recentCrawl = recentCrawlData as unknown as CrawlLogRow[] | null;

  if (recentCrawl && recentCrawl.length > 0) {
    const recent = recentCrawl[0];
    if (recent.status === "running" || recent.status === "queued") {
      return NextResponse.json(
        {
          error: "A crawl is already in progress for this source",
          crawl_id: recent.id,
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: "A crawl was recently triggered. Please wait before triggering another.",
        last_crawl: recent.started_at,
      },
      { status: 429 }
    );
  }

  // Create a new crawl log entry with status "queued"
  // This will be picked up by the crawler worker
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: crawlLogData, error: insertError } = await (supabase as any)
    .from("crawl_logs")
    .insert({
      source_id: sourceId,
      started_at: new Date().toISOString(),
      status: "queued",
    })
    .select("id")
    .single();

  if (insertError || !crawlLogData) {
    console.error("Error creating crawl log:", insertError);
    return NextResponse.json(
      { error: "Failed to queue crawl" },
      { status: 500 }
    );
  }

  const crawlLog = crawlLogData as unknown as { id: number };

  return NextResponse.json({
    success: true,
    message: `Crawl queued for ${source.name}`,
    crawl_id: crawlLog.id,
  });
}

// GET /api/admin/sources/[id]/crawl - Get recent crawl logs for a source
export async function GET(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const sourceId = parseInt(id, 10);

  if (isNaN(sourceId)) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  // Verify admin
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const supabase = createServiceClient();

  // Get recent crawl logs
  const { data: logs, error } = await supabase
    .from("crawl_logs")
    .select("id, started_at, completed_at, status, events_found, events_new, events_updated, error_message")
    .eq("source_id", sourceId)
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching crawl logs:", error);
    return NextResponse.json({ error: "Failed to fetch crawl logs" }, { status: 500 });
  }

  return NextResponse.json({ logs: logs || [] });
}
