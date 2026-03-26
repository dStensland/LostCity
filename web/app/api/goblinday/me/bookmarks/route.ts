import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request, { user, serviceClient }) => {
  const body = await request.json();
  const { movie_id, field, value } = body;

  if (!movie_id || !field || typeof value !== "boolean") {
    return NextResponse.json({ error: "movie_id, field, and value required" }, { status: 400 });
  }

  if (field !== "bookmarked" && field !== "watched") {
    return NextResponse.json({ error: "field must be bookmarked or watched" }, { status: 400 });
  }

  const { error } = await serviceClient
    .from("goblin_user_movies")
    .upsert(
      { user_id: user.id, movie_id, [field]: value } as never,
      { onConflict: "user_id,movie_id" }
    );

  if (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
