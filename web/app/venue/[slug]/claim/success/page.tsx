import Link from "next/link";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";

export default function ClaimSuccessPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <div className="min-h-screen bg-[var(--void)] text-[var(--cream)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[var(--void-light)] border border-[var(--border)] rounded-lg p-8 text-center">
        <div className="text-6xl mb-4">✅</div>
        <h1 className="text-2xl font-bold mb-4">Claim Submitted!</h1>
        <p className="text-[var(--soft)] mb-6">
          We&apos;ve received your claim request. Our team will review it and notify
          you via email once it&apos;s been approved.
        </p>
        <p className="text-sm text-[var(--muted)] mb-8">
          This typically takes 1-2 business days.
        </p>
        <div className="space-y-3">
          <Link
            href={`/${DEFAULT_PORTAL_SLUG}/spots/${params.slug}`}
            className="block w-full px-6 py-3 bg-[var(--coral)] text-[var(--void)] font-medium rounded hover:bg-[var(--coral)]/90 transition-colors"
          >
            Back to Venue
          </Link>
          <Link
            href={`/${DEFAULT_PORTAL_SLUG}`}
            className="block w-full px-6 py-3 border border-[var(--border)] rounded hover:bg-[var(--void)] transition-colors"
          >
            Explore More
          </Link>
        </div>
      </div>
    </div>
  );
}
