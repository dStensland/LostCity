"use client";

import { usePathname, useRouter } from "next/navigation";

export default function ModeToggle() {
  const pathname = usePathname();
  const router = useRouter();
  const isSpots = pathname.startsWith("/spots");

  return (
    <div className="inline-flex bg-[var(--twilight)] rounded-md p-0.5">
      <button
        onClick={() => router.push("/")}
        className={`px-3 py-1.5 rounded font-mono text-xs font-medium transition-colors ${
          !isSpots
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
    </div>
  );
}
