import "server-only";

import { resolveDetailPageRequest } from "./resolve-detail-page-request";

interface ResolveFilmPageRequestArgs {
  portalSlug: string;
  pathname: string;
}

export async function resolveFilmPageRequest({
  portalSlug,
  pathname,
}: ResolveFilmPageRequestArgs) {
  return resolveDetailPageRequest({
    portalSlug,
    pathname,
  });
}
