import { permanentRedirect } from "next/navigation";

export default async function FestivalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/atlanta/festivals/${slug}`);
}
