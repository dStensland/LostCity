import { notFound, redirect } from "next/navigation";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";

type Props = {
  params: Promise<{ portal: string }>;
};

export default async function LegacyProgramsPage({ params }: Props) {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  if (getPortalVertical(portal) !== "film") {
    notFound();
  }

  redirect(`/${portal.slug}/screening-programs`);
}
