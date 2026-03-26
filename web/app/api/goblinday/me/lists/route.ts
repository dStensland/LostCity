import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (_request, { user, serviceClient }) => {
  const { data, error } = await serviceClient
    .from("goblin_lists")
    .select("id, name, created_at, goblin_list_movies(movie_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch lists" }, { status: 500 });
  }

  return NextResponse.json(
    (data || []).map((l: { id: number; name: string; created_at: string; goblin_list_movies: { movie_id: number }[] }) => ({
      id: l.id,
      name: l.name,
      created_at: l.created_at,
      movie_ids: l.goblin_list_movies.map((lm) => lm.movie_id),
    }))
  );
});

export const POST = withAuth(async (request, { user, serviceClient }) => {
  const { name, movie_ids } = await request.json();

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const { data: list, error: listError } = await serviceClient
    .from("goblin_lists")
    .insert({ user_id: user.id, name } as never)
    .select("id, name, created_at")
    .single();

  if (listError || !list) {
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }

  if (Array.isArray(movie_ids) && movie_ids.length > 0) {
    const rows = movie_ids.map((mid: number) => ({
      list_id: (list as { id: number }).id,
      movie_id: mid,
    }));
    await serviceClient.from("goblin_list_movies").insert(rows as never);
  }

  return NextResponse.json({
    id: (list as { id: number }).id,
    name: (list as { name: string }).name,
    created_at: (list as { created_at: string }).created_at,
    movie_ids: movie_ids || [],
  }, { status: 201 });
});
