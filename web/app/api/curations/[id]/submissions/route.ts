import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { checkBodySize, validationError, isValidUUID } from "@/lib/api-utils";
import { isValidItemStatus } from "@/lib/curation-utils";

/**
 * GET /api/curations/[id]/submissions
 * Get pending submissions for a curation (owner only)
 */
export const GET = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const listId = params.id;

    if (!isValidUUID(listId)) {
      return validationError("Invalid curation ID");
    }

    try {
      // Verify ownership
      const { data: list } = await serviceClient
        .from("lists")
        .select("creator_id")
        .eq("id", listId)
        .maybeSingle();

      if (!list) {
        return NextResponse.json({ error: "Curation not found" }, { status: 404 });
      }

      if (list.creator_id !== user.id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") || "pending";

      const { data: items, error } = await serviceClient
        .from("list_items")
        .select(`
          *,
          venue:places(id, name, slug, neighborhood, place_type),
          event:events(id, title, start_date, venue:places(name)),
          organization:organizations(id, name, slug)
        `)
        .eq("list_id", listId)
        .eq("status", status)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Submissions fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
      }

      // Fetch submitter profiles
      const submitterIds = [...new Set((items || []).map((i: { submitted_by: string | null }) => i.submitted_by).filter(Boolean))];
      let submitterMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>();

      if (submitterIds.length > 0) {
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", submitterIds);

        if (profiles) {
          submitterMap = new Map(
            profiles.map((p: { id: string; username: string; display_name: string | null; avatar_url: string | null }) => [p.id, p])
          );
        }
      }

      const itemsWithProfiles = (items || []).map((item: { submitted_by: string | null; [key: string]: unknown }) => ({
        ...item,
        submitter: item.submitted_by ? submitterMap.get(item.submitted_by) || null : null,
      }));

      return NextResponse.json({ items: itemsWithProfiles });
    } catch (error) {
      console.error("Submissions GET error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
);

/**
 * POST /api/curations/[id]/submissions
 * Submit an item to an open curation
 */
export const POST = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sizeCheck = checkBodySize(request);
    if (sizeCheck) return sizeCheck;

    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const listId = params.id;

    if (!isValidUUID(listId)) {
      return validationError("Invalid curation ID");
    }

    try {
      const body = await request.json();
      const { item_type, venue_id, event_id, organization_id, custom_name, custom_description, blurb } = body;

      if (!item_type) {
        return validationError("Item type is required");
      }

      if (!venue_id && !event_id && !organization_id && !custom_name) {
        return validationError("Item must have a venue, event, organization, or custom name");
      }

      // Verify curation exists and accepts submissions
      const { data: list } = await serviceClient
        .from("lists")
        .select("creator_id, submission_mode, allow_contributions, status")
        .eq("id", listId)
        .eq("status", "active")
        .maybeSingle();

      if (!list) {
        return NextResponse.json({ error: "Curation not found" }, { status: 404 });
      }

      const isOpen = list.submission_mode === "open" || list.allow_contributions;
      if (!isOpen) {
        return NextResponse.json({ error: "This curation does not accept submissions" }, { status: 403 });
      }

      // Get next position
      const { data: lastItem } = await serviceClient
        .from("list_items")
        .select("position")
        .eq("list_id", listId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextPosition = (lastItem?.position ?? 0) + 1;

      const { data: item, error } = await serviceClient
        .from("list_items")
        .insert({
          list_id: listId,
          item_type,
          venue_id: venue_id || null,
          event_id: event_id || null,
          organization_id: organization_id || null,
          custom_name: custom_name || null,
          custom_description: custom_description || null,
          position: nextPosition,
          added_by: user.id,
          blurb: blurb?.trim() || null,
          status: "pending",
          submitted_by: user.id,
        } as never)
        .select()
        .single();

      if (error) {
        console.error("Submission insert error:", error);
        return NextResponse.json({ error: "Failed to submit item" }, { status: 500 });
      }

      return NextResponse.json({ item, submission_status: "pending" }, { status: 201 });
    } catch (error) {
      console.error("Submissions POST error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
);

/**
 * PATCH /api/curations/[id]/submissions
 * Approve or reject a submission (owner only)
 */
export const PATCH = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const sizeCheck = checkBodySize(request);
    if (sizeCheck) return sizeCheck;

    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
    if (rateLimitResult) return rateLimitResult;

    const listId = params.id;

    if (!isValidUUID(listId)) {
      return validationError("Invalid curation ID");
    }

    try {
      const body = await request.json();
      const { item_id, action } = body;

      if (!isValidUUID(item_id)) {
        return validationError("Invalid item_id");
      }

      if (!action || !["approve", "reject"].includes(action)) {
        return validationError("Action must be 'approve' or 'reject'");
      }

      // Verify ownership
      const { data: list } = await serviceClient
        .from("lists")
        .select("creator_id")
        .eq("id", listId)
        .maybeSingle();

      if (!list || list.creator_id !== user.id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      const newStatus = action === "approve" ? "approved" : "rejected";

      const { data: item, error } = await serviceClient
        .from("list_items")
        .update({ status: newStatus })
        .eq("id", item_id)
        .eq("list_id", listId)
        .select()
        .maybeSingle();

      if (error) {
        console.error("Submission update error:", error);
        return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
      }

      if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }

      return NextResponse.json({ item, status: newStatus });
    } catch (error) {
      console.error("Submissions PATCH error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
);
