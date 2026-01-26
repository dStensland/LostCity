import { isAdmin, canManagePortal } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

type SourceHealthRow = {
  id: number;
  name: string;
  slug: string;
  health_tags: string[] | null;
  active_months: number[] | null;
  owner_portal_id: string | null;
};

// Valid health tags
const VALID_HEALTH_TAGS = [
  "no-events",
  "instagram-only",
  "facebook-events",
  "seasonal",
  "timeout",
  "dns-error",
  "ssl-error",
  "parse-error",
];

// GET /api/admin/sources/[id]/health-tags - Get health tags for a source
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

  const { data: sourceData, error } = await supabase
    .from("sources")
    .select("id, name, slug, health_tags, active_months")
    .eq("id", sourceId)
    .single();

  if (error || !sourceData) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const source = sourceData as unknown as SourceHealthRow;

  return NextResponse.json({
    source_id: source.id,
    name: source.name,
    health_tags: source.health_tags || [],
    active_months: source.active_months,
    valid_tags: VALID_HEALTH_TAGS,
  });
}

// PATCH /api/admin/sources/[id]/health-tags - Update health tags for a source
export async function PATCH(request: NextRequest, { params }: Props) {
  const { id } = await params;
  const sourceId = parseInt(id, 10);

  if (isNaN(sourceId)) {
    return NextResponse.json({ error: "Invalid source ID" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get source info including owner
  const { data: sourceData, error: sourceError } = await supabase
    .from("sources")
    .select("id, name, owner_portal_id")
    .eq("id", sourceId)
    .single();

  if (sourceError || !sourceData) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const source = sourceData as unknown as SourceHealthRow;

  // Check authorization:
  // - Super admins can update any source
  // - Portal admins can update sources they own
  const isSuperAdmin = await isAdmin();
  const canManageOwner = source.owner_portal_id
    ? await canManagePortal(source.owner_portal_id)
    : false;

  if (!isSuperAdmin && !canManageOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { health_tags, active_months } = body;

  // Build update object
  const updates: Record<string, unknown> = {};

  // Validate and set health_tags
  if (health_tags !== undefined) {
    if (!Array.isArray(health_tags)) {
      return NextResponse.json(
        { error: "health_tags must be an array" },
        { status: 400 }
      );
    }

    // Validate each tag
    const invalidTags = health_tags.filter((tag: string) => !VALID_HEALTH_TAGS.includes(tag));
    if (invalidTags.length > 0) {
      return NextResponse.json(
        {
          error: `Invalid health tags: ${invalidTags.join(", ")}`,
          valid_tags: VALID_HEALTH_TAGS,
        },
        { status: 400 }
      );
    }

    updates.health_tags = health_tags;
  }

  // Validate and set active_months
  if (active_months !== undefined) {
    if (active_months === null) {
      updates.active_months = null;
    } else if (!Array.isArray(active_months)) {
      return NextResponse.json(
        { error: "active_months must be an array or null" },
        { status: 400 }
      );
    } else {
      // Validate each month is 1-12
      const invalidMonths = active_months.filter(
        (m: number) => typeof m !== "number" || m < 1 || m > 12
      );
      if (invalidMonths.length > 0) {
        return NextResponse.json(
          { error: "active_months must contain numbers 1-12" },
          { status: 400 }
        );
      }
      updates.active_months = active_months;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  // Update the source
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from("sources")
    .update(updates)
    .eq("id", sourceId);

  if (updateError) {
    console.error("Error updating source health tags:", updateError);
    return NextResponse.json(
      { error: "Failed to update health tags" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Updated health tags for ${source.name}`,
    health_tags: updates.health_tags,
    active_months: updates.active_months,
  });
}
