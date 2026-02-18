"use client";
/* eslint-disable @next/next/no-img-element */

import type { SignatureVenue, ForthAmenity } from "@/lib/concierge/concierge-types";
import HotelSection from "../../hotel/HotelSection";
import HotelCarousel from "../../hotel/HotelCarousel";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface PropertyPreviewProps {
  signatureVenues: SignatureVenue[];
  amenities: ForthAmenity[];
  portalName: string;
}

export default function PropertyPreview({ signatureVenues, amenities, portalName }: PropertyPreviewProps) {
  return (
    <HotelSection
      id="property"
      title={`At ${portalName}`}
      subtitle="Signature dining, bars, and hotel amenities"
    >
      {/* Signature Venues */}
      <HotelCarousel>
        {signatureVenues.map((venue) => {
          const imgSrc = getProxiedImageSrc(venue.photoUrl);
          return (
            <div key={venue.id} className="snap-start shrink-0 w-[260px] md:w-[280px]">
              <div className="rounded-xl overflow-hidden bg-[var(--hotel-cream)] border border-[var(--hotel-sand)] shadow-[var(--hotel-shadow-soft)] hover:shadow-[var(--hotel-shadow-medium)] transition-shadow duration-500">
                <div className="relative aspect-[4/3] bg-[var(--hotel-sand)] overflow-hidden">
                  <img
                    src={typeof imgSrc === "string" ? imgSrc : venue.photoUrl}
                    alt={venue.name}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div className="absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/90">
                    {venue.typeLabel}
                  </div>
                </div>
                <div className="p-4 space-y-1">
                  <h3 className="font-display text-lg text-[var(--hotel-charcoal)]">{venue.name}</h3>
                  <p className="text-sm font-body text-[var(--hotel-stone)] line-clamp-2">{venue.spotlight}</p>
                  {venue.mockSpecial && (
                    <p className="text-xs uppercase tracking-[0.12em] text-[var(--hotel-champagne)]">
                      {venue.mockSpecial}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </HotelCarousel>

      {/* Amenities */}
      {amenities.length > 0 && (
        <div className="mt-8">
          <h3 className="font-body text-xs uppercase tracking-[0.2em] text-[var(--hotel-stone)] mb-4">Hotel Amenities</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {amenities.map((amenity) => {
              const aSrc = getProxiedImageSrc(amenity.photoUrl);
              return (
                <div key={amenity.id} className="rounded-xl overflow-hidden bg-[var(--hotel-cream)] border border-[var(--hotel-sand)] shadow-[var(--hotel-shadow-soft)]">
                  <div className="relative aspect-[4/3] bg-[var(--hotel-sand)] overflow-hidden">
                    <img
                      src={typeof aSrc === "string" ? aSrc : amenity.photoUrl}
                      alt={amenity.name}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                  <div className="p-3">
                    <h4 className="font-display text-sm text-[var(--hotel-charcoal)]">{amenity.name}</h4>
                    <p className="text-[11px] text-[var(--hotel-stone)] mt-0.5">{amenity.serviceWindow}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </HotelSection>
  );
}
