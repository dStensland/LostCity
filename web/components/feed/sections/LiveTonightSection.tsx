import { MusicNotes } from "@phosphor-icons/react/dist/ssr";
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
    <section className="rounded-xl border border-[var(--twilight)]/40 bg-[var(--night)] overflow-hidden p-4 sm:p-6">
      {/* Per spec: secondary-priority header with coral mic icon, mono uppercase
          "LIVE TONIGHT", soft "See all →" on the right. The badge is dropped —
          the spec puts venue/show counts in the Tonight zone sub-header inside
          the playbill, not the section header. */}
      <FeedSectionHeader
        title="Live Tonight"
        priority="secondary"
        accentColor="var(--vibe)"
        icon={<MusicNotes weight="duotone" className="w-5 h-5" />}
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
