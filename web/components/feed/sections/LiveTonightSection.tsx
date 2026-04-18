import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { loadThisWeek } from "@/lib/music/this-week-loader";
import { loadTonight } from "@/lib/music/tonight-loader";
import { LiveTonightClient } from "@/components/feed/music/LiveTonightClient";

export interface LiveTonightSectionProps {
  portalSlug: string;
}

export async function LiveTonightSection({ portalSlug }: LiveTonightSectionProps) {
  const [thisWeek, tonight] = await Promise.all([
    loadThisWeek(portalSlug),
    loadTonight(portalSlug),
  ]);

  const totalTonight =
    tonight.tonight.reduce((acc, g) => acc + g.shows.length, 0) +
    tonight.late_night.reduce((acc, g) => acc + g.shows.length, 0);

  if (thisWeek.shows.length === 0 && totalTonight === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] overflow-hidden p-4">
      <FeedSectionHeader
        title="Live Tonight"
        priority="primary"
        accentColor="var(--vibe)"
        badge={totalTonight > 0 ? `${totalTonight} show${totalTonight === 1 ? "" : "s"}` : undefined}
        seeAllHref={`/${portalSlug}/explore/music`}
      />

      <LiveTonightClient
        thisWeekShows={thisWeek.shows}
        tonightPayload={tonight}
        portalSlug={portalSlug}
      />
    </section>
  );
}

export default LiveTonightSection;
