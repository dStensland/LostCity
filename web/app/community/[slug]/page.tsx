import { permanentRedirect } from "next/navigation";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";

export default async function CommunityPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  permanentRedirect(`/${DEFAULT_PORTAL_SLUG}/community/${slug}`);
}
