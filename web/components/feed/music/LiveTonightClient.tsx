"use client";

import { useCallback, useState } from "react";
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

  const closeSheet = useCallback(() => setActiveShow(null), []);

  const handleAddToPlans = useCallback(async (show: MusicShowPayload) => {
    try {
      const res = await fetch("/api/plans/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: show.id }),
      });
      if (!res.ok) {
        console.warn("[live-tonight] add to plans failed:", res.status);
      }
    } catch (err) {
      console.warn("[live-tonight] add to plans error:", err);
    }
    setActiveShow(null);
  }, []);

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
        onClose={closeSheet}
        onAddToPlans={handleAddToPlans}
      />
    </>
  );
}
