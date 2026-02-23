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
} from "@phosphor-icons/react/dist/ssr";
import type { Itinerary, LocalItinerary } from "@/lib/itinerary-utils";

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

        {/* Empty state — glassmorphism card */}
        {!loading && itineraries.length === 0 && (
          <div
            className="text-center py-14 px-6 rounded-2xl border"
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              backdropFilter: "blur(24px) saturate(150%)",
              borderColor: "rgba(255, 255, 255, 0.06)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.04)",
            }}
          >
            <div
              className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, rgba(255, 217, 61, 0.1), rgba(0, 212, 232, 0.08))",
                border: "1px solid rgba(255, 217, 61, 0.15)",
              }}
            >
              <MapPin size={28} weight="light" className="text-[var(--gold)]" />
            </div>
            <h2
              className="text-lg font-semibold mb-1.5"
              style={{ color: "var(--cream)", fontFamily: "var(--font-outfit)" }}
            >
              Plan your perfect night out
            </h2>
            <p className="text-sm text-white/35 mb-6 max-w-xs mx-auto leading-relaxed">
              Build a playbook with smart suggestions, walk times, and shareable links
            </p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--gold)]/90 text-[var(--void)] text-sm font-semibold hover:bg-[var(--gold)] transition-all disabled:opacity-50"
            >
              <Plus size={16} weight="bold" />
              Create your first playbook
            </button>
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
                            {itin.date}
                          </span>
                        )}
                        {itemCount > 0 && (
                          <span className="text-[11px] text-white/30 font-mono">
                            {itemCount} stop{itemCount !== 1 ? "s" : ""}
                          </span>
                        )}
                        {!isServer && (
                          <span className="text-[10px] text-white/20 px-1.5 py-0.5 rounded bg-white/5">
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
