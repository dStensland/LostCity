import Link from "next/link";
import Logo from "@/components/Logo";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Coral glow effect */}
      <div
        className="absolute pointer-events-none not-found-glow"
        aria-hidden="true"
      />

      {/* Logo */}
      <Logo size="lg" href={undefined} />

      {/* Message */}
      <div className="text-center mt-8 max-w-md">
        <h1 className="text-2xl font-semibold text-[var(--cream)] mb-2">
          Some who wander are also lost
        </h1>
        <p className="font-mono text-sm text-[var(--muted)]">
          That&apos;s you.
        </p>
      </div>

      {/* CTA */}
      <Link
        href={`/${DEFAULT_PORTAL_SLUG}`}
        className="mt-8 px-8 py-4 bg-[var(--coral)] text-[var(--void)] rounded-lg font-medium hover:bg-[var(--rose)] transition-colors glow-sm"
      >
        Find Something to Do
      </Link>

      {/* Secondary link */}
      <Link
        href="/"
        className="mt-4 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
      >
        Go home
      </Link>
    </div>
  );
}
