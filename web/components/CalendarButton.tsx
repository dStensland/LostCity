"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function CalendarButton() {
  const pathname = usePathname();
  const isActive = pathname === "/calendar";

  return (
    <Link
      href="/calendar"
      className={`relative inline-flex items-center justify-center p-2.5 rounded-lg transition-colors active:scale-95 ${
        isActive
          ? "text-[var(--cream)] bg-[var(--twilight)]/60"
          : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
      }`}
      aria-label="My Calendar"
      title="My Calendar"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </Link>
  );
}
