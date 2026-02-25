"use client";

/**
 * ContextualOverrides — Groups override headers by type (weather/holiday/festival).
 * Shows OverrideCards and a create flow for new overrides.
 */

import { useState } from "react";
import type { FeedHeaderRow } from "@/lib/city-pulse/types";
import {
  getOverrideType,
  autoSlug,
  WEATHER_SIGNALS,
  HOLIDAYS,
} from "@/lib/admin/feed-header-utils";
import OverrideCard from "./OverrideCard";

interface ContextualOverridesProps {
  overrides: FeedHeaderRow[];
  day: string;
  slot: string;
  portalId: string;
  onRefresh: () => void;
}

type NewOverrideType = "weather" | "holiday" | "festival";

export default function ContextualOverrides({
  overrides,
  day,
  slot,
  portalId,
  onRefresh,
}: ContextualOverridesProps) {
  const [creating, setCreating] = useState(false);
  const [newType, setNewType] = useState<NewOverrideType>("weather");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Group by type
  const weatherOverrides = overrides.filter((h) => getOverrideType(h) === "weather");
  const holidayOverrides = overrides.filter((h) => getOverrideType(h) === "holiday");
  const festivalOverrides = overrides.filter((h) => getOverrideType(h) === "festival");

  async function handleCreate() {
    if (!newValue && newType !== "festival") return;
    setSaving(true);

    const conditions: Record<string, unknown> = {
      time_slots: [slot],
    };
    let name = "";
    let slug = "";

    if (newType === "weather") {
      conditions.weather_signals = [newValue];
      name = `${day}-${slot}-${newValue}`;
      slug = autoSlug(name);
    } else if (newType === "holiday") {
      conditions.holidays = [newValue];
      name = `${day}-${slot}-${newValue}`;
      slug = autoSlug(name);
    } else {
      conditions.festivals = true;
      name = `${day}-${slot}-festival`;
      slug = autoSlug(name);
    }

    try {
      const res = await fetch(`/api/admin/portals/${portalId}/feed-headers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          is_active: true,
          priority: 5,
          show_on_days: [day],
          conditions,
        }),
      });
      if (!res.ok) throw new Error("Failed to create override");
      setCreating(false);
      setNewValue("");
      onRefresh();
    } catch {
      // Keep form open on error
    } finally {
      setSaving(false);
    }
  }

  const hasOverrides = overrides.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs uppercase tracking-wider text-[var(--muted)]">
          Contextual Overrides
        </h3>
        <button
          onClick={() => setCreating(!creating)}
          className="font-mono text-[0.625rem] text-[var(--coral)] hover:opacity-80"
        >
          {creating ? "Cancel" : "+ New Override"}
        </button>
      </div>

      {/* Create flow */}
      {creating && (
        <div className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral)]/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={newType}
              onChange={(e) => {
                setNewType(e.target.value as NewOverrideType);
                setNewValue("");
              }}
              className="px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
            >
              <option value="weather">Weather</option>
              <option value="holiday">Holiday</option>
              <option value="festival">Festival</option>
            </select>

            {newType === "weather" && (
              <select
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="flex-1 px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
              >
                <option value="">Select condition...</option>
                {WEATHER_SIGNALS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            )}

            {newType === "holiday" && (
              <select
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="flex-1 px-2 py-1 bg-[var(--void)] border border-[var(--twilight)] rounded font-mono text-[0.625rem] text-[var(--cream)]"
              >
                <option value="">Select holiday...</option>
                {HOLIDAYS.map((h) => (
                  <option key={h} value={h}>
                    {h.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            )}

            {newType === "festival" && (
              <span className="font-mono text-[0.625rem] text-[var(--muted)] flex-1">
                Triggers when any festival is active
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={saving || (!newValue && newType !== "festival")}
              className="px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] font-mono text-[0.625rem] rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Override"}
            </button>
            <span className="font-mono text-[0.5rem] text-[var(--muted)]">
              Priority 5 (beats base at 10)
            </span>
          </div>
        </div>
      )}

      {/* Override cards by type */}
      {!hasOverrides && !creating && (
        <p className="font-mono text-[0.625rem] text-[var(--muted)] italic py-2">
          No overrides for this cell. Overrides let you customize the header for
          weather, holidays, or festivals.
        </p>
      )}

      {weatherOverrides.length > 0 && (
        <div className="space-y-1.5">
          <span className="font-mono text-[0.5625rem] text-blue-300/70 uppercase tracking-wider">
            Weather
          </span>
          {weatherOverrides.map((h) => (
            <OverrideCard
              key={h.id}
              header={h}
              portalId={portalId}
              onSaved={onRefresh}
              onDeleted={onRefresh}
            />
          ))}
        </div>
      )}

      {holidayOverrides.length > 0 && (
        <div className="space-y-1.5">
          <span className="font-mono text-[0.5625rem] text-purple-300/70 uppercase tracking-wider">
            Holidays
          </span>
          {holidayOverrides.map((h) => (
            <OverrideCard
              key={h.id}
              header={h}
              portalId={portalId}
              onSaved={onRefresh}
              onDeleted={onRefresh}
            />
          ))}
        </div>
      )}

      {festivalOverrides.length > 0 && (
        <div className="space-y-1.5">
          <span className="font-mono text-[0.5625rem] text-amber-300/70 uppercase tracking-wider">
            Festivals
          </span>
          {festivalOverrides.map((h) => (
            <OverrideCard
              key={h.id}
              header={h}
              portalId={portalId}
              onSaved={onRefresh}
              onDeleted={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}
