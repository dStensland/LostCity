"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getProxiedImageSrc } from "@/lib/image-proxy";
import {
  ForkKnife,
  Martini,
  Lightning,
  Bank,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";

export type Suggestion = {
  type: "venue" | "event" | "special";
  id: number;
  title: string;
  venue: {
    id: number;
    name: string;
    slug: string;
    lat: number | null;
    lng: number | null;
    venue_type: string | null;
  };
  suggested_time: string;
  distance_km: number;
  walking_minutes: number;
  reason: string;
  category: "food" | "drinks" | "activity" | "sight";
  image_url: string | null;
  active_special?: { title: string; type: string } | null;
};

interface OutingSuggestionsProps {
  portalSlug: string;
  anchorLat: number;
  anchorLng: number;
  anchorTime: string;
  anchorDate: string;
  onAddSuggestion: (suggestion: Suggestion) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  food: <ForkKnife size={18} weight="light" className="text-amber-400" />,
  drinks: <Martini size={18} weight="light" className="text-violet-400" />,
  activity: <Lightning size={18} weight="light" className="text-emerald-400" />,
  sight: <Bank size={18} weight="light" className="text-sky-400" />,
};

export default function OutingSuggestions({
  portalSlug,
  anchorLat,
  anchorLng,
  anchorTime,
  anchorDate,
  onAddSuggestion,
}: OutingSuggestionsProps) {
  const [beforeSuggestions, setBeforeSuggestions] = useState<Suggestion[]>([]);
  const [afterSuggestions, setAfterSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"before" | "after">("before");

  useEffect(() => {
    let cancelled = false;

    async function fetchSuggestions() {
      setLoading(true);
      const baseParams = new URLSearchParams({
        anchor_lat: String(anchorLat),
        anchor_lng: String(anchorLng),
        anchor_time: anchorTime,
        anchor_date: anchorDate,
        radius_km: "2",
      });

      const [beforeRes, afterRes] = await Promise.all([
        fetch(`/api/portals/${portalSlug}/outing-suggestions?${baseParams.toString()}&slot=before`).catch(() => null),
        fetch(`/api/portals/${portalSlug}/outing-suggestions?${baseParams.toString()}&slot=after`).catch(() => null),
      ]);

      if (cancelled) return;

      if (beforeRes?.ok) {
        const data = await beforeRes.json();
        setBeforeSuggestions(data.suggestions || []);
      }
      if (afterRes?.ok) {
        const data = await afterRes.json();
        setAfterSuggestions(data.suggestions || []);
      }

      setLoading(false);
    }

    fetchSuggestions();
    return () => { cancelled = true; };
  }, [portalSlug, anchorLat, anchorLng, anchorTime, anchorDate]);

  const suggestions = activeTab === "before" ? beforeSuggestions : afterSuggestions;

  return (
    <div className="space-y-3">
      {/* Before / After toggle */}
      <div className="flex gap-1 p-0.5 bg-white/5 rounded-lg">
        <button
          onClick={() => setActiveTab("before")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "before"
              ? "bg-white/10 text-white"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          Before ({beforeSuggestions.length})
        </button>
        <button
          onClick={() => setActiveTab("after")}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === "after"
              ? "bg-white/10 text-white"
              : "text-white/40 hover:text-white/60"
          }`}
        >
          After ({afterSuggestions.length})
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && suggestions.length === 0 && (
        <p className="text-center text-sm text-white/40 py-8">
          No suggestions found nearby
        </p>
      )}

      {!loading && suggestions.map((s) => {
        const imgSrc = s.image_url ? getProxiedImageSrc(s.image_url) : null;
        return (
          <button
            key={`${s.type}-${s.id}`}
            onClick={() => onAddSuggestion(s)}
            className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 shrink-0">
              {imgSrc ? (
                <Image
                  src={typeof imgSrc === "string" ? imgSrc : ""}
                  alt={s.title}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  {CATEGORY_ICONS[s.category] || <MapPin size={18} weight="light" className="text-white/40" />}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{s.title}</p>
              <p className="text-xs text-white/40 truncate">{s.reason}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-white/60 font-mono">{s.suggested_time}</p>
              <p className="text-[10px] text-white/30">{s.walking_minutes} min walk</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
