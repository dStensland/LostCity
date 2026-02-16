"use client";

import type { ServicesPillarData } from "@/lib/concierge/concierge-types";
import PropertyPreview from "../sections/PropertyPreview";
import ServiceGrid from "../sections/ServiceGrid";

interface ServicesPillarProps {
  data: ServicesPillarData;
  portalSlug: string;
  portalName: string;
}

export default function ServicesPillar({ data, portalSlug, portalName }: ServicesPillarProps) {
  return (
    <div className="space-y-12">
      <PropertyPreview
        signatureVenues={data.signatureVenues}
        amenities={data.amenities}
        portalSlug={portalSlug}
        portalName={portalName}
      />

      <ServiceGrid
        services={data.inRoomServices}
        conciergePhone={data.conciergePhone}
      />
    </div>
  );
}
