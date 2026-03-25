import { createClient } from "@/lib/supabase/server";
import GoblinDayPage from "@/components/goblin/GoblinDayPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goblin Day — Horror Movie Tracker",
  description: "Click the link you fool",
  openGraph: {
    title: "GOBLIN DAY",
    description: "Click the link you fool",
    type: "website",
    images: [{ url: "/goblin-day/og-image.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "GOBLIN DAY",
    description: "Click the link you fool",
    images: ["/goblin-day/og-image.jpg"],
  },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  const supabase = await createClient();

  const { data: movies } = await supabase
    .from("goblin_movies")
    .select("*")
    .order("release_date", { ascending: true, nullsFirst: false });

  // Check for active session
  const { data: activeSession } = await supabase
    .from("goblin_sessions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  return (
    <GoblinDayPage
      initialMovies={movies ?? []}
      activeSessionId={(activeSession as { id: number } | null)?.id ?? null}
    />
  );
}
