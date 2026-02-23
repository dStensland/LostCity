"use client";

/**
 * ImagePicker — Thumbnail grid for selecting hero images.
 * Groups images by time slot with collapsible sections.
 * Optionally filters to show relevant slot first based on context.
 */

import { useState, useMemo } from "react";
import Image from "next/image";
import { PORTAL_IMAGES, IMAGE_SLOT_GROUPS, type TimeSlotTag } from "@/lib/admin/feed-header-utils";

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  /** Current time slot from the grid cell — highlights the relevant group */
  activeSlot?: string;
}

export default function ImagePicker({ value, onChange, activeSlot }: ImagePickerProps) {
  const [expandedSlot, setExpandedSlot] = useState<TimeSlotTag | null>(
    (activeSlot as TimeSlotTag) || null,
  );

  // Group images by slot
  const grouped = useMemo(() => {
    const map = new Map<TimeSlotTag, typeof PORTAL_IMAGES>();
    for (const group of IMAGE_SLOT_GROUPS) {
      map.set(group.slot, []);
    }
    for (const img of PORTAL_IMAGES) {
      const arr = map.get(img.slot);
      if (arr) arr.push(img);
    }
    return map;
  }, []);

  // Check if current value is a known image
  const selectedImage = PORTAL_IMAGES.find((img) => img.path === value);

  return (
    <div className="space-y-2">
      <span className="font-mono text-[0.5625rem] uppercase tracking-wider text-[var(--muted)]">
        Hero Image
      </span>

      {/* Current selection preview */}
      {value && (
        <div className="relative rounded-lg overflow-hidden aspect-[16/7] border border-[var(--twilight)]">
          <Image
            src={value}
            alt={selectedImage?.label || "Selected hero image"}
            fill
            className="object-cover"
            sizes="320px"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
            <span className="font-mono text-[0.5625rem] text-white/80">
              {selectedImage?.label || "Custom image"}
              {selectedImage?.credit && (
                <span className="text-white/40 ml-1.5">{selectedImage.credit}</span>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Grouped image sections */}
      <div className="space-y-1">
        {IMAGE_SLOT_GROUPS.map((group) => {
          const images = grouped.get(group.slot) || [];
          if (images.length === 0) return null;

          const isExpanded = expandedSlot === group.slot;
          const hasSelected = images.some((img) => img.path === value);
          const isRelevant = activeSlot === group.slot;

          return (
            <div key={group.slot}>
              <button
                type="button"
                onClick={() => setExpandedSlot(isExpanded ? null : group.slot)}
                className={`
                  w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors
                  ${isExpanded ? "bg-[var(--twilight)]/50" : "hover:bg-[var(--twilight)]/30"}
                `}
              >
                <span className="flex items-center gap-2">
                  <span className={`font-mono text-[0.5625rem] uppercase tracking-wider ${isRelevant ? "text-[var(--coral)]" : "text-[var(--soft)]"}`}>
                    {group.label}
                  </span>
                  <span className="font-mono text-[0.5rem] text-[var(--muted)]">
                    {images.length}
                  </span>
                  {hasSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--coral)]" />
                  )}
                </span>
                <svg
                  className={`w-3 h-3 text-[var(--muted)] transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5}
                >
                  <path d="M3 4.5L6 7.5L9 4.5" />
                </svg>
              </button>

              {isExpanded && (
                <div className="grid grid-cols-4 gap-1.5 px-1 py-1.5">
                  {images.map((img) => {
                    const isSelected = value === img.path;
                    return (
                      <button
                        key={img.path}
                        type="button"
                        onClick={() => onChange(img.path)}
                        className={`
                          relative rounded-lg overflow-hidden aspect-[3/2] transition-all
                          ${
                            isSelected
                              ? "ring-2 ring-[var(--coral)] ring-offset-1 ring-offset-[var(--void)]"
                              : "opacity-70 hover:opacity-100"
                          }
                        `}
                      >
                        <Image
                          src={img.path}
                          alt={img.label}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5">
                          <span className="font-mono text-[0.4375rem] text-white/80 leading-none">
                            {img.label}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom URL */}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://... or /portals/atlanta/custom.jpg"
        className="w-full px-2 py-1.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)]"
      />
    </div>
  );
}
