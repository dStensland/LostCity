"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { usePortal } from "@/lib/portal-context";
import { useItinerary } from "@/lib/hooks/useItinerary";
import {
  Plus,
  CalendarBlank,
  CaretRight,
  Notebook,
  ArrowsDownUp,
  ShareNetwork,
  MapPin,
  MoonStars,
  Heart,
} from "@phosphor-icons/react";
import { formatWalkDistance } from "@/lib/itinerary-utils";
import type { Itinerary, LocalItinerary } from "@/lib/itinerary-utils";

function getPlaybookTemplates(portalDisplayName: string) {
  return [
    {
      key: "tonight" as const,
      title: `Tonight in ${portalDisplayName}`,
      description: "Start with what's happening tonight",
      icon: "moon" as const,
      getDate: () => new Date().toISOString().slice(0, 10),
    },
    {
      key: "weekend" as const,
      title: "Weekend Explorer",
      description: "Plan ahead for Saturday",
      icon: "calendar" as const,
      getDate: () => {
        const d = new Date();
        const daysUntilSat = (6 - d.getDay() + 7) % 7 || 7;
        d.setDate(d.getDate() + daysUntilSat);
        return d.toISOString().slice(0, 10);
      },
    },
    {
      key: "date" as const,
      title: "Date Night",
      description: "Dinner, drinks, and a show",
      icon: "heart" as const,
      getDate: () => new Date().toISOString().slice(0, 10),
    },
    {
      key: "custom" as const,
      title: "Blank Playbook",
      description: "Start from scratch",
      icon: "plus" as const,
      getDate: () => new Date().toISOString().slice(0, 10),
    },
  ];
}

