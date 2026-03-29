import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const PATCH = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const entryId = parseInt(params.id);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await serviceClient
      .from("goblin_log_entries")
      .select("id")
      .eq("id", entryId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.watched_date !== undefined) updates.watched_date = body.watched_date;
    if (body.note !== undefined) updates.note = body.note?.trim() || null;
    if (body.watched_with !== undefined) updates.watched_with = body.watched_with?.trim() || null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
    if (body.tier_name !== undefined) updates.tier_name = body.tier_name?.trim() || null;
    if (body.tier_color !== undefined) updates.tier_color = body.tier_color?.trim() || null;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await serviceClient
        .from("goblin_log_entries")
        .update(updates as never)
        .eq("id", entryId)
        .eq("user_id", user.id);
    }

    // Update tags if provided (replace all)
    if (body.tag_ids !== undefined) {
      await serviceClient
        .from("goblin_log_entry_tags")
        .delete()
        .eq("entry_id", entryId);

      if (body.tag_ids.length > 0) {
        const tagRows = body.tag_ids.map((tagId: number) => ({
          entry_id: entryId,
          tag_id: tagId,
        }));
        await serviceClient
          .from("goblin_log_entry_tags")
          .insert(tagRows as never);
      }
    }

    return NextResponse.json({ success: true });
  }
);

export const DELETE = withAuthAndParams<{ id: string }>(
  async (_request: NextRequest, { user, serviceClient, params }) => {
    const entryId = parseInt(params.id);
    if (isNaN(entryId)) {
      return NextResponse.json({ error: "Invalid entry ID" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("goblin_log_entries")
      .delete()
      .eq("id", entryId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
