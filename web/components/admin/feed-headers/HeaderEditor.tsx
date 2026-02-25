"use client";

/**
 * HeaderEditor — Form fields for headline, subtitle, image, accent color.
 * Template variable buttons insert into headline at cursor.
 */

import ImagePicker from "./ImagePicker";
import LayoutPicker from "./LayoutPicker";
import TextTreatmentPicker from "./TextTreatmentPicker";
import {
  TEMPLATE_VARS,
  ACCENT_SWATCHES,
  type HeaderFormData,
} from "@/lib/admin/feed-header-utils";
import type { LayoutVariant, TextTreatment } from "@/lib/city-pulse/types";

interface HeaderEditorProps {
  formData: HeaderFormData;
  onChange: (update: Partial<HeaderFormData>) => void;
  onSave: () => void;
  onRevert: () => void;
  saving: boolean;
  isDirty: boolean;
  /** Current time slot from the grid cell, for image filtering */
  activeSlot?: string;
}

export default function HeaderEditor({
  formData,
  onChange,
  onSave,
  onRevert,
  saving,
  isDirty,
  activeSlot,
}: HeaderEditorProps) {
  return (
    <div className="space-y-4">
      {/* Headline */}
      <div className="space-y-1">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
          Headline
        </span>
        <textarea
          value={formData.headline}
          onChange={(e) => onChange({ headline: e.target.value })}
          rows={2}
          placeholder="Hey {{display_name}}, happy Friday"
          className="w-full px-3 py-2 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] resize-none focus:ring-1 focus:ring-[var(--coral)] focus:border-[var(--coral)] transition-colors"
        />
        <div className="flex flex-wrap gap-1">
          {TEMPLATE_VARS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() =>
                onChange({ headline: formData.headline + v })
              }
              className="px-1.5 py-0.5 font-mono text-2xs rounded bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Subtitle */}
      <div className="space-y-1">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
          Subtitle
        </span>
        <input
          type="text"
          value={formData.subtitle}
          onChange={(e) => onChange({ subtitle: e.target.value })}
          placeholder="Optional subtitle..."
          className="w-full px-3 py-2 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-sm text-[var(--cream)] focus:ring-1 focus:ring-[var(--coral)] focus:border-[var(--coral)] transition-colors"
        />
      </div>

      {/* Layout + Text treatment — side by side */}
      <div className="grid grid-cols-2 gap-3">
        <LayoutPicker
          value={formData.layout_variant}
          onChange={(v) => onChange({ layout_variant: v })}
        />
        <TextTreatmentPicker
          value={formData.text_treatment}
          onChange={(v) => onChange({ text_treatment: v })}
        />
      </div>

      {/* Image picker */}
      <ImagePicker
        value={formData.hero_image_url}
        onChange={(url) => onChange({ hero_image_url: url })}
        activeSlot={activeSlot}
      />

      {/* Accent color */}
      <div className="space-y-1">
        <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
          Accent Color
        </span>
        <div className="flex items-center gap-1.5">
          {ACCENT_SWATCHES.map((swatch) => {
            const isSelected = formData.accent_color === swatch.value;
            return (
              <button
                key={swatch.value}
                type="button"
                onClick={() => onChange({ accent_color: swatch.value })}
                title={swatch.label}
                className={`
                  w-7 h-7 rounded-full transition-all
                  ${isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--void)] scale-110" : "hover:scale-105"}
                `}
                style={{ backgroundColor: swatch.value }}
              />
            );
          })}
          <input
            type="text"
            value={formData.accent_color}
            onChange={(e) => onChange({ accent_color: e.target.value })}
            placeholder="var(--coral)"
            className="flex-1 px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-2xs text-[var(--cream)] ml-2"
          />
        </div>
      </div>

      {/* Identity (name / slug) */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
            Name
          </span>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="w-full px-2 py-1.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)]"
          />
        </div>
        <div className="space-y-1">
          <span className="font-mono text-2xs uppercase tracking-wider text-[var(--muted)]">
            Slug
          </span>
          <input
            type="text"
            value={formData.slug}
            onChange={(e) => onChange({ slug: e.target.value })}
            className="w-full px-2 py-1.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)]"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={onSave}
          disabled={saving || !formData.name || !formData.slug}
          className="px-4 py-2 bg-[var(--coral)] text-[var(--void)] font-mono text-xs font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {isDirty && (
          <button
            onClick={onRevert}
            className="px-4 py-2 font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            Revert
          </button>
        )}
      </div>
    </div>
  );
}
