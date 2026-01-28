import Link from "next/link";
import UnifiedHeader from "@/components/UnifiedHeader";
import Button from "@/components/ui/Button";

export default function SubmitEventPage() {
  return (
    <div className="min-h-screen">
      <UnifiedHeader />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/submit"
            className="text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-semibold text-[var(--cream)]">
            Submit an Event
          </h1>
        </div>

        <div className="p-8 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)]">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[var(--coral)]/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--coral)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            <h2 className="text-xl font-medium text-[var(--cream)] mb-4">
              Working with Event Organizers
            </h2>

            <p className="text-[var(--muted)] font-mono text-sm mb-6 leading-relaxed">
              We&apos;re currently partnering directly with event organizers and venues to ensure
              high-quality, up-to-date event listings. If you&apos;re interested in getting your
              events featured on LostCity, we&apos;d love to hear from you.
            </p>

            <div className="mb-8">
              <a
                href="mailto:coach@lostcity.ai"
                className="inline-flex items-center gap-2 text-[var(--coral)] hover:text-[var(--rose)] font-mono text-sm transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                coach@lostcity.ai
              </a>
            </div>

            <Link href="/submit">
              <Button variant="secondary" size="md">
                Back to Submit Hub
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-8 p-6 rounded-xl bg-[var(--void)]/50 border border-[var(--twilight)]">
          <h3 className="font-mono text-sm font-medium text-[var(--cream)] mb-3">
            In the Meantime
          </h3>
          <ul className="space-y-2 text-[var(--muted)] font-mono text-xs">
            <li className="flex items-start gap-2">
              <span className="text-[var(--coral)]">•</span>
              You can still submit venues and organizations through the Submit Hub
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--coral)]">•</span>
              Event organizers can email us to discuss partnership opportunities
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[var(--coral)]">•</span>
              We&apos;re working on expanding our event coverage across Atlanta
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
