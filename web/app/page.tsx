import Link from "next/link";
import Logo from "@/components/Logo";

// Disable caching for this page
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Coral glow effect */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-50px",
          width: "500px",
          height: "300px",
          background: "radial-gradient(ellipse, rgba(255, 107, 122, 0.2) 0%, transparent 70%)",
          animation: "pulse-glow 4s ease-in-out infinite",
        }}
        aria-hidden="true"
      />

      <Logo size="lg" href={undefined} />
      <p className="font-serif text-[var(--muted)] mt-4 mb-8 text-lg">
        Find what&apos;s happening tonight
      </p>
      <Link
        href="/atlanta"
        className="px-8 py-4 bg-[var(--coral)] text-[var(--night)] rounded-lg font-medium hover:opacity-90 transition-opacity text-lg"
      >
        Explore Atlanta
      </Link>
    </div>
  );
}
