"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import type { AddItineraryItemInput } from "@/lib/itinerary-utils";
import { getProxiedImageSrc } from "@/lib/image-proxy";

interface SearchResult {
  id: number;
  type: "event" | "venue";
  title: string;
  subtitle: string;
  image_url: string | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
}

interface ItineraryAddDrawerProps {
  portalSlug: string;
  open: boolean;
  onClose: () => void;
  onAdd: (input: AddItineraryItemInput) => void;
}

export default function ItineraryAddDrawer({
  portalSlug,
  open,
  onClose,
  onAdd,
}: ItineraryAddDrawerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<"search" | "custom">("search");
  const [customTitle, setCustomTitle] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [customTime, setCustomTime] = useState("");
  const [customDuration, setCustomDuration] = useState(60);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (open && tab === "search") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, tab]);

  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const [eventsRes, venuesRes] = await Promise.all([
          fetch(
            `/api/portals/${portalSlug}/feed?q=${encodeURIComponent(q)}&limit=8`
          ).catch(() => null),
          fetch(
            `/api/portals/${portalSlug}/destinations/specials?q=${encodeURIComponent(q)}&limit=8`
          ).catch(() => null),
        ]);

        const items: SearchResult[] = [];

        if (eventsRes?.ok) {
          const data = await eventsRes.json();
          const events = (data.sections || []).flatMap(
            (s: { events?: Array<Record<string, unknown>> }) => s.events || []
          );
          for (const e of events.slice(0, 6)) {
            items.push({
              id: Number(e.id),
              type: "event",
              title: String(e.title || ""),
              subtitle: String(e.venue_name || e.category || ""),
              image_url: e.image_url ? String(e.image_url) : null,
              category: e.category ? String(e.category) : null,
              lat: typeof e.lat === "number" ? e.lat : null,
              lng: typeof e.lng === "number" ? e.lng : null,
            });
          }
        }

        if (venuesRes?.ok) {
          const data = await venuesRes.json();
          for (const d of (data.destinations || []).slice(0, 6)) {
            const v = d.venue || d;
            items.push({
              id: Number(v.id),
              type: "venue",
              title: String(v.name || ""),
              subtitle: String(v.neighborhood || v.venue_type || ""),
              image_url: v.image_url ? String(v.image_url) : null,
              category: v.venue_type ? String(v.venue_type) : null,
              lat: typeof v.lat === "number" ? v.lat : null,
              lng: typeof v.lng === "number" ? v.lng : null,
            });
          }
        }

        setResults(items);
      } catch {
        setResults([]);
      }
      setSearching(false);
    },
    [portalSlug]
  );

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), 300);
    },
    [search]
  );

  const handleAddResult = useCallback(
    (result: SearchResult) => {
      onAdd({
        item_type: result.type,
        ...(result.type === "event" ? { event_id: result.id } : { venue_id: result.id }),
      });
      onClose();
      setQuery("");
      setResults([]);
    },
    [onAdd, onClose]
  );

  const handleAddCustom = useCallback(() => {
    if (!customTitle.trim()) return;
    onAdd({
      item_type: "custom",
      custom_title: customTitle.trim(),
      custom_address: customAddress.trim() || undefined,
      start_time: customTime || undefined,
      duration_minutes: customDuration,
    });
    onClose();
    setCustomTitle("");
    setCustomAddress("");
    setCustomTime("");
    setCustomDuration(60);
  }, [onAdd, onClose, customTitle, customAddress, customTime, customDuration]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-[var(--bg-primary,#1a1a2e)] rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pb-3">
          <button
            onClick={() => setTab("search")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "search"
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Search
          </button>
          <button
            onClick={() => setTab("custom")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === "custom"
                ? "bg-white/10 text-white"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            Custom Stop
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {tab === "search" ? (
            <>
              <div className="relative mb-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  placeholder="Search events, restaurants, bars..."
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {results.length === 0 && query.length >= 2 && !searching && (
                <p className="text-center text-sm text-white/40 py-6">
                  No results found
                </p>
              )}

              <div className="space-y-1.5">
                {results.map((result) => {
                  const imgSrc = result.image_url
                    ? getProxiedImageSrc(result.image_url)
                    : null;
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleAddResult(result)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
                        {imgSrc ? (
                          <Image
                            src={typeof imgSrc === "string" ? imgSrc : ""}
                            alt={result.title}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                            {result.type === "event" ? "E" : "V"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">
                          {result.title}
                        </p>
                        <p className="text-xs text-white/40 truncate">
                          {result.subtitle}
                        </p>
                      </div>
                      <span className="text-[10px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                        {result.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">Name</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Walk along the BeltLine"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="block text-xs text-white/50 mb-1">
                  Address (optional)
                </label>
                <input
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="e.g., 123 Peachtree St"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-white/50 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20 [color-scheme:dark]"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-white/50 mb-1">
                    Duration
                  </label>
                  <select
                    value={customDuration}
                    onChange={(e) => setCustomDuration(Number(e.target.value))}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-white/20 [color-scheme:dark]"
                  >
                    <option value={15}>15m</option>
                    <option value={30}>30m</option>
                    <option value={45}>45m</option>
                    <option value={60}>1h</option>
                    <option value={90}>1.5h</option>
                    <option value={120}>2h</option>
                    <option value={180}>3h</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleAddCustom}
                disabled={!customTitle.trim()}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${
                  customTitle.trim()
                    ? "bg-[var(--accent,#f97316)] text-white hover:brightness-110"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
              >
                Add Stop
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