export default function PlaybookListPage() {
  const params = useParams();
  const router = useRouter();
  const portalSlug = params.portal as string;
  const { user } = useAuth();
  const { portal } = usePortal();
  const portalId = portal?.id || "";

  const {
    itineraries,
    loading,
    createItinerary,
  } = useItinerary(portalId, portalSlug);

  const [creating, setCreating] = useState(false);
  const [sortNewest, setSortNewest] = useState(true);
  const portalDisplayName = portal?.name || "Atlanta";
  const templates = useMemo(() => getPlaybookTemplates(portalDisplayName), [portalDisplayName]);

  const sortedItineraries = useMemo(() => {
    const sorted = [...itineraries].sort((a, b) => {
      const aDate = a.updated_at || a.created_at;
      const bDate = b.updated_at || b.created_at;
      return sortNewest
        ? new Date(bDate).getTime() - new Date(aDate).getTime()
        : new Date(aDate).getTime() - new Date(bDate).getTime();
    });
    return sorted;
  }, [itineraries, sortNewest]);

  const handleCreate = async () => {
    setCreating(true);
    const today = new Date().toISOString().slice(0, 10);
    const id = await createItinerary(portalId, "My Playbook", today);
    setCreating(false);
    if (id) {
      router.push(`/${portalSlug}/playbook/${id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary,#0f0f23)] text-white">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Notebook size={24} weight="light" className="text-[var(--gold)]" />
              My Playbooks
            </h1>
            <p className="text-sm text-white/40 mt-1">
              Plan your outings and share with friends
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--gold)]/90 text-[var(--void)] text-sm font-semibold hover:bg-[var(--gold)] transition-all disabled:opacity-50"
          >
            <Plus size={16} weight="bold" />
            New
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state — template cards */}
        {!loading && itineraries.length === 0 && (
          <div>
            <p className="text-sm text-white/40 mb-4 text-center">
              Choose a starting point for your playbook
            </p>
            <div className="grid grid-cols-2 gap-3">
              {templates.map((tpl) => {
                const iconConfig = {
                  moon: {
                    icon: <MoonStars size={22} weight="light" className="text-[var(--gold)]" />,
                    bg: "rgba(255, 217, 61, 0.08)",
                    border: "rgba(255, 217, 61, 0.15)",
                  },
                  calendar: {
                    icon: <CalendarBlank size={22} weight="light" className="text-[var(--neon-cyan,#00d4e8)]" />,
                    bg: "rgba(0, 212, 232, 0.08)",
                    border: "rgba(0, 212, 232, 0.15)",
                  },
                  heart: {
                    icon: <Heart size={22} weight="light" className="text-pink-400" />,
                    bg: "rgba(244, 114, 182, 0.08)",
                    border: "rgba(244, 114, 182, 0.15)",
                  },
                  plus: {
                    icon: <Plus size={22} weight="light" className="text-white/60" />,
                    bg: "rgba(255, 255, 255, 0.06)",
                    border: "rgba(255, 255, 255, 0.10)",
                  },
                } as const;
                const cfg = iconConfig[tpl.icon];
                return (
                  <button
                    key={tpl.key}
                    onClick={async () => {
                      setCreating(true);
                      const id = await createItinerary(portalId, tpl.title, tpl.getDate());
                      setCreating(false);
                      if (id) router.push(`/${portalSlug}/playbook/${id}`);
                    }}
                    disabled={creating}
                    className="group flex flex-col items-start gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all text-left disabled:opacity-50"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                      }}
                    >
                      {cfg.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white group-hover:text-[var(--gold)] transition-colors">
                        {tpl.title}
                      </h3>
                      <p className="text-[11px] text-white/30 mt-0.5">{tpl.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sort toggle + Itinerary list */}
        {!loading && itineraries.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-white/30 font-mono">
                {itineraries.length} playbook{itineraries.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => setSortNewest(!sortNewest)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-white/40 hover:text-white/60 hover:bg-white/5 transition-colors"
              >
                <ArrowsDownUp size={13} />
                {sortNewest ? "Newest" : "Oldest"}
              </button>
            </div>

            <div className="space-y-2">
              {sortedItineraries.map((itin) => {
                const isServer = "share_token" in itin;
                const isPublic = isServer && (itin as Itinerary).is_public;
                const itemCount = isServer
                  ? ((itin as Itinerary).items?.length ?? 0)
                  : ((itin as LocalItinerary).items?.length ?? 0);
                const items = isServer
                  ? (itin as Itinerary).items || []
                  : (itin as LocalItinerary).items || [];
                const totalWalkMeters = items.reduce((s, i) => s + ((i as { walk_distance_meters?: number | null }).walk_distance_meters || 0), 0);

                return (
                  <Link
                    key={itin.id}
                    href={`/${portalSlug}/playbook/${itin.id}`}
                    className="group flex items-center gap-3 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
                      <Notebook size={20} weight="light" className="text-[var(--gold)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-white truncate group-hover:text-[var(--gold)] transition-colors">
                          {itin.title}
                        </h3>
                        {isPublic && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--neon-cyan,#00d4e8)]/15 text-[var(--neon-cyan,#00d4e8)]">
                            <ShareNetwork size={9} />
                            Shared
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {itin.date && (
                          <span className="flex items-center gap-1 text-[11px] text-white/30 font-mono">
                            <CalendarBlank size={11} weight="light" />
                            {new Date(itin.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                        )}
                        {itemCount > 0 && (
                          <span className="text-[11px] text-white/30 font-mono">
                            {itemCount} stop{itemCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {totalWalkMeters > 0 && (
                          <span className="text-[11px] text-white/30 font-mono">
                            {formatWalkDistance(totalWalkMeters)}
                          </span>
                        )}
                        {!isServer && (
                          <span className="text-[10px] text-amber-400/70 px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/15">
                            Local
                          </span>
                        )}
                      </div>
                    </div>
                    <CaretRight size={16} className="text-white/20 group-hover:text-white/40 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Sign-in prompt for anonymous users */}
        {!user && !loading && (
          <div className="mt-6 p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center">
            <p className="text-xs text-white/30">
              Sign in to save playbooks across devices and share them with friends
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
