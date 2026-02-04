"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateString } from "@/lib/formats";

// Timeout constant for queries to prevent indefinite hanging
const QUERY_TIMEOUT = 8000;

export default function SavedEventsButton() {
  const { user } = useAuth();
  const [savedCount, setSavedCount] = useState(0);

  // Fetch saved count on mount and periodically
  useEffect(() => {
    if (!user) return;

    let isMounted = true;
    const userId = user.id;
    const supabase = createClient();

    async function fetchSavedCount() {
      try {
        const today = getLocalDateString();

        // Count upcoming saved events only - with timeout protection
        const countQuery = supabase
          .from("saved_items")
          .select("event:events!inner(start_date)", { count: "exact", head: true })
          .eq("user_id", userId)
          .not("event_id", "is", null)
          .gte("event.start_date", today);

        const { count, error } = await Promise.race([
          countQuery,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Query timeout")), QUERY_TIMEOUT)
          ),
        ]);

        if (!error && count !== null && isMounted) {
          setSavedCount(count);
        }
      } catch {
        // Silent fail - timeout or network error
      }
    }

    fetchSavedCount();

    // Subscribe to changes in saved_items
    const channel = supabase
      .channel("saved_count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "saved_items",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchSavedCount();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [user]);

  if (!user) return null;

  return (
    <Link
      href="/saved"
      className="relative p-2.5 text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50 rounded-lg transition-colors active:scale-95"
      aria-label="Saved events"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>

      {/* Count badge */}
      {savedCount > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-[var(--coral)] text-[var(--void)] text-[0.6rem] font-bold rounded-full flex items-center justify-center">
          {savedCount > 99 ? "99+" : savedCount}
        </span>
      )}
    </Link>
  );
}
