import type { Portal } from "@/lib/portal-context";
import { getDiscoverFeedData } from "@/lib/concierge/discover-data";
import DiscoverShell from "./DiscoverShell";

interface DiscoverExperienceProps {
  portal: Portal;
}

/**
 * Server component for the Discover feed.
 * Fetches all data, passes to client shell.
 */
export default async function DiscoverExperience({ portal }: DiscoverExperienceProps) {
  const data = await getDiscoverFeedData(portal);
  return <DiscoverShell portal={portal} data={data} />;
}
