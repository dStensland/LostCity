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
    <div className="flex items-center bg-white/10 backdrop-blur-md rounded-full p-0.5 border border-white/10">
      <button
        onClick={() => setView("list")}
        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1.5 ${
          currentView === "list"
            ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg"
            : "text-orange-100/70 hover:text-white hover:bg-white/10"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        onClick={() => setView("map")}
        className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all flex items-center gap-1.5 ${
          currentView === "map"
            ? "bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow-lg"
            : "text-orange-100/70 hover:text-white hover:bg-white/10"
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
