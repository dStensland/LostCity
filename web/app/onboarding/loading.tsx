export default function OnboardingLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--void)]">
      <div className="text-center">
        {/* Spinner */}
        <div className="w-12 h-12 mx-auto mb-4 border-3 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />

        {/* Loading text */}
        <p className="font-mono text-sm text-[var(--muted)]">Loading onboarding...</p>
      </div>
    </div>
  );
}
