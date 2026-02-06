"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import { useAuth } from "@/lib/auth-context";

type SubmissionCounts = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  needs_edit: number;
};

type TrustStatus = {
  score: number | null;
  eligible: boolean;
  tier: string;
  is_trusted: boolean;
};

const submissionTypes = [
  {
    type: "event",
    href: "/submit/event",
    title: "Submit an Event",
    description: "Submit a public event for review (2–3 minutes)",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: "coral",
  },
  {
    type: "venue",
    href: "/submit/venue",
    title: "Add a Venue",
    description: "Add a new bar, restaurant, gallery, or performance space",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: "rose",
  },
  {
    type: "org",
    href: "/submit/org",
    title: "Add an Organization",
    description: "Add an arts nonprofit, event producer, or community group",
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: "gold",
  },
];

export default function SubmitPage() {
  const { user } = useAuth();
  const [counts, setCounts] = useState<SubmissionCounts | null>(null);
  const [trust, setTrust] = useState<TrustStatus | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user) return;
    let isActive = true;

    fetch("/api/submissions?limit=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isActive || !data) return;
        setCounts(data.counts || null);
        setTrust(data.trust || null);
      })
      .catch(() => {
        if (!isActive) return;
        setCounts(null);
        setTrust(null);
      })
      .finally(() => {
        if (isActive) setLoadingStats(false);
      });

    return () => {
      isActive = false;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen">
        <UnifiedHeader />
        <main className="max-w-2xl mx-auto px-4 py-12">
          <div className="text-center">
            <h1 className="text-3xl font-semibold text-[var(--cream)] mb-4">
              Submit to LostCity
            </h1>
            <p className="text-[var(--muted)] font-mono text-sm mb-8">
              Sign in to submit events, venues, and organizations
            </p>
            <Link
              href="/auth/login?redirect=/submit"
              className="inline-flex px-6 py-3 rounded-lg bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
            >
              Sign In to Continue
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-[var(--cream)] mb-2">
            Submit to LostCity
          </h1>
          <p className="text-[var(--muted)] font-mono text-sm">
            Help us discover more great events, venues, and organizations in Atlanta
          </p>
        </div>

        <div className="mb-8 p-6 rounded-xl bg-[var(--void)]/60 border border-[var(--twilight)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-xs text-[var(--muted)] uppercase tracking-wider">
                Your Submission Status
              </div>
              <div className="text-lg font-semibold text-[var(--cream)] mt-1">
                {trust?.is_trusted ? "Trusted Submitter" : "Standard Submitter"}
              </div>
              <p className="text-[var(--muted)] font-mono text-xs mt-1 max-w-md">
                {trust?.is_trusted
                  ? "Your submissions can be auto-approved when they include proof or verified place data."
                  : "Most submissions are reviewed before publishing. Add links and details to speed things up."}
              </p>
            </div>
            <Link
              href="/dashboard/submissions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] font-mono text-xs hover:border-[var(--coral)] transition-colors"
            >
              View submissions
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-[var(--dusk)]/70 border border-[var(--twilight)]">
              <div className="text-[var(--muted)] uppercase tracking-wider">Approved</div>
              <div className="text-[var(--cream)] text-sm mt-1">
                {loadingStats ? "…" : counts?.approved ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--dusk)]/70 border border-[var(--twilight)]">
              <div className="text-[var(--muted)] uppercase tracking-wider">Pending</div>
              <div className="text-[var(--cream)] text-sm mt-1">
                {loadingStats ? "…" : counts?.pending ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--dusk)]/70 border border-[var(--twilight)]">
              <div className="text-[var(--muted)] uppercase tracking-wider">Needs Edit</div>
              <div className="text-[var(--cream)] text-sm mt-1">
                {loadingStats ? "…" : counts?.needs_edit ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-[var(--dusk)]/70 border border-[var(--twilight)]">
              <div className="text-[var(--muted)] uppercase tracking-wider">Approval Rate</div>
              <div className="text-[var(--cream)] text-sm mt-1">
                {loadingStats || !trust?.score ? "—" : `${Math.round(trust.score * 100)}%`}
              </div>
            </div>
          </div>

          {trust?.eligible && !trust?.is_trusted && (
            <div className="mt-4 p-3 rounded-lg bg-[var(--neon-green)]/10 border border-[var(--neon-green)]/30 text-[var(--neon-green)] font-mono text-xs">
              You&apos;re eligible for Trusted Submitter status. A community manager can promote you.
            </div>
          )}
        </div>

        <div className="space-y-4">
          {submissionTypes.map((item) => (
            <Link
              key={item.type}
              href={item.href}
              className="block p-6 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] hover:border-[var(--coral)] transition-all group"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-lg bg-[var(--${item.color})]/10 text-[var(--${item.color})] group-hover:bg-[var(--${item.color})]/20 transition-colors`}
                >
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-medium text-[var(--cream)] group-hover:text-[var(--coral)] transition-colors">
                    {item.title}
                  </h2>
                  <p className="text-[var(--muted)] font-mono text-sm mt-1">
                    {item.description}
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-[var(--muted)] group-hover:text-[var(--coral)] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* Guidelines */}
        <div className="mt-8 p-6 rounded-xl bg-[var(--void)]/50 border border-[var(--twilight)]">
          <h3 className="font-mono text-sm font-medium text-[var(--cream)] mb-3">
            Submission Guidelines
          </h3>
          <ul className="space-y-2 text-[var(--muted)] font-mono text-xs">
            <li className="flex items-start gap-2">
              <span className="text-[var(--coral)]">•</span>
              Untrusted submissions are reviewed before publishing
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--coral)]">•</span>
              Places matched to verified map data can be auto-approved instantly
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--coral)]">•</span>
              Events must be in the Atlanta metro area
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--coral)]">•</span>
              Provide accurate information and working links
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--coral)]">•</span>
              After 5+ approved submissions with a 90%+ approval rate, a community manager can promote you to trusted
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
