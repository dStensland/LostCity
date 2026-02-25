"use client";
/* eslint-disable @next/next/no-img-element */

/**
 * HotelQRCode - Simple QR code display for in-room tablets
 *
 * Renders a QR code that links to the portal URL, styled for the hotel theme.
 * Uses a free QR code API to generate the image (no npm dependencies needed).
 *
 * Usage:
 * <HotelQRCode url="https://lost.city/forth" label="Scan to explore Atlanta" />
 */

interface HotelQRCodeProps {
  url: string;
  label?: string;
  size?: number;
}

export default function HotelQRCode({
  url,
  label = "Scan to explore",
  size = 200
}: HotelQRCodeProps) {
  // Generate QR code via free API (no server/client needed)
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&format=png&margin=10`;

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-[var(--hotel-cream)] rounded-xl border border-[var(--hotel-sand)] shadow-sm">
      <div className="bg-white p-4 rounded-lg shadow-md mb-4">
        <img
          src={qrCodeUrl}
          alt={`QR code for ${url}`}
          width={size}
          height={size}
          className="block"
        />
      </div>
      {label && (
        <p className="font-body text-sm text-[var(--hotel-stone)] text-center">
          {label}
        </p>
      )}
    </div>
  );
}
