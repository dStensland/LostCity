import { permanentRedirect } from "next/navigation";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";

export default async function SpotPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  permanentRedirect(`/${DEFAULT_PORTAL_SLUG}/spots/${slug}`);
}
