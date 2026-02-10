import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function VenueAnalyticsPage({ params }: Props) {
  const { slug } = await params;

  // Check authentication
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/auth/login?redirect=/venue/${slug}/dashboard/analytics`);
  }

  // Get venue and verify ownership
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id, name, slug, claimed_by")
    .eq("slug", slug)
    .maybeSingle() as {
      data: {
        id: number;
        name: string;
        slug: string;
        claimed_by: string | null;
      } | null;
      error: unknown;
    };

  if (venueError) {
    console.error("Error fetching venue:", venueError);
    notFound();
  }

  if (!venue) {
    notFound();
  }

  // Check if user owns this venue
  if (venue.claimed_by !== user.id) {
    return (
      <div className="min-h-screen bg-[var(--void)] text-[var(--cream)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-[var(--muted)] mb-6">
            You do not have permission to view analytics for this venue.
          </p>
          <Link
            href={`/atlanta/spots/${slug}`}
            className="text-[var(--coral)] hover:underline"
          >
            View venue page
          </Link>
        </div>
      </div>
    );
  }

  // Get event counts
  const { count: upcomingEvents } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", venue.id)
    .gte("start_date", new Date().toISOString().split("T")[0]);

  const { count: totalEvents } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", venue.id);

  const { count: venueSubmittedEvents } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", venue.id)
    .eq("source_type", "venue_submission");

  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--cream)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--void-light)]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-1">Analytics</h1>
              <p className="text-[var(--muted)] text-sm">{venue.name}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-1">
            <Link
              href={`/venue/${slug}/dashboard`}
              className="px-4 py-2 rounded text-[var(--cream)] hover:bg-[var(--void)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              Overview
            </Link>
            <Link
              href={`/venue/${slug}/dashboard/edit`}
              className="px-4 py-2 rounded text-[var(--cream)] hover:bg-[var(--void)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              Edit Details
            </Link>
            <Link
              href={`/venue/${slug}/dashboard/submit-event`}
              className="px-4 py-2 rounded text-[var(--cream)] hover:bg-[var(--void)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              Submit Event
            </Link>
            <Link
              href={`/venue/${slug}/dashboard/analytics`}
              className="px-4 py-2 rounded bg-[var(--coral)] text-[var(--void)] font-medium"
            >
              Analytics
            </Link>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Upcoming Events */}
          <div className="bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-6">
            <div className="text-[var(--muted)] text-sm mb-2">Upcoming Events</div>
            <div className="text-3xl font-bold text-[var(--neon-cyan)]">
              {upcomingEvents || 0}
            </div>
          </div>

          {/* Total Events */}
          <div className="bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-6">
            <div className="text-[var(--muted)] text-sm mb-2">Total Events</div>
            <div className="text-3xl font-bold text-[var(--neon-purple)]">
              {totalEvents || 0}
            </div>
          </div>

          {/* Venue Submitted */}
          <div className="bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-6">
            <div className="text-[var(--muted)] text-sm mb-2">
              Events You Submitted
            </div>
            <div className="text-3xl font-bold text-[var(--neon-amber)]">
              {venueSubmittedEvents || 0}
            </div>
          </div>
        </div>

        {/* Portal Coverage Info */}
        <div className="bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">Portal Coverage</h2>
          <p className="text-[var(--soft)] mb-4">
            Your venue appears on Lost City portals across the city. Events you submit
            are automatically distributed to all relevant portals based on location and
            category.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[var(--void)] border border-[var(--border)] rounded p-4">
              <div className="text-sm text-[var(--muted)] mb-1">Main Portal</div>
              <div className="font-medium text-[var(--neon-cyan)]">Atlanta</div>
            </div>
            <div className="bg-[var(--void)] border border-[var(--border)] rounded p-4">
              <div className="text-sm text-[var(--muted)] mb-1">Visibility</div>
              <div className="font-medium text-[var(--neon-green)]">
                All category-matched portals
              </div>
            </div>
          </div>
        </div>

        {/* Coming Soon */}
        <div className="mt-8 bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-6">
          <h2 className="text-lg font-bold mb-4">Coming Soon</h2>
          <ul className="space-y-3 text-[var(--soft)]">
            <li className="flex items-start gap-2">
              <span className="text-[var(--muted)]">•</span>
              <span>Event page views and click-through rates</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--muted)]">•</span>
              <span>Portal-specific performance metrics</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--muted)]">•</span>
              <span>User saves and RSVPs to your events</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--muted)]">•</span>
              <span>Follower count and growth trends</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
