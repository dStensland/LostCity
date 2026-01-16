import Link from "next/link";
import Logo from "@/components/Logo";

// Disable caching for this page
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Logo size="lg" href={undefined} />
      <p className="font-serif text-[var(--muted)] mt-2 mb-8">
        Discover local events
      </p>
      <Link
        href="/atlanta"
        className="px-6 py-3 bg-[var(--coral)] text-[var(--night)] rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Explore Atlanta
      </Link>
    </div>
  );
}
