import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const PATCH = withAuthAndParams<{ id: string }>(
  async (request, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await serviceClient
      .from("goblin_lists")
      .select("id")
      .eq("id", listId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

    if (Object.keys(updates).length > 0) {
      await serviceClient
        .from("goblin_lists")
        .update(updates as never)
        .eq("id", listId);
    }

    return NextResponse.json({ success: true });
  }
);

export const DELETE = withAuthAndParams<{ id: string }>(
  async (_request, { user, serviceClient, params }) => {
    const listId = parseInt(params.id);
    if (isNaN(listId)) {
      return NextResponse.json({ error: "Invalid list ID" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("goblin_lists")
      .delete()
      .eq("id", listId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete list" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
