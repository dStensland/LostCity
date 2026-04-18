import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
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

  // Check for active session (planning or live). Uses the service client
  // because goblin_sessions isn't in the generated database.types.ts, and
  // the typed anon client's .from() stub does not expose .in().
  const serviceClient = createServiceClient();
  const { data: activeSession } = await serviceClient
    .from("goblin_sessions")
    .select("id")
    .in("status", ["planning", "live"])
    .maybeSingle();

  return (
    <Suspense>
      <GoblinDayPage
        initialMovies={movies ?? []}
        activeSessionId={(activeSession as { id: number } | null)?.id ?? null}
      />
    </Suspense>
  );
}
