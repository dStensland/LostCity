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
  const request = await resolveDetailPageRequest({
    portalSlug,
    pathname,
  });

  if (!request || !request.isFilm) {
    return null;
  }

  return request;
}
