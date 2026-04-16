"use client";

interface PlansPageClientProps {
  portalSlug: string;
  isAuthenticated: boolean;
}

export function PlansPageClient({
  portalSlug,
  isAuthenticated,
}: PlansPageClientProps) {
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="text-base font-semibold text-[var(--cream)]">
          Sign in to see your plans
        </p>
        <a
          href="/auth/signin"
          className="mt-4 text-sm text-[var(--coral)] hover:underline"
        >
          Sign in →
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-[var(--cream)] mb-6">Plans</h1>
      <p className="text-sm text-[var(--muted)]">
        Your committed events, series subscriptions, and group plans will appear here.
      </p>
    </div>
  );
}
