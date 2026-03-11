"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePortal } from "@/lib/portal-context";
import { useAuth } from "@/lib/auth-context";
import { PortalHeader } from "@/components/headers";
import type { ItineraryListItem } from "@/lib/itinerary-utils";
import { formatRsvpStatus } from "@/lib/itinerary-utils";

export default function MyPlansPage() {
  const { portal } = usePortal();
  const { user, loading: authLoading } = useAuth();
  const [plans, setPlans] = useState<ItineraryListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;

    const controller = new AbortController();
    async function fetchPlans() {
      setLoading(true);
      try {
        const res = await fetch(`/api/itineraries?portal_id=${portal.id}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setPlans(data.itineraries || []);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Failed to load plans:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchPlans();
    return () => controller.abort();
  }, [user, authLoading, portal.id]);

  const owned = plans.filter((p) => p.role === "owner");
  const joined = plans.filter((p) => p.role === "participant");

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--void)]">
        <PortalHeader portalSlug={portal.slug} portalName={portal.name} />
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-32 bg-[var(--dusk)] rounded" />
            <div className="h-20 bg-[var(--dusk)] rounded-xl" />
            <div className="h-20 bg-[var(--dusk)] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--void)]">
        <PortalHeader portalSlug={portal.slug} portalName={portal.name} />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h2 className="text-lg text-[var(--cream)] mb-2">Sign in to see your plans</h2>
          <p className="text-sm text-[var(--muted)] max-w-xs mx-auto mb-4">
            Create plans and join friends&apos; plans to coordinate your nights out.
          </p>
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(`/${portal.slug}/plans`)}`}
            className="inline-block px-6 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--void)]">
      <PortalHeader portalSlug={portal.slug} portalName={portal.name} />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28 space-y-8">
        <h1 className="text-2xl font-semibold text-[var(--cream)]">My Plans</h1>

        {loading ? (
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-[var(--dusk)] rounded-xl" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--twilight)]/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h2 className="text-lg text-[var(--cream)] mb-2">No plans yet</h2>
            <p className="text-sm text-[var(--muted)] max-w-xs mx-auto mb-4">
              Build an itinerary from any event or venue, then share it with friends.
            </p>
            <Link
              href={`/${portal.slug}`}
              className="inline-block px-4 py-2 bg-[var(--twilight)]/30 rounded-lg font-mono text-sm text-[var(--cream)] hover:bg-[var(--twilight)]/50 transition-colors"
            >
              Explore events
            </Link>
          </div>
        ) : (
          <>
            {/* Owned plans */}
            {owned.length > 0 && (
              <section>
                <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--soft)] mb-3">
                  My Plans
                </h2>
                <div className="space-y-2">
                  {owned.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} portalSlug={portal.slug} />
                  ))}
                </div>
              </section>
            )}

            {/* Joined plans */}
            {joined.length > 0 && (
              <section>
                <h2 className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--soft)] mb-3">
                  Joined
                </h2>
                <div className="space-y-2">
                  {joined.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} portalSlug={portal.slug} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function PlanCard({
  plan,
  portalSlug,
}: {
  plan: ItineraryListItem;
  portalSlug: string;
}) {
  const link = plan.share_token
    ? `/${portalSlug}/itinerary/${plan.share_token}`
    : `/${portalSlug}/plans`;

  const dateDisplay = plan.date
    ? new Date(plan.date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Link
      href={link}
      className="block p-4 rounded-xl bg-[var(--night)] border border-[var(--twilight)]/40 hover:border-[var(--twilight)] transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[var(--cream)] truncate group-hover:text-[var(--coral)] transition-colors">
            {plan.title}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {dateDisplay && (
              <span className="font-mono text-xs text-[var(--muted)]">{dateDisplay}</span>
            )}
            {plan.role === "participant" && plan.my_rsvp_status && (
              <>
                {dateDisplay && <span className="text-[var(--twilight)]">&middot;</span>}
                <span className={`font-mono text-xs ${
                  plan.my_rsvp_status === "going"
                    ? "text-[var(--neon-green)]"
                    : "text-[var(--muted)]"
                }`}>
                  {formatRsvpStatus(plan.my_rsvp_status)}
                </span>
              </>
            )}
          </div>
          {plan.description && (
            <p className="text-sm text-[var(--soft)] mt-1 line-clamp-1">
              {plan.description}
            </p>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {plan.role === "participant" && (
            <span className="font-mono text-2xs text-[var(--muted)] bg-[var(--twilight)]/50 px-2 py-0.5 rounded-full">
              Joined
            </span>
          )}
          <svg className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--cream)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
