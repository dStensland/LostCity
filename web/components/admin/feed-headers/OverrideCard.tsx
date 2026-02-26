"use client";

/**
 * OverrideCard — Single contextual override (weather/holiday/festival).
 * Shows type badge, headline, image thumb, priority. Expands to inline editor.
 */

import { useState } from "react";
import Image from "next/image";
import type { FeedHeaderRow } from "@/lib/city-pulse/types";
import { getOverrideType, headerToFormData } from "@/lib/admin/feed-header-utils";
import ImagePicker from "./ImagePicker";
import { ACCENT_SWATCHES, TEMPLATE_VARS } from "@/lib/admin/feed-header-utils";

interface OverrideCardProps {
  header: FeedHeaderRow;
  portalId: string;
  onSaved: () => void;
  onDeleted: () => void;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  weather: { bg: "bg-blue-500/20", text: "text-blue-300", label: "Weather" },
  holiday: { bg: "bg-purple-500/20", text: "text-purple-300", label: "Holiday" },
  festival: { bg: "bg-amber-500/20", text: "text-amber-300", label: "Festival" },
  unknown: { bg: "bg-[var(--twilight)]", text: "text-[var(--muted)]", label: "Override" },
};

export default function OverrideCard({
  header,
  portalId,
  onSaved,
  onDeleted,
}: OverrideCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => headerToFormData(header));

  const type = getOverrideType(header);
  const style = TYPE_STYLES[type];
  const conditionLabel =
    type === "weather"
      ? header.conditions.weather_signals?.join(", ")
      : type === "holiday"
      ? header.conditions.holidays?.join(", ")
      : "Active festival";

  async function handleSave() {
    setSaving(true);
    try {
      const cta =
        form.cta_label && form.cta_href
          ? { label: form.cta_label, href: form.cta_href, style: form.cta_style }
          : null;
      const res = await fetch(
        `/api/admin/portals/${portalId}/feed-headers/${header.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            headline: form.headline || null,
            subtitle: form.subtitle || null,
            hero_image_url: form.hero_image_url || null,
            accent_color: form.accent_color || null,
            cta,
          }),
        }
      );
      if (!res.ok) throw new Error("Save failed");
      onSaved();
      setExpanded(false);
    } catch {
      // Error handled silently — UI stays open
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this override?")) return;
    try {
      const res = await fetch(
        `/api/admin/portals/${portalId}/feed-headers/${header.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
      onDeleted();
    } catch {
      // Error handled silently
    }
  }

  return (
    <div className="rounded-lg border border-[var(--twilight)] bg-[var(--card-bg)] overflow-hidden">
      {/* Summary row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--twilight)]/30 transition-colors"
      >
        {/* Type badge */}
        <span
          className={`px-1.5 py-0.5 rounded font-mono text-2xs ${style.bg} ${style.text}`}
        >
          {style.label}
        </span>

        {/* Condition */}
        <span className="font-mono text-2xs text-[var(--soft)] flex-1 truncate">
          {conditionLabel}
        </span>

        {/* Headline preview */}
        {header.headline && (
          <span className="font-mono text-2xs text-[var(--muted)] truncate max-w-[120px]">
            {header.headline.slice(0, 25)}
          </span>
        )}

        {/* Image thumb */}
        {header.hero_image_url && (
          <div className="relative w-8 h-5 rounded overflow-hidden shrink-0">
            <Image
              src={header.hero_image_url}
              alt=""
              fill
              className="object-cover"
              sizes="32px"
            />
          </div>
        )}

        {/* Priority */}
        <span className="font-mono text-2xs text-[var(--muted)]">
          p{header.priority}
        </span>

        {/* Expand indicator */}
        <span className="text-[var(--muted)] text-xs">{expanded ? "−" : "+"}</span>
      </button>

      {/* Expanded inline editor */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-[var(--twilight)] pt-3 space-y-3">
          {/* Headline */}
          <div className="space-y-1">
            <span className="font-mono text-2xs text-[var(--muted)]">
              Headline Override
            </span>
            <textarea
              value={form.headline}
              onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
              rows={2}
              className="w-full px-2 py-1.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-xs text-[var(--cream)] resize-none"
            />
            <div className="flex flex-wrap gap-1">
              {TEMPLATE_VARS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, headline: f.headline + v }))}
                  className="px-1 py-0.5 font-mono text-2xs rounded bg-[var(--twilight)] text-[var(--muted)] hover:text-[var(--cream)]"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Image */}
          <ImagePicker
            value={form.hero_image_url}
            onChange={(url) => setForm((f) => ({ ...f, hero_image_url: url }))}
          />

          {/* Accent color */}
          <div className="space-y-1">
            <span className="font-mono text-2xs text-[var(--muted)]">
              Accent Override
            </span>
            <div className="flex items-center gap-1">
              {ACCENT_SWATCHES.slice(0, 5).map((swatch) => (
                <button
                  key={swatch.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, accent_color: swatch.value }))}
                  className={`w-5 h-5 rounded-full ${
                    form.accent_color === swatch.value
                      ? "ring-2 ring-white ring-offset-1 ring-offset-[var(--void)]"
                      : ""
                  }`}
                  style={{ backgroundColor: swatch.value }}
                />
              ))}
              <input
                type="text"
                value={form.accent_color}
                onChange={(e) => setForm((f) => ({ ...f, accent_color: e.target.value }))}
                placeholder="var(--coral)"
                className="flex-1 px-1.5 py-0.5 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-2xs text-[var(--cream)] ml-1"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] font-mono text-2xs rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Override"}
            </button>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 font-mono text-2xs text-red-400 hover:text-red-300"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
