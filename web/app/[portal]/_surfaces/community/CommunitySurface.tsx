import type { PortalResolvedRequest } from "@/lib/portal-runtime/types";
import { CommunityLayoutChrome } from "./CommunityLayoutChrome";
import { PortalSurfaceChrome } from "../shared/PortalSurfaceChrome";

export function CommunitySurface({
  request,
  children,
}: {
  request: PortalResolvedRequest;
  children: React.ReactNode;
}) {
  return (
    <PortalSurfaceChrome surface="community" request={request}>
      {children}
      <CommunityLayoutChrome request={request} />
    </PortalSurfaceChrome>
  );
}
