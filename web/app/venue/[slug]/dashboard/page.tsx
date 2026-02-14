import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getLocalDateString } from "@/lib/formats";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function VenueDashboardPage({ params }: Props) {
  const { slug } = await params;

  // Check authentication
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect(`/auth/login?redirect=/venue/${slug}/dashboard`);
  }

  // Get venue and verify ownership
  const { data: venue, error: venueError } = await supabase
    .from("venues")
    .select("id, name, slug, claimed_by, is_verified, address, city, state, image_url")
    .eq("slug", slug)
    .maybeSingle() as {
      data: {
        id: number;
        name: string;
        slug: string;
        claimed_by: string | null;
        is_verified: boolean | null;
        address: string | null;
        city: string;
        state: string;
        image_url: string | null;
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
            You do not have permission to manage this venue.
          </p>
          <Link
            href={`/${DEFAULT_PORTAL_SLUG}/spots/${slug}`}
            className="text-[var(--coral)] hover:underline"
          >
            View venue page
          </Link>
        </div>
      </div>
    );
  }

  // Get stats for the venue
  const { count: eventCount } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", venue.id)
    .gte("start_date", getLocalDateString());

  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--cream)]">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--void-light)]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">{venue.name}</h1>
              <p className="text-[var(--muted)] text-sm">
                {venue.address && `${venue.address}, `}
                {venue.city}, {venue.state}
              </p>
            </div>
            {venue.is_verified && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--neon-green)]/10 text-[var(--neon-green)] rounded border border-[var(--neon-green)]/20 text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Verified
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="mt-6 flex gap-1">
            <Link
              href={`/venue/${slug}/dashboard`}
              className="px-4 py-2 rounded bg-[var(--coral)] text-[var(--void)] font-medium"
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
              className="px-4 py-2 rounded text-[var(--cream)] hover:bg-[var(--void)] border border-transparent hover:border-[var(--border)] transition-colors"
            >
              Analytics
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Stats */}
          <div className="bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Quick Stats</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)]">Upcoming Events</span>
                <span className="text-2xl font-bold text-[var(--neon-cyan)]">
                  {eventCount || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--muted)]">Verification Status</span>
                <span className={`font-medium ${venue.is_verified ? "text-[var(--neon-green)]" : "text-[var(--neon-amber)]"}`}>
                  {venue.is_verified ? "Verified" : "Pending"}
                </span>
              </div>
            </div>
          </div>

          {/* Getting Started */}
          <div className="bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-6">
            <h2 className="text-lg font-bold mb-4">Getting Started</h2>
            <div className="space-y-3">
              <Link
                href={`/venue/${slug}/dashboard/edit`}
                className="block p-3 rounded bg-[var(--void)] hover:bg-[var(--void)]/50 border border-[var(--border)] transition-colors"
              >
                <div className="font-medium mb-1">Complete your profile</div>
                <div className="text-sm text-[var(--muted)]">
                  Add photos, description, and hours
                </div>
              </Link>
              <Link
                href={`/venue/${slug}/dashboard/submit-event`}
                className="block p-3 rounded bg-[var(--void)] hover:bg-[var(--void)]/50 border border-[var(--border)] transition-colors"
              >
                <div className="font-medium mb-1">Submit your first event</div>
                <div className="text-sm text-[var(--muted)]">
                  Events appear across all portals
                </div>
              </Link>
            </div>
          </div>

          {/* Venue Preview */}
          <div className="bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-6 md:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Venue Preview</h2>
              <Link
                href={`/${DEFAULT_PORTAL_SLUG}/spots/${slug}`}
                className="text-[var(--coral)] hover:underline text-sm"
              >
                View public page →
              </Link>
            </div>
            <div className="flex gap-4">
              {venue.image_url && (
                <Image
                  src={venue.image_url}
                  alt={venue.name}
                  width={128}
                  height={128}
                  unoptimized
                  className="w-32 h-32 object-cover rounded"
                />
              )}
              <div>
                <h3 className="font-bold text-xl mb-1">{venue.name}</h3>
                <p className="text-[var(--muted)] text-sm mb-3">
                  {venue.address && `${venue.address}, `}
                  {venue.city}, {venue.state}
                </p>
                <div className="text-sm text-[var(--soft)]">
                  Your venue appears on Lost City portals and is discoverable by
                  thousands of locals looking for things to do.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
