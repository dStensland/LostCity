"use client";

/**
 * Feed Header Command Center
 *
 * Visual editorial tool for managing contextual feed headers.
 * Day × slot grid → editor + city context → live preview → detail fields → overrides.
 */

import { useState, useEffect, use, useCallback } from "react";
import type { FeedHeaderRow } from "@/lib/city-pulse/types";
import {
  EMPTY_FORM,
  headerToFormData,
  formDataToPayload,
  findHeaderForCell,
  findOverridesForCell,
  autoSlug,
  type HeaderFormData,
} from "@/lib/admin/feed-header-utils";
import { usePortalEdit } from "@/lib/admin/portal-edit-context";
import DaySlotGrid from "@/components/admin/feed-headers/DaySlotGrid";
import ContextPanel from "@/components/admin/feed-headers/ContextPanel";
import HeaderEditor from "@/components/admin/feed-headers/HeaderEditor";
import LivePreview from "@/components/admin/feed-headers/LivePreview";
import DetailFieldsets from "@/components/admin/feed-headers/DetailFieldsets";
import ContextualOverrides from "@/components/admin/feed-headers/ContextualOverrides";

export default function FeedHeadersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { portal } = usePortalEdit();
  const portalSlug = portal?.slug || "atlanta";

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const [headers, setHeaders] = useState<FeedHeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHeaders = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/portals/${id}/feed-headers`);
      if (!res.ok) throw new Error("Failed to load feed headers");
      const data = await res.json();
      setHeaders(data.headers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchHeaders();
  }, [fetchHeaders]);

  // ---------------------------------------------------------------------------
  // Selection state
  // ---------------------------------------------------------------------------

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState<HeaderFormData>({ ...EMPTY_FORM });
  const [originalForm, setOriginalForm] = useState<HeaderFormData>({
    ...EMPTY_FORM,
  });
  const [editingHeader, setEditingHeader] = useState<FeedHeaderRow | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  function handleCellSelect(day: string, slot: string) {
    setSelectedDay(day);
    setSelectedSlot(slot);

    const header = findHeaderForCell(headers, day, slot);
    setEditingHeader(header);

    if (header) {
      const fd = headerToFormData(header);
      setFormData(fd);
      setOriginalForm(fd);
    } else {
      // Pre-fill for new header at this cell
      const name = `${day}-${slot}`;
      const newForm: HeaderFormData = {
        ...EMPTY_FORM,
        name,
        slug: autoSlug(name),
        priority: 10,
        show_on_days: [day],
        conditions: { time_slots: [slot] },
      };
      setFormData(newForm);
      setOriginalForm(newForm);
    }
  }

  // ---------------------------------------------------------------------------
  // Form operations
  // ---------------------------------------------------------------------------

  function handleFormChange(update: Partial<HeaderFormData>) {
    setFormData((f) => ({ ...f, ...update }));
  }

  function handleRevert() {
    setFormData({ ...originalForm });
  }

  const isDirty = JSON.stringify(formData) !== JSON.stringify(originalForm);

  async function handleSave() {
    if (!selectedDay || !selectedSlot) return;
    setSaving(true);

    try {
      const payload = formDataToPayload(formData);
      const url = editingHeader
        ? `/api/admin/portals/${id}/feed-headers/${editingHeader.id}`
        : `/api/admin/portals/${id}/feed-headers`;

      const res = await fetch(url, {
        method: editingHeader ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save");
      }

      await fetchHeaders();
      // Re-select the cell to update form state from refreshed data
      const refreshedHeaders = await fetch(
        `/api/admin/portals/${id}/feed-headers`
      )
        .then((r) => r.json())
        .then((d) => (d.headers || []) as FeedHeaderRow[]);
      setHeaders(refreshedHeaders);

      const updatedHeader = findHeaderForCell(
        refreshedHeaders,
        selectedDay,
        selectedSlot
      );
      if (updatedHeader) {
        const fd = headerToFormData(updatedHeader);
        setFormData(fd);
        setOriginalForm(fd);
        setEditingHeader(updatedHeader);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Overrides for selected cell
  // ---------------------------------------------------------------------------

  const overrides =
    selectedDay && selectedSlot
      ? findOverridesForCell(headers, selectedDay, selectedSlot)
      : [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-400 py-16 font-mono text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-[var(--cream)]">
          Feed Headers
        </h2>
        <p className="font-mono text-xs text-[var(--muted)] mt-1">
          Click a cell to edit its header. Filled = CMS override, dashed =
          algorithm default.
        </p>
      </div>

      {/* Day × Slot grid */}
      <DaySlotGrid
        headers={headers}
        selectedDay={selectedDay}
        selectedSlot={selectedSlot}
        onSelect={handleCellSelect}
      />

      {/* Selected cell editor */}
      {selectedDay && selectedSlot && (
        <div className="space-y-6">
          {/* Editor + Context side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-4">
            {/* Editor */}
            <div className="rounded-xl border border-[var(--twilight)] bg-[var(--card-bg)] p-4">
              <HeaderEditor
                formData={formData}
                onChange={handleFormChange}
                onSave={handleSave}
                onRevert={handleRevert}
                saving={saving}
                isDirty={isDirty}
                activeSlot={selectedSlot || undefined}
              />
            </div>

            {/* Context panel */}
            <ContextPanel
              portalSlug={portalSlug}
              day={selectedDay}
              slot={selectedSlot}
            />
          </div>

          {/* Live preview */}
          <LivePreview
            formData={formData}
            day={selectedDay}
            slot={selectedSlot}
            portalSlug={portalSlug}
          />

          {/* Detail fieldsets */}
          <DetailFieldsets formData={formData} onChange={handleFormChange} />

          {/* Contextual overrides */}
          <ContextualOverrides
            overrides={overrides}
            day={selectedDay}
            slot={selectedSlot}
            portalId={id}
            onRefresh={fetchHeaders}
          />
        </div>
      )}
    </div>
  );
}
