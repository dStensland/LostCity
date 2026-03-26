"use client";

import type { User } from "@supabase/supabase-js";

interface GoblinAuthBarProps {
  user: User | null;
  loading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function GoblinAuthBar({ user, loading, onSignIn, onSignOut }: GoblinAuthBarProps) {
  if (loading) return null;

  const displayName =
    user?.user_metadata?.display_name ??
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "GOBLIN";

  return (
    <div className="flex items-center justify-end gap-3 px-4 py-2 bg-black/80 backdrop-blur-sm font-mono">
      {user ? (
        <>
          <span className="text-2xs text-zinc-500 tracking-widest uppercase truncate max-w-[200px]">
            {displayName.toUpperCase()}
          </span>
          <button
            onClick={onSignOut}
            className="text-2xs font-bold tracking-[0.2em] uppercase text-zinc-600 hover:text-red-400 transition-colors border border-zinc-800 hover:border-red-900/50 px-2.5 py-1"
          >
            SIGN OUT
          </button>
        </>
      ) : (
        <button
          onClick={onSignIn}
          className="text-2xs font-bold tracking-[0.2em] uppercase text-red-400 hover:text-red-300 transition-all border border-red-900 hover:border-red-600 hover:shadow-[0_0_8px_rgba(185,28,28,0.3)] px-3 py-1 bg-red-950/20 hover:bg-red-950/40"
        >
          SIGN IN
        </button>
      )}
    </div>
  );
}

export type { GoblinAuthBarProps };
