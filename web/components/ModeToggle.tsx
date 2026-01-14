"use client";

import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function ModeToggle() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const isEvents = pathname === "/" || pathname.startsWith("/events");
  const isSpots = pathname.startsWith("/spots");
  const isForYou = pathname.startsWith("/foryou");

  return (
    <div className="inline-flex bg-[var(--twilight)] rounded-md p-0.5">
      <button
        onClick={() => router.push("/")}
        className={`px-3 py-1.5 rounded font-mono text-xs font-medium transition-colors ${
          isEvents && !isForYou
            ? "bg-[var(--cream)] text-[var(--void)]"
            : "text-[var(--muted)] hover:text-[var(--cream)]"
        }`}
      >
        Things to Do
      </button>
      <button
        onClick={() => router.push("/spots")}
        className={`px-3 py-1.5 rounded font-mono text-xs font-medium transition-colors ${
          isSpots
            ? "bg-[var(--cream)] text-[var(--void)]"
            : "text-[var(--muted)] hover:text-[var(--cream)]"
        }`}
      >
        Spots to Go
      </button>
      {user && (
        <button
          onClick={() => router.push("/foryou")}
          className={`px-3 py-1.5 rounded font-mono text-xs font-medium transition-colors ${
            isForYou
              ? "bg-[var(--coral)] text-[var(--void)]"
              : "text-[var(--muted)] hover:text-[var(--cream)]"
          }`}
        >
          For You
        </button>
      )}
    </div>
  );
}
