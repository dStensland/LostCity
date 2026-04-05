import { notFound, redirect } from "next/navigation";
import { resolveFilmPageRequest } from "../_surfaces/detail/resolve-film-page-request";

type Props = {
  params: Promise<{ portal: string }>;
};

export const revalidate = 120;

export default async function LegacyProgramsPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const request = await resolveFilmPageRequest({
    portalSlug,
    pathname: `/${portalSlug}/programs`,
  });

  if (!request) {
    notFound();
  }

  redirect(`/${request.portal.slug}/screening-programs`);
}
