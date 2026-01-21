"use client";

import { useState, useEffect } from "react";
import SerendipityMoment, { getRandomSerendipityType } from "./SerendipityMoment";

type SerendipityEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  category: string | null;
  venue: {
    name: string;
    neighborhood: string | null;
  } | null;
};

interface Props {
  portalSlug?: string;
  position?: number; // Position in feed (used to vary the serendipity type)
}

export default function SerendipityFeed({ portalSlug, position = 0 }: Props) {
  const [event, setEvent] = useState<SerendipityEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch a random "serendipity" event
    async function fetchSerendipityEvent() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

        // Fetch events with some randomization
        const res = await fetch(
          `/api/events?date_start=${today}&date_end=${weekFromNow}&limit=50&offset=${position * 10}`
        );

        if (!res.ok) {
          setLoading(false);
          return;
        }

        const data = await res.json();
        const events = data.events || [];

        if (events.length > 0) {
          // Pick a random event from the batch
          const randomIndex = Math.floor(Math.random() * Math.min(events.length, 10));
          setEvent(events[randomIndex]);
        }
      } catch (err) {
        console.error("Failed to fetch serendipity event:", err);
      } finally {
        setLoading(false);
      }
    }

    // Only show serendipity ~50% of the time for variety
    if (Math.random() > 0.5) {
      fetchSerendipityEvent();
    } else {
      setLoading(false);
    }
  }, [position]);

  if (loading || dismissed || !event) {
    return null;
  }

  const serendipityType = getRandomSerendipityType(event);

  return (
    <SerendipityMoment
      type={serendipityType}
      event={event}
      portalSlug={portalSlug}
      onDismiss={() => setDismissed(true)}
    />
  );
}
