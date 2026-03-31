"use client";

import { useState, useCallback } from "react";
import SmartImage from "@/components/SmartImage";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w300";

interface PlanningMember {
  user_id: string;
  role: string;
  display_name: string;
  avatar_url: string | null;
}

interface PlanningProposedMovie {
  id: number;
  title: string;
  poster_path: string | null;
  rt_critics_score: number | null;
  rt_audience_score: number | null;
  proposed_by_name: string | null;
}

interface PlanningAllMovie {
  id: number;
  title: string;
  poster_path: string | null;
}

interface PlanningViewProps {
  sessionId: number;
  sessionName: string | null;
  sessionDate: string;
  inviteCode: string;
  members: PlanningMember[];
  proposedMovies: PlanningProposedMovie[];
  allMovies: PlanningAllMovie[];
  isHost: boolean;
  onPropose: (movieId: number) => void;
  onStartLive: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
}

export function GoblinPlanningView({
  sessionId,
  sessionName,
  sessionDate,
  inviteCode,
  members,
  proposedMovies,
  allMovies,
  isHost,
  onPropose,
  onStartLive,
  onCancel,
  onRefresh,
}: PlanningViewProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const [startingLive, setStartingLive] = useState(false);
  const [proposingId, setProposingId] = useState<number | null>(null);

  const proposedIds = new Set(proposedMovies.map((m) => m.id));
  const availableToPropose = allMovies.filter((m) => !proposedIds.has(m.id));

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/goblinday?invite=${inviteCode}`
      : `/goblinday?invite=${inviteCode}`;

  const handleCopyInvite = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }, [inviteUrl]);

  const handleStartLive = useCallback(async () => {
    setStartingLive(true);
    try {
      await onStartLive();
    } finally {
      setStartingLive(false);
    }
  }, [onStartLive]);

  const handlePropose = useCallback(
    async (movieId: number) => {
      setProposingId(movieId);
      try {
        await onPropose(movieId);
        setShowPicker(false);
      } finally {
        setProposingId(null);
      }
    },
    [onPropose]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-2 border-zinc-800 bg-black p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-500 text-2xs font-bold tracking-[0.25em] uppercase border border-amber-800/60 bg-amber-950/30 px-1.5 py-0.5">
                PLANNING
              </span>
            </div>
            <h2 className="text-white font-black text-lg tracking-[0.15em] uppercase truncate">
              {sessionName ?? "GOBLIN DAY"}
            </h2>
            <p className="text-zinc-600 text-xs tracking-[0.2em] uppercase mt-0.5">
              {formatDate(sessionDate)}
            </p>
          </div>
          {/* Desktop: side buttons */}
          {isHost && (
            <div className="hidden sm:flex flex-col gap-2 flex-shrink-0">
              <button
                onClick={handleStartLive}
                disabled={startingLive}
                className="px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 font-black text-xs tracking-[0.2em] uppercase border-2 border-red-700 hover:border-red-600 transition-colors shadow-[0_0_20px_rgba(185,28,28,0.3)] hover:shadow-[0_0_30px_rgba(185,28,28,0.5)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {startingLive ? "STARTING..." : "START GOBLIN DAY"}
              </button>
              <button
                onClick={onCancel}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 font-bold text-2xs tracking-[0.2em] uppercase border border-zinc-700 hover:border-zinc-600 transition-colors"
              >
                CANCEL
              </button>
            </div>
          )}
        </div>
        {/* Mobile: full-width buttons below header */}
        {isHost && (
          <div className="flex sm:hidden gap-2 mt-3">
            <button
              onClick={handleStartLive}
              disabled={startingLive}
              className="flex-1 px-3 py-2.5 bg-red-900 text-red-100 font-black text-xs tracking-[0.15em] uppercase border-2 border-red-700 transition-colors shadow-[0_0_20px_rgba(185,28,28,0.3)] disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            >
              {startingLive ? "STARTING..." : "START GOBLIN DAY"}
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-2.5 bg-zinc-900 text-zinc-500 font-bold text-2xs tracking-[0.15em] uppercase border border-zinc-700 transition-colors min-h-[44px]"
            >
              CANCEL
            </button>
          </div>
        )}
      </div>

      {/* Invite Link */}
      <section>
        <h3 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-2 border-b border-zinc-800 pb-2">
          INVITE LINK
        </h3>
        <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-950 p-2">
          <code className="text-zinc-400 text-2xs tracking-wider flex-1 min-w-0 truncate font-mono overflow-hidden">
            {inviteUrl}
          </code>
          <button
            onClick={handleCopyInvite}
            className={`flex-shrink-0 px-3 py-2 sm:py-1.5 text-2xs font-black tracking-[0.2em] uppercase border transition-colors min-h-[36px] ${
              copied
                ? "bg-emerald-900/40 text-emerald-400 border-emerald-700"
                : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-500"
            }`}
          >
            {copied ? "COPIED!" : "COPY"}
          </button>
        </div>
        <p className="text-zinc-700 text-2xs tracking-wider uppercase mt-1.5">
          CODE: <span className="text-zinc-500 font-bold">{inviteCode}</span>
        </p>
      </section>

      {/* Members */}
      <section>
        <h3 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-2 border-b border-zinc-800 pb-2">
          GOBLINS JOINED [{members.length}]
        </h3>
        {members.length === 0 ? (
          <p className="text-zinc-700 text-xs tracking-[0.2em] uppercase py-3 text-center">
            // NO ONE YET — SHARE THE INVITE LINK
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center gap-2 px-2.5 py-1.5 border border-zinc-800 bg-zinc-950"
              >
                {member.avatar_url ? (
                  <div className="w-5 h-5 rounded-full overflow-hidden relative flex-shrink-0">
                    <SmartImage
                      src={member.avatar_url}
                      alt={member.display_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-zinc-600 text-2xs font-bold">
                      {member.display_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-zinc-300 text-xs font-bold tracking-wider uppercase">
                  {member.display_name}
                </span>
                {member.role === "host" && (
                  <span className="text-red-600 text-2xs font-bold">HOST</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Proposed Movies */}
      <section>
        <h3 className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase mb-2 border-b border-zinc-800 pb-2">
          PROPOSED MOVIES [{proposedMovies.length}]
        </h3>
        {proposedMovies.length === 0 ? (
          <p className="text-zinc-700 text-xs tracking-[0.2em] uppercase py-3 text-center">
            // NOTHING PROPOSED YET
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
            {proposedMovies.map((movie) => (
              <div
                key={movie.id}
                className="border border-zinc-800 bg-zinc-950 overflow-hidden"
              >
                {/* Poster */}
                <div className="relative w-full aspect-[2/3] bg-zinc-900">
                  {movie.poster_path ? (
                    <SmartImage
                      src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                      alt={movie.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700 text-xs tracking-wider uppercase">
                      NO IMAGE
                    </div>
                  )}
                </div>
                {/* Info */}
                <div className="p-2">
                  <p className="text-white text-xs font-bold tracking-wider uppercase leading-tight mb-1 line-clamp-2">
                    {movie.title}
                  </p>
                  <div className="flex gap-1.5 flex-wrap mb-1">
                    {movie.rt_critics_score != null && (
                      <span className="text-2xs text-red-500/70">
                        RT {movie.rt_critics_score}%
                      </span>
                    )}
                    {movie.rt_audience_score != null && (
                      <span className="text-2xs text-amber-500/70">
                        AUD {movie.rt_audience_score}%
                      </span>
                    )}
                  </div>
                  {movie.proposed_by_name && (
                    <p className="text-zinc-600 text-2xs tracking-wider uppercase">
                      BY {movie.proposed_by_name}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Propose button */}
        {!showPicker ? (
          <button
            onClick={() => setShowPicker(true)}
            className="w-full px-4 py-3 sm:py-2.5 border-2 border-dashed border-zinc-700 hover:border-red-800 text-zinc-500 hover:text-red-400 text-xs font-bold tracking-[0.2em] uppercase transition-colors min-h-[44px]"
          >
            + PROPOSE MOVIE
          </button>
        ) : (
          <div className="border-2 border-zinc-800 bg-black">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="text-red-600 text-xs font-bold tracking-[0.2em] uppercase">
                PICK A MOVIE TO PROPOSE
              </span>
              <button
                onClick={() => setShowPicker(false)}
                className="text-zinc-600 hover:text-white text-xs font-bold tracking-wider uppercase transition-colors"
              >
                CLOSE
              </button>
            </div>
            {availableToPropose.length === 0 ? (
              <p className="text-zinc-700 text-xs tracking-[0.2em] uppercase py-6 text-center">
                // ALL MOVIES ALREADY PROPOSED
              </p>
            ) : (
              <div className="max-h-72 sm:max-h-64 overflow-y-auto divide-y divide-zinc-800/60">
                {availableToPropose.map((movie) => (
                  <div
                    key={movie.id}
                    className="flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-zinc-900/50 transition-colors"
                  >
                    <div className="w-7 h-10 flex-shrink-0 bg-zinc-900 overflow-hidden relative">
                      {movie.poster_path ? (
                        <SmartImage
                          src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                          alt={movie.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700 text-2xs">
                          ?
                        </div>
                      )}
                    </div>
                    <span className="text-zinc-300 text-xs font-bold tracking-wider uppercase flex-1 min-w-0 truncate">
                      {movie.title}
                    </span>
                    <button
                      onClick={() => handlePropose(movie.id)}
                      disabled={proposingId === movie.id}
                      className="flex-shrink-0 px-3 py-2 sm:py-1 bg-red-900/60 hover:bg-red-800 text-red-300 hover:text-white text-xs font-black tracking-[0.15em] uppercase border border-red-800 hover:border-red-600 transition-colors disabled:opacity-40 min-h-[36px]"
                    >
                      {proposingId === movie.id ? "..." : "PROPOSE"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Refresh */}
      <div className="flex justify-center">
        <button
          onClick={onRefresh}
          className="px-4 py-2 text-zinc-600 hover:text-zinc-400 text-2xs font-bold tracking-[0.2em] uppercase transition-colors"
        >
          REFRESH
        </button>
      </div>
    </div>
  );
}

export type { PlanningViewProps };
