"use client";

import { useState, useEffect } from "react";
import { ContestFeedCard } from "@/components/best-of/ContestFeedCard";
import type { BestOfContest } from "@/lib/best-of-contests";

interface ActiveContestData {
  contest: BestOfContest;
  leader: {
    name: string;
    neighborhood: string | null;
    imageUrl: string | null;
    voteCount: number;
  } | null;
  totalVotes: number;
  venueCount: number;
}

interface ActiveContestSectionProps {
  portalSlug: string;
}

export default function ActiveContestSection({ portalSlug }: ActiveContestSectionProps) {
  const [data, setData] = useState<ActiveContestData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // 1. Check for active contest
        const activeRes = await fetch(`/api/contests/active?portal=${portalSlug}`);
        if (!activeRes.ok) return;
        const { contest } = await activeRes.json();
        if (!contest || cancelled) return;

        // 2. Get leaderboard stats for the feed card
        const lbRes = await fetch(`/api/contests/${contest.slug}?portal=${portalSlug}`);
        if (!lbRes.ok || cancelled) return;
        const lb = await lbRes.json();

        if (cancelled) return;

        const leader = lb.venues?.[0]
          ? {
              name: lb.venues[0].name,
              neighborhood: lb.venues[0].neighborhood,
              imageUrl: lb.venues[0].imageUrl,
              voteCount: lb.venues[0].voteCount,
            }
          : null;

        setData({
          contest: lb.contest ?? contest,
          leader,
          totalVotes: lb.totalVotes ?? 0,
          venueCount: lb.venues?.length ?? 0,
        });
      } catch {
        // Silent fail — contest card is optional
      }
    }

    load();
    return () => { cancelled = true; };
  }, [portalSlug]);

  if (!data) return null;

  return (
    <div className="mt-6 px-4 sm:px-0 animate-fade-in">
      <ContestFeedCard
        contest={data.contest}
        leader={data.leader}
        totalVotes={data.totalVotes}
        venueCount={data.venueCount}
        portalSlug={portalSlug}
      />
    </div>
  );
}
