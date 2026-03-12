import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { ContestLeaderboard } from "@/components/best-of/ContestLeaderboard";
import type { Metadata } from "next";

export const revalidate = 30;

type Props = {
  params: Promise<{ portal: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("best_of_contests")
    .select("title, prompt")
    .eq("slug", slug)
    .in("status", ["active", "completed"])
    .maybeSingle();

  const title = (data as { title?: string } | null)?.title ?? slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const prompt = (data as { prompt?: string | null } | null)?.prompt;

  return {
    title: `${title} | Best Of Contest | Lost City`,
    description: prompt ?? `Community voting contest — ${title}. Cast your vote for the best in Atlanta.`,
    openGraph: {
      title: `${title} | Best Of Contest`,
      description: prompt ?? `Vote for the best in Atlanta`,
      siteName: "Lost City",
    },
  };
}

export default async function ContestPage({ params }: Props) {
  const { portal: portalSlug, slug } = await params;
  const supabase = await createClient();

  const fakeSearchParams = new URLSearchParams({ portal: portalSlug });
  const ctx = await resolvePortalQueryContext(supabase, fakeSearchParams);

  if (!ctx.portalId) {
    notFound();
  }

  // Fetch the contest leaderboard from the public API
  // We call the API route directly to get contest + leaderboard data
  // This re-uses the same logic without duplicating it
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(
    `${baseUrl}/api/contests/${encodeURIComponent(slug)}?portal=${encodeURIComponent(portalSlug)}`,
    {
      next: { revalidate: 30 },
    }
  );

  if (res.status === 404) {
    notFound();
  }

  if (!res.ok) {
    notFound();
  }

  const data = await res.json() as {
    contest: import("@/lib/best-of-contests").BestOfContest;
    categoryName: string | null;
    venues: import("@/lib/best-of-contests").ContestLeaderboardEntry[];
    userVoteVenueId: number | null;
    totalVotes: number;
    timeRemaining: string;
  };

  // Look up the category slug (needed for voting API endpoint)
  const { data: catRow } = await supabase
    .from("best_of_categories")
    .select("slug")
    .eq("id", data.contest.categoryId)
    .maybeSingle();

  const categorySlug = (catRow as { slug?: string } | null)?.slug ?? data.contest.categoryId;

  return (
    <main className="min-h-screen bg-[var(--void)] pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <ContestLeaderboard
          contest={data.contest}
          categorySlug={categorySlug}
          leaderboard={{
            venues: data.venues,
            userVoteVenueId: data.userVoteVenueId,
            totalVotes: data.totalVotes,
            categoryName: data.categoryName ?? data.contest.title,
            timeRemaining: data.timeRemaining,
          }}
          portalSlug={portalSlug}
        />
      </div>
    </main>
  );
}
