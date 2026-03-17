"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";

const ShowtimesView = dynamic(() => import("./ShowtimesView"));
const MusicListingsView = dynamic(() => import("./MusicListingsView"));

type WhatsOnVertical = "film" | "music";

interface WhatsOnViewProps {
  portalId: string;
  portalSlug: string;
}

export default function WhatsOnView({ portalId, portalSlug }: WhatsOnViewProps) {
  const searchParams = useSearchParams();
  const rawVertical = searchParams?.get("vertical");
  const initialVertical: WhatsOnVertical = rawVertical === "music" ? "music" : "film";
  const [activeVertical, setActiveVertical] = useState<WhatsOnVertical>(initialVertical);

  const handleVerticalChange = useCallback((vertical: WhatsOnVertical) => {
    setActiveVertical(vertical);
    const url = new URL(window.location.href);
    url.searchParams.set("vertical", vertical);
    window.history.replaceState({}, "", url.toString());
  }, []);

  const verticals: { key: WhatsOnVertical; label: string }[] = [
    { key: "film", label: "Film" },
    { key: "music", label: "Music" },
  ];

  return (
    <div>
      {/* Sub-tab bar */}
      <div className="flex items-center gap-4 px-4 pt-3 pb-0">
        {verticals.map(({ key, label }) => {
          const isActive = activeVertical === key;
          return (
            <button
              key={key}
              onClick={() => handleVerticalChange(key)}
              className={`px-0 pb-2.5 font-mono text-xs font-semibold tracking-[0.08em] transition-colors ${
                isActive
                  ? "text-[var(--coral)] border-b-2 border-[var(--coral)]"
                  : "text-[var(--muted)] hover:text-[var(--cream)]"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="border-b border-[var(--twilight)]" />

      {/* Tab content */}
      {activeVertical === "film" && (
        <ShowtimesView portalId={portalId} portalSlug={portalSlug} />
      )}
      {activeVertical === "music" && (
        <MusicListingsView portalId={portalId} portalSlug={portalSlug} />
      )}
    </div>
  );
}
