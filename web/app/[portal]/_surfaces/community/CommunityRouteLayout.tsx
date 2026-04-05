import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import { CommunitySurface } from "./CommunitySurface";

export const revalidate = 180;

export default async function CommunityRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ portal: string }>;
}) {
  const { portal: slug } = await params;
  const headersList = await headers();
  const request = await resolvePortalRequest({ slug, headersList, surface: "community" });

  if (!request) {
    notFound();
  }

  return <CommunitySurface request={request}>{children}</CommunitySurface>;
}
