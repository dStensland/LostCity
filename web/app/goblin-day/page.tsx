import { createClient } from "@/lib/supabase/server";
import GoblinDayPage from "@/components/goblin/GoblinDayPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goblin Day — Horror Movie Tracker",
  description: "Daniel & Ashley's horror movie watchlist for 2025-2026",
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();

  const { data: movies } = await supabase
    .from("goblin_movies")
    .select("*")
    .order("release_date", { ascending: true, nullsFirst: false });

  return <GoblinDayPage initialMovies={movies ?? []} />;
}
