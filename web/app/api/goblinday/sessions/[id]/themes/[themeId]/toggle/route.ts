import { NextResponse } from "next/server";
import { withAuthAndParams } from "@/lib/api-middleware";
import { isSessionMember } from "@/lib/goblin-utils";

export const dynamic = "force-dynamic";

// POST /api/goblinday/sessions/[id]/themes/[themeId]/toggle
// Member-only: toggles a theme-movie check-off
export const POST = withAuthAndParams<{ id: string; themeId: string }>(
  async (request, { user, serviceClient, params }) => {
    const sessionId = parseInt(params.id);
    const themeId = parseInt(params.themeId);

    // Verify membership
    const isMember = await isSessionMember(serviceClient, sessionId, user.id);
    if (!isMember) {
      return NextResponse.json({ error: "Not a member of this session" }, { status: 403 });
    }

    // Verify theme belongs to this session
    const { data: theme } = await serviceClient
      .from("goblin_themes")
      .select("id")
      .eq("id", themeId)
      .eq("session_id", sessionId)
      .single();

    if (!theme) {
      return NextResponse.json({ error: "Theme not found in this session" }, { status: 404 });
    }

    const body = await request.json();
    const movieId = body.movie_id;
    if (typeof movieId !== "number") {
      return NextResponse.json({ error: "movie_id required" }, { status: 400 });
    }

    // Race-safe toggle: try insert, if conflict then delete
    const { data: inserted, error: insertError } = await serviceClient
      .from("goblin_theme_movies")
      .insert({
        theme_id: themeId,
        movie_id: movieId,
        checked_by: user.id,
      } as never)
      .select("theme_id")
      .maybeSingle();

    // If unique violation (conflict), row exists — delete it
    if (insertError && insertError.code === "23505") {
      await serviceClient
        .from("goblin_theme_movies")
        .delete()
        .eq("theme_id", themeId)
        .eq("movie_id", movieId);

      // Log uncheck
      await serviceClient
        .from("goblin_timeline")
        .insert({
          session_id: sessionId,
          event_type: "theme_unchecked",
          theme_id: themeId,
          movie_id: movieId,
          user_id: user.id,
        } as never);

      return NextResponse.json({ checked: false });
    }

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Insert succeeded — log check
    if (inserted) {
      await serviceClient
        .from("goblin_timeline")
        .insert({
          session_id: sessionId,
          event_type: "theme_checked",
          theme_id: themeId,
          movie_id: movieId,
          user_id: user.id,
        } as never);
    }

    return NextResponse.json({ checked: true });
  }
);
