"use client";

import type { ServicesPillarData } from "@/lib/concierge/concierge-types";
import PropertyPreview from "../sections/PropertyPreview";
import ServiceGrid from "../sections/ServiceGrid";

interface ServicesPillarProps {
  data: ServicesPillarData;
  portalName: string;
}

export default function ServicesPillar({ data, portalName }: ServicesPillarProps) {
  return (
    <div className="space-y-12">
      <PropertyPreview
        signatureVenues={data.signatureVenues}
        amenities={data.amenities}
        portalName={portalName}
      />

      <ServiceGrid
        services={data.inRoomServices}
        conciergePhone={data.conciergePhone}
      />
    </div>
  );
}
