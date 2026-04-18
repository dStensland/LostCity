"use client";

import { useState } from "react";
import { LiveTonightHeroStrip } from "./LiveTonightHeroStrip";
import { LiveTonightPlaybill } from "./LiveTonightPlaybill";
import { MusicActionSheet } from "@/components/music/MusicActionSheet";
import type { MusicShowPayload, TonightPayload } from "@/lib/music/types";

export interface LiveTonightClientProps {
  thisWeekShows: MusicShowPayload[];
  tonightPayload: TonightPayload;
  portalSlug: string;
}

export function LiveTonightClient({
  thisWeekShows,
  tonightPayload,
  portalSlug,
}: LiveTonightClientProps) {
  const [activeShow, setActiveShow] = useState<MusicShowPayload | null>(null);

  const handleAddToPlans = async (show: MusicShowPayload) => {
    try {
      await fetch("/api/plans/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: show.id }),
      });
    } catch {
      // Surface via Plans toast infra elsewhere; swallow here.
    }
    setActiveShow(null);
  };

  return (
    <>
      <LiveTonightHeroStrip
        shows={thisWeekShows}
        portalSlug={portalSlug}
        onTileTap={setActiveShow}
      />
      <LiveTonightPlaybill
        payload={tonightPayload}
        portalSlug={portalSlug}
        onShowTap={setActiveShow}
      />
      <MusicActionSheet
        show={activeShow}
        portalSlug={portalSlug}
        onClose={() => setActiveShow(null)}
        onAddToPlans={handleAddToPlans}
      />
    </>
  );
}
