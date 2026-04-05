import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import { PortalSurfaceChrome } from "../shared/PortalSurfaceChrome";

export const revalidate = 120;

export default async function DetailRouteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ portal: string }>;
}) {
  const { portal: slug } = await params;
  const headersList = await headers();
  const request = await resolvePortalRequest({ slug, headersList, surface: "detail" });

  if (!request) {
    notFound();
  }

  return (
    <PortalSurfaceChrome surface="detail" request={request}>
      {children}
    </PortalSurfaceChrome>
  );
}
