import { permanentRedirect } from "next/navigation";

export default async function CommunityPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  permanentRedirect(`/atlanta/community/${slug}`);
}
