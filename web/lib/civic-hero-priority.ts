export interface HeroItem {
  id: number;
  title: string;
  tags: string[];
  start_date: string;
  start_time: string | null;
  venue_name: string;
}

export interface HeroSelection {
  item: HeroItem;
  reason: "election" | "channel_match" | "soonest" | "count_fallback";
}

const ELECTION_TAGS = new Set([
  "election", "election-day", "voter-registration", "civic-deadline",
]);

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export function pickHeroItem(
  events: HeroItem[],
  subscribedChannelEventIds: Set<number>,
  now: Date = new Date(),
): HeroSelection | null {
  if (events.length === 0) return null;

  // 1. Election/deadline within 14 days
  const electionEvents = events.filter((e) => {
    if (!e.tags.some((t) => ELECTION_TAGS.has(t))) return false;
    const eventDate = new Date(e.start_date);
    return eventDate.getTime() - now.getTime() <= FOURTEEN_DAYS_MS &&
           eventDate.getTime() >= now.getTime();
  });
  if (electionEvents.length > 0) {
    electionEvents.sort((a, b) => a.start_date.localeCompare(b.start_date));
    return { item: electionEvents[0], reason: "election" };
  }

  // 2. Channel-matched meeting (only if user has subscriptions AND match exists)
  if (subscribedChannelEventIds.size > 0) {
    const channelMatched = events.filter((e) => subscribedChannelEventIds.has(e.id));
    if (channelMatched.length > 0) {
      channelMatched.sort((a, b) => a.start_date.localeCompare(b.start_date));
      return { item: channelMatched[0], reason: "channel_match" };
    }
  }

  // 3. Soonest event
  const sorted = [...events].sort((a, b) => a.start_date.localeCompare(b.start_date));
  return { item: sorted[0], reason: "soonest" };
}
