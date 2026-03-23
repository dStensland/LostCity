"use client";

import { useState, useCallback, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { FilmSlate, MusicNote, MaskHappy } from "@phosphor-icons/react";

const ShowtimesView = dynamic(() => import("./ShowtimesView"));
const MusicListingsView = dynamic(() => import("./MusicListingsView"));
const StageListingsView = dynamic(() => import("./StageListingsView"));

type WhatsOnVertical = "film" | "music" | "stage";

interface WhatsOnViewProps {
  portalId: string;
  portalSlug: string;
}

const VERTICALS: { key: WhatsOnVertical; label: string; icon: ReactNode }[] = [
  { key: "film", label: "Film", icon: <FilmSlate weight="duotone" className="w-4 h-4" /> },
  { key: "music", label: "Music", icon: <MusicNote weight="duotone" className="w-4 h-4" /> },
  { key: "stage", label: "Stage", icon: <MaskHappy weight="duotone" className="w-4 h-4" /> },
];

export default function WhatsOnView({ portalId, portalSlug }: WhatsOnViewProps) {
  const searchParams = useSearchParams();
  const rawVertical = searchParams?.get("vertical");
  const initialVertical: WhatsOnVertical =
    rawVertical === "music" ? "music" : rawVertical === "stage" ? "stage" : "film";
  const [activeVertical, setActiveVertical] = useState<WhatsOnVertical>(initialVertical);

  const handleVerticalChange = useCallback((vertical: WhatsOnVertical) => {
    setActiveVertical(vertical);
    const url = new URL(window.location.href);
    url.searchParams.set("vertical", vertical);
    window.history.replaceState({}, "", url.toString());
  }, []);

  return (
    <div>
      {/* Vertical tab bar */}
      <div role="tablist" className="flex items-center gap-1.5 px-3 sm:px-0 pt-3 pb-3">
        {VERTICALS.map(({ key, label, icon }) => {
          const isActive = activeVertical === key;
          return (
            <button
              key={key}
              id={`tab-${key}`}
              role="tab"
              onClick={() => handleVerticalChange(key)}
              aria-selected={isActive}
              aria-controls={`panel-${key}`}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-mono text-xs font-medium border transition-all ${
                isActive
                  ? "bg-[var(--neon-magenta)]/15 text-[var(--neon-magenta)] border-[var(--neon-magenta)]/30"
                  : "text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/40 border border-transparent"
              }`}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeVertical === "film" && (
        <div id="panel-film" role="tabpanel" aria-labelledby="tab-film">
          <ShowtimesView portalId={portalId} portalSlug={portalSlug} />
        </div>
      )}
      {activeVertical === "music" && (
        <div id="panel-music" role="tabpanel" aria-labelledby="tab-music">
          <MusicListingsView portalId={portalId} portalSlug={portalSlug} />
        </div>
      )}
      {activeVertical === "stage" && (
        <div id="panel-stage" role="tabpanel" aria-labelledby="tab-stage">
          <StageListingsView portalId={portalId} portalSlug={portalSlug} />
        </div>
      )}
    </div>
  );
}
