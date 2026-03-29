import { NextRequest, NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const PATCH = withAuthAndParams<{ id: string }>(
  async (request: NextRequest, { user, serviceClient, params }) => {
    const tagId = parseInt(params.id);
    if (isNaN(tagId)) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim().toLowerCase();
    if (body.color !== undefined) updates.color = body.color.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await serviceClient
      .from("goblin_tags")
      .update(updates as never)
      .eq("id", tagId)
      .eq("user_id", user.id)
      .select("id, name, color")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Tag not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({ tag: data });
  }
);

export const DELETE = withAuthAndParams<{ id: string }>(
  async (_request: NextRequest, { user, serviceClient, params }) => {
    const tagId = parseInt(params.id);
    if (isNaN(tagId)) {
      return NextResponse.json({ error: "Invalid tag ID" }, { status: 400 });
    }

    const { error } = await serviceClient
      .from("goblin_tags")
      .delete()
      .eq("id", tagId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  }
);
