import "server-only";

import { headers } from "next/headers";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";

interface ResolveCommunityPageRequestArgs {
  portalSlug: string;
  pathname: string;
}

export async function resolveCommunityPageRequest({
  portalSlug,
  pathname,
}: ResolveCommunityPageRequestArgs) {
  const headersList = await headers();

  return resolvePortalRequest({
    slug: portalSlug,
    headersList,
    pathname,
    surface: "community",
  });
}
