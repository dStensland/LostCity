"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  currentView: "list" | "map";
}

export default function ViewToggle({ currentView }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setView = useCallback(
    (view: "list" | "map") => {
      const params = new URLSearchParams(searchParams.toString());

      if (view === "list") {
        params.delete("view");
      } else {
        params.set("view", view);
      }

      const newUrl = params.toString() ? `/?${params.toString()}` : "/";
      router.push(newUrl, { scroll: false });
    },
    [router, searchParams]
  );

  return (
    <div className="flex items-center bg-[var(--dusk)] rounded p-0.5 w-full sm:w-auto justify-center sm:justify-start">
      <button
        type="button"
        onClick={() => setView("list")}
        className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-1.5 ${
          currentView === "list"
            ? "bg-[var(--cream)] text-[var(--void)]"
            : "text-[var(--muted)] hover:text-[var(--cream)]"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
        List
      </button>
      <button
        type="button"
        onClick={() => setView("map")}
        className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center justify-center gap-1.5 ${
          currentView === "map"
            ? "bg-[var(--cream)] text-[var(--void)]"
            : "text-[var(--muted)] hover:text-[var(--cream)]"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        Map
      </button>
    </div>
  );
}
