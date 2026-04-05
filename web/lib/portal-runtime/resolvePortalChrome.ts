import type { PortalChromePolicy, PortalResolvedRequest, PortalSurface } from "./types";
import { resolvePortalRuntimePolicy } from "./resolvePortalRuntimePolicy";

interface ResolvePortalChromeArgs {
  surface: PortalSurface;
  request: PortalResolvedRequest;
}

export function resolvePortalChrome({
  surface,
  request,
}: ResolvePortalChromeArgs): PortalChromePolicy {
  const runtimePolicy =
    request.surface === surface
      ? request.runtimePolicy
      : resolvePortalRuntimePolicy({ surface, request });

  return {
    showHeader: runtimePolicy.requiresSharedChrome,
    showFooter: runtimePolicy.requiresSharedChrome,
    showTracker: runtimePolicy.showTracker,
    showCannyWidget: runtimePolicy.showCannyWidget,
  };
}
