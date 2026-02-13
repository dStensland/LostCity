import { permanentRedirect } from "next/navigation";

export default async function SeriesPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  permanentRedirect(`/atlanta/series/${slug}`);
}
