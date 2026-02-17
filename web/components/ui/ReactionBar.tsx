"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const EMOJI_SET = ["🔥", "❤️", "🎉", "😂", "💯", "👀"];

type Reaction = {
  emoji: string;
  count: number;
  hasReacted: boolean;
};

interface ReactionBarProps {
  targetType: "rsvp" | "follow" | "save";
  targetId: number;
  reactions: Reaction[];
}

export function ReactionBar({ targetType, targetId, reactions: initialReactions }: ReactionBarProps) {
  const queryClient = useQueryClient();
  const [reactions, setReactions] = useState<Reaction[]>(initialReactions);
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Sync with parent
  useEffect(() => {
    setReactions(initialReactions);
  }, [initialReactions]);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const addReaction = useMutation({
    mutationFn: async (emoji: string) => {
      const res = await fetch("/api/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: targetType, target_id: targetId, emoji }),
      });
      if (!res.ok) throw new Error("Failed");
      return { emoji };
    },
    onMutate: async (emoji) => {
      // Optimistic update
      setReactions((prev) => {
        const existing = prev.find((r) => r.emoji === emoji);
        if (existing) {
          if (existing.hasReacted) {
            // Toggle off — remove reaction
            return prev
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count - 1, hasReacted: false }
                  : r
              )
              .filter((r) => r.count > 0);
          }
          return prev.map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count + 1, hasReacted: true }
              : r
          );
        }
        return [...prev, { emoji, count: 1, hasReacted: true }];
      });
      setShowPicker(false);
    },
    onError: () => {
      // Rollback
      setReactions(initialReactions);
    },
  });

  const removeReaction = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/reactions?target_type=${targetType}&target_id=${targetId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
    },
  });

  const handleToggle = (emoji: string) => {
    const existing = reactions.find((r) => r.emoji === emoji);
    if (existing?.hasReacted) {
      // Remove
      setReactions((prev) =>
        prev
          .map((r) =>
            r.emoji === emoji
              ? { ...r, count: r.count - 1, hasReacted: false }
              : r
          )
          .filter((r) => r.count > 0)
      );
      removeReaction.mutate();
    } else {
      addReaction.mutate(emoji);
    }
  };

  return (
    <div
      className="flex items-center gap-1 flex-wrap"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Existing reactions */}
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleToggle(r.emoji);
          }}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
            r.hasReacted
              ? "bg-[var(--coral)]/15 border border-[var(--coral)]/30"
              : "bg-[var(--twilight)]/50 border border-transparent hover:border-[var(--twilight)]"
          }`}
        >
          <span>{r.emoji}</span>
          <span className={`font-mono text-[0.6rem] ${r.hasReacted ? "text-[var(--coral)]" : "text-[var(--muted)]"}`}>
            {r.count}
          </span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowPicker(!showPicker);
          }}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--twilight)]/30 hover:bg-[var(--twilight)]/60 transition-colors text-[var(--muted)] hover:text-[var(--cream)]"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>

        {/* Emoji picker */}
        {showPicker && (
          <div className="absolute bottom-full left-0 mb-1 flex gap-1 p-1.5 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg shadow-xl z-10">
            {EMOJI_SET.map((emoji) => (
              <button
                key={emoji}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addReaction.mutate(emoji);
                }}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-[var(--twilight)]/50 transition-colors text-base"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
