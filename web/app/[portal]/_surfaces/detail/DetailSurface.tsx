import { Suspense } from "react";
import DetailOverlayRouter from "./DetailOverlayRouter";
import { DetailPanelSkeleton, type DetailType } from "./DetailLoading";

export function DetailSurface({
  portalSlug,
  detailType,
  feedFallback,
  children,
}: {
  portalSlug: string;
  detailType: DetailType;
  feedFallback: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <DetailPanelSkeleton type={detailType} feedFallback={feedFallback} />
      }
    >
      <DetailOverlayRouter portalSlug={portalSlug}>{children}</DetailOverlayRouter>
    </Suspense>
  );
}
