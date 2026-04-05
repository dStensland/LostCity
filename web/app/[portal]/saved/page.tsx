import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isDogPortal } from "@/lib/dog-art";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import DogDeepPageShell from "../_components/dog/DogDeepPageShell";
import DogSavedView from "../_components/dog/DogSavedView";

type Props = {
  params: Promise<{ portal: string }>;
};

export const revalidate = 180;

export default async function DogSavedPage({ params }: Props) {
  const { portal: portalSlug } = await params;
  const headersList = await headers();
  const request = await resolvePortalRequest({
    slug: portalSlug,
    headersList,
    pathname: `/${portalSlug}/saved`,
    surface: "community",
  });
  if (!request) notFound();
  if (!request.isDog && !isDogPortal(request.portal.slug)) notFound();

  return (
    <DogDeepPageShell portalSlug={request.portal.slug} pageTitle="Saved">
      <DogSavedView portalSlug={request.portal.slug} />
    </DogDeepPageShell>
  );
}
