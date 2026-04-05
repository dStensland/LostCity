import "server-only";

import { headers } from "next/headers";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";

interface ResolveFeedPageRequestArgs {
  portalSlug: string;
  pathname: string;
}

export async function resolveFeedPageRequest({
  portalSlug,
  pathname,
}: ResolveFeedPageRequestArgs) {
  const headersList = await headers();

  return resolvePortalRequest({
    slug: portalSlug,
    headersList,
    pathname,
    surface: "feed",
  });
}
