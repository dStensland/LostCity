"use client";

import { useState, useCallback } from "react";
import type { Portal } from "@/lib/portal-context";
import { useItinerary } from "@/lib/hooks/useItinerary";
import type { AddItineraryItemInput, Itinerary, LocalItinerary, ItineraryItem, LocalItineraryItem } from "@/lib/itinerary-utils";
import ItineraryTimeline from "./ItineraryTimeline";
import ItineraryAddDrawer from "./ItineraryAddDrawer";
import ItineraryShareModal from "./ItineraryShareModal";

interface ItineraryBuilderProps {
  portal: Portal;
  initialDate?: string;
}

export default function ItineraryBuilder({
  portal,
  initialDate,
}: ItineraryBuilderProps) {
  const {
    itineraries,
    activeItinerary,
    loading,
    saving,
    createItinerary,
    loadItinerary,
    updateItinerary,
    deleteItinerary,
    addItem,
    removeItem,
    getShareUrl,
  } = useItinerary(portal.id, portal.slug);

  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  const handleCreate = useCallback(async () => {
    await createItinerary(portal.id, "My Itinerary", initialDate);
  }, [portal.id, initialDate, createItinerary]);

  const handleAddItem = useCallback(
    (input: AddItineraryItemInput) => {
      addItem(input);
    },
    [addItem]
  );

  const handleShare = useCallback(async () => {
    if (activeItinerary && !(activeItinerary as Itinerary).is_public) {
      await updateItinerary({ is_public: true });
    }
    setShowShareModal(true);
  }, [activeItinerary, updateItinerary]);

  const handleSaveTitle = useCallback(async () => {
    if (titleInput.trim()) {
      await updateItinerary({ title: titleInput.trim() });
    }
    setEditingTitle(false);
  }, [titleInput, updateItinerary]);

  const items = activeItinerary
    ? "items" in activeItinerary
      ? (activeItinerary as (Itinerary & { items: ItineraryItem[] }) | LocalItinerary).items || []
      : []
    : [];

  const shareUrl = getShareUrl();

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="w-6 h-6 mx-auto border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  // No active itinerary — show list or create
  if (!activeItinerary) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Your Itineraries</h3>
          <button
            onClick={handleCreate}
            className="px-4 py-2 rounded-lg bg-[var(--accent,#f97316)] text-white text-sm font-medium hover:brightness-110 transition-all"
          >
            New Itinerary
          </button>
        </div>

        {(itineraries as (Itinerary | LocalItinerary)[]).length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-white/8 bg-white/3">
            <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-sm text-white/50 mb-1">No itineraries yet</p>
            <p className="text-xs text-white/30">
              Build an evening plan with events, dining, and custom stops
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(itineraries as (Itinerary | LocalItinerary)[]).map((itin) => (
              <button
                key={itin.id}
                onClick={() => loadItinerary(itin.id)}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium text-white">{itin.title}</p>
                  <p className="text-xs text-white/40">
                    {itin.date || "No date set"}
                    {" items" in itin && Array.isArray((itin as LocalItinerary).items)
                      ? ` \u2022 ${(itin as LocalItinerary).items.length} stops`
                      : ""}
                  </p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Active itinerary — show builder
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20"
                autoFocus
              />
              <button
                onClick={handleSaveTitle}
                className="text-xs text-[var(--accent,#f97316)]"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setTitleInput(activeItinerary.title);
                setEditingTitle(true);
              }}
              className="text-lg font-bold text-white hover:text-white/80 transition-colors text-left"
            >
              {activeItinerary.title}
            </button>
          )}
          {activeItinerary.date && (
            <p className="text-xs text-white/40 mt-0.5">
              {activeItinerary.date}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {shareUrl && (
            <button
              onClick={handleShare}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
              title="Share"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          )}
          <button
            onClick={() => {
              deleteItinerary(activeItinerary.id);
            }}
            className="p-2 rounded-lg bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline */}
      <ItineraryTimeline
        items={items as (ItineraryItem | LocalItineraryItem)[]}
        onRemoveItem={removeItem}
      />

      {/* Add button */}
      <button
        onClick={() => setShowAddDrawer(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-white/10 text-sm text-white/50 hover:border-white/20 hover:text-white/70 transition-all flex items-center justify-center gap-2"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add a stop
      </button>

      {saving && (
        <div className="text-center">
          <span className="text-xs text-white/30">Saving...</span>
        </div>
      )}

      {/* Drawers/modals */}
      <ItineraryAddDrawer
        portalSlug={portal.slug}
        open={showAddDrawer}
        onClose={() => setShowAddDrawer(false)}
        onAdd={handleAddItem}
      />

      {shareUrl && (
        <ItineraryShareModal
          shareUrl={shareUrl}
          title={activeItinerary.title}
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}
