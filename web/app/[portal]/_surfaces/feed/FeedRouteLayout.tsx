import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import { PortalSurfaceChrome } from "../shared/PortalSurfaceChrome";
import { FeedLayoutChrome } from "./FeedLayoutChrome";

export const revalidate = 300;

export default async function FeedRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ portal: string }>;
}) {
  const { portal: slug } = await params;
  const headersList = await headers();
  const request = await resolvePortalRequest({ slug, headersList, surface: "feed" });

  if (!request) {
    notFound();
  }

  return (
    <PortalSurfaceChrome surface="feed" request={request}>
      {children}
      <FeedLayoutChrome request={request} />
    </PortalSurfaceChrome>
  );
}
