"use client";

import { useState, useRef, useCallback, use } from "react";
import { usePortal } from "@/lib/portal-context";
import { QRCodeCanvas } from "qrcode.react";

const SIZES = [
  { label: "Small (256px)", value: 256 },
  { label: "Medium (512px)", value: 512 },
  { label: "Large (1024px)", value: 1024 },
] as const;

const PLACEMENTS = [
  { label: "Room Card", value: "room_card" },
  { label: "Lobby Display", value: "lobby" },
  { label: "Elevator", value: "elevator" },
  { label: "Tent Card", value: "tent_card" },
  { label: "Front Desk", value: "front_desk" },
] as const;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://lostcity.ai").replace(/\/$/, "");

export default function QRCodePage({ params }: { params: Promise<{ portal: string }> }) {
  const { portal: slug } = use(params);
  const { portal } = usePortal();

  const [size, setSize] = useState(512);
  const [placement, setPlacement] = useState("room_card");
  const canvasRef = useRef<HTMLDivElement>(null);

  const portalUrl = `${SITE_URL}/${slug}?utm_source=${placement}&utm_medium=qr&utm_campaign=hotel_concierge`;

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;

    // Create a new canvas with padding and text
    const exportCanvas = document.createElement("canvas");
    const padding = 40;
    const textHeight = 60;
    exportCanvas.width = size + padding * 2;
    exportCanvas.height = size + padding * 2 + textHeight;

    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // White background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Draw QR code
    ctx.drawImage(canvas, padding, padding, size, size);

    // Draw portal name below
    ctx.fillStyle = "#1a1a1a";
    ctx.font = `bold ${Math.max(16, size / 20)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(portal.name, exportCanvas.width / 2, size + padding + textHeight / 2 + 8);

    // Export
    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-qr-${placement}-${size}px.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [size, placement, slug, portal.name]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--cream)] mb-1">
          QR Codes
        </h1>
        <p className="font-mono text-sm text-[var(--muted)]">
          Generate QR codes for guests to access your portal
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Controls */}
        <div className="space-y-6">
          {/* Placement selector */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
              Placement
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PLACEMENTS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPlacement(p.value)}
                  className={`px-3 py-2 rounded-lg font-mono text-xs transition-colors ${
                    placement === p.value
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size selector */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
              Size
            </label>
            <div className="flex gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSize(s.value)}
                  className={`px-3 py-2 rounded-lg font-mono text-xs transition-colors ${
                    size === s.value
                      ? "bg-[var(--coral)] text-[var(--void)]"
                      : "bg-[var(--dusk)] text-[var(--muted)] hover:text-[var(--cream)] border border-[var(--twilight)]"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* URL preview */}
          <div>
            <label className="block font-mono text-xs text-[var(--muted)] uppercase mb-2">
              QR Target URL
            </label>
            <div className="p-3 bg-[var(--night)] border border-[var(--twilight)] rounded-lg">
              <code className="font-mono text-xs text-[var(--cream)] break-all">
                {portalUrl}
              </code>
            </div>
          </div>

          {/* Download button */}
          <button
            onClick={handleDownload}
            className="w-full px-4 py-3 bg-[var(--coral)] text-[var(--void)] font-mono text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Download PNG
          </button>

          {/* Usage tips */}
          <div className="p-4 bg-[var(--night)] border border-[var(--twilight)] rounded-lg">
            <h3 className="font-mono text-sm text-[var(--coral)] mb-2">Placement Tips</h3>
            <ul className="font-mono text-xs text-[var(--muted)] space-y-1">
              <li>Room cards: 256px is sufficient for close-range scanning</li>
              <li>Lobby displays: Use 512px or 1024px for distance scanning</li>
              <li>Each placement gets tracked separately in analytics</li>
            </ul>
          </div>
        </div>

        {/* QR Preview */}
        <div className="flex flex-col items-center gap-4">
          <div
            ref={canvasRef}
            className="p-8 bg-white rounded-xl shadow-lg"
          >
            <QRCodeCanvas
              value={portalUrl}
              size={Math.min(size, 400)}
              level="M"
              marginSize={2}
            />
          </div>
          <p className="font-mono text-xs text-[var(--muted)]">
            Preview ({Math.min(size, 400)}px) &middot; Download will be {size}px
          </p>
        </div>
      </div>
    </div>
  );
}
