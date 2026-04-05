import "server-only";

import { headers } from "next/headers";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";

interface ResolveDetailPageRequestArgs {
  portalSlug: string;
  pathname: string;
}

export async function resolveDetailPageRequest({
  portalSlug,
  pathname,
}: ResolveDetailPageRequestArgs) {
  const headersList = await headers();

  return resolvePortalRequest({
    slug: portalSlug,
    headersList,
    pathname,
    surface: "detail",
  });
}
