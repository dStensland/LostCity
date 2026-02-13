import { permanentRedirect } from "next/navigation";

export default async function SpotPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  permanentRedirect(`/atlanta/spots/${slug}`);
}
