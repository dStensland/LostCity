import Link from "next/link";
import { PlatformHeader } from "@/components/headers";
import PageFooter from "@/components/PageFooter";

export const metadata = {
  title: "Your People | Lost City",
  description: "See what your friends are doing and make plans together",
};

export default function YourPeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PlatformHeader />
      <div className="max-w-3xl mx-auto w-full px-4 pt-3">
        <Link
          href="/atlanta"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Atlanta
        </Link>
      </div>
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-28 space-y-6">
        {children}
      </main>
      <PageFooter />
    </div>
  );
}
