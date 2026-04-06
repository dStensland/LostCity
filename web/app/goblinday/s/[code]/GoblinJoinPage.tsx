"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useGoblinUser } from "@/lib/hooks/useGoblinUser";
import GoblinSummaryView from "@/components/goblin/GoblinSummaryView";

interface SessionMember {
  role: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface SessionInfo {
  id: number;
  name: string;
  date: string | null;
  status: string;
  member_count: number;
  members: SessionMember[];
  guest_names?: string[];
  is_member: boolean;
  // Summary fields (only present for ended/canceled sessions)
  movies?: Array<{
    id: number;
    title: string;
    poster_path: string | null;
    watch_order: number;
  }>;
  themes?: Array<{
    id: number;
    label: string;
    status: string;
    goblin_theme_movies: Array<{ movie_id: number }>;
  }>;
  timeline?: Array<{
    id: number;
    event_type: string;
    movie_id: number | null;
    theme_id: number | null;
    user_name: string | null;
    created_at: string;
  }>;
}

interface GoblinJoinPageProps {
  code: string;
}

export default function GoblinJoinPage({ code }: GoblinJoinPageProps) {
  const router = useRouter();
  const { user, loading: authLoading, signIn } = useGoblinUser();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/goblinday/sessions/join/${code}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data: SessionInfo = await res.json();
      setSession(data);

      // If already a member, redirect home
      if (data.is_member) {
        router.replace("/");
      }
    } catch {
      setNotFound(true);
    } finally {
      setFetchLoading(false);
    }
  }, [code, router]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleJoin = useCallback(async () => {
    if (!user) {
      signIn();
      return;
    }

    setJoining(true);
    setJoinError(null);

    try {
      const res = await fetch(`/api/goblinday/sessions/join/${code}`, {
        method: "POST",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setJoinError((body as { error?: string }).error ?? "Failed to join session.");
        return;
      }

      router.replace("/");
    } catch {
      setJoinError("Something went wrong. Try again.");
    } finally {
      setJoining(false);
    }
  }, [user, signIn, code, router]);

  // Loading state — auth + fetch can both be in progress
  if (fetchLoading || authLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="font-mono text-sm text-red-500 uppercase tracking-widest animate-pulse">
          LOADING...
        </p>
      </div>
    );
  }

  // Not found
  if (notFound || !session) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="border border-red-900/50 bg-black/80 rounded-lg p-8 max-w-sm w-full text-center space-y-4">
          <h1 className="font-mono text-2xl font-bold text-red-500 uppercase tracking-widest">
            GOBLIN DAY
          </h1>
          <p className="font-mono text-sm text-zinc-400 uppercase tracking-wide">
            Session not found.
          </p>
          <p className="font-mono text-xs text-zinc-600">
            This link may have expired or never existed.
          </p>
          <Link
            href="/"
            className="block mt-4 font-mono text-xs text-red-700 hover:text-red-500 uppercase tracking-widest transition-colors"
          >
            ← Back to Goblin Day
          </Link>
        </div>
      </div>
    );
  }

  // Session ended or canceled — show public summary
  if (session.status === "ended" || session.status === "canceled") {
    return (
      <GoblinSummaryView
        name={session.name}
        date={session.date}
        members={session.members}
        guestNames={session.guest_names ?? []}
        movies={session.movies ?? []}
        themes={session.themes ?? []}
        timeline={session.timeline ?? []}
      />
    );
  }

  const host = session.members.find((m) => m.role === "host");
  const hostName = host?.display_name ?? "Someone";

  const formattedDate = session.date
    ? new Date(session.date + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="border border-red-900/50 bg-black/80 rounded-lg p-8 max-w-sm w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="font-mono text-xs text-red-900 uppercase tracking-widest">
            You&apos;ve been invited to
          </p>
          <h1 className="font-mono text-2xl font-bold text-red-500 uppercase tracking-widest">
            GOBLIN DAY
          </h1>
        </div>

        {/* Session card */}
        <div className="border border-zinc-800 rounded p-4 space-y-2">
          <p className="font-mono text-sm font-bold text-zinc-100 uppercase tracking-wide">
            {session.name || "Goblin Day Marathon"}
          </p>
          {formattedDate && (
            <p className="font-mono text-xs text-zinc-500 uppercase tracking-wide">
              {formattedDate}
            </p>
          )}
          <p className="font-mono text-xs text-zinc-600">
            {session.member_count}{" "}
            {session.member_count === 1 ? "member" : "members"}
          </p>
        </div>

        {/* Member list */}
        {session.members.length > 0 && (
          <div className="space-y-2">
            <p className="font-mono text-xs text-zinc-600 uppercase tracking-widest">
              {hostName} is hosting
            </p>
            <div className="flex flex-wrap gap-2">
              {session.members.map((member, i) => (
                <span
                  key={i}
                  className={`font-mono text-xs px-2 py-1 rounded border uppercase tracking-wide ${
                    member.role === "host"
                      ? "border-red-800 text-red-500 bg-red-950/30"
                      : "border-zinc-700 text-zinc-400 bg-zinc-900/30"
                  }`}
                >
                  {member.display_name ?? "Goblin"}
                  {member.role === "host" && (
                    <span className="ml-1 text-red-800">★</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {joinError && (
          <p className="font-mono text-xs text-red-500 border border-red-900/50 bg-red-950/20 rounded px-3 py-2 uppercase tracking-wide">
            {joinError}
          </p>
        )}

        {/* Join button */}
        <button
          onClick={handleJoin}
          disabled={joining}
          className="w-full font-mono text-sm font-bold uppercase tracking-widest py-3 rounded border border-red-700 bg-red-950/40 text-red-400 hover:bg-red-900/50 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {joining
            ? "JOINING..."
            : user
              ? "JOIN GOBLIN DAY"
              : "SIGN IN TO JOIN"}
        </button>

        {!user && (
          <p className="font-mono text-xs text-zinc-700 text-center uppercase tracking-wide">
            Sign in with Google to join the session.
          </p>
        )}

        {/* Back link */}
        <div className="text-center">
          <Link
            href="/"
            className="font-mono text-xs text-zinc-800 hover:text-zinc-600 uppercase tracking-widest transition-colors"
          >
            ← Back to Goblin Day
          </Link>
        </div>
      </div>
    </div>
  );
}
