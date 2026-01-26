"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import UnifiedHeader from "@/components/UnifiedHeader";
import { useAuth } from "@/lib/auth-context";

const submissionTypes = [
  {
    type: "event",
    href: "/submit/event",
    title: "Submit an Event",
    description: "Add a concert, show, festival, or other happening to LostCity",
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
  const router = useRouter();

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
              All submissions are reviewed before publishing
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
              After 5+ approved submissions with a 90%+ approval rate, your submissions will auto-publish
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
