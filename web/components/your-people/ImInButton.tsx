"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

type ImInState = "default" | "going" | "interested";

interface ImInButtonProps {
  eventId: number;
  initialState?: ImInState;
  className?: string;
}

export default function ImInButton({ eventId, initialState = "default", className = "" }: ImInButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ImInState>(initialState);

  const rsvpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          status: "going",
          notify_friends: true,
        }),
      });
      if (!res.ok) throw new Error("RSVP failed");
      return res.json();
    },
    onMutate: () => {
      setState("going");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crew-board"] });
      queryClient.invalidateQueries({ queryKey: ["friend-signal-events"] });
    },
    onError: () => {
      setState(initialState);
    },
  });

  const undoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rsvp?event_id=${eventId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Undo failed");
      return res.json();
    },
    onMutate: () => {
      setState("default");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crew-board"] });
    },
    onError: () => {
      setState("going");
    },
  });

  const handleClick = useCallback(() => {
    if (!user) return;
    if (state === "going") {
      undoMutation.mutate();
    } else {
      rsvpMutation.mutate();
    }
  }, [user, state, rsvpMutation, undoMutation]);

  if (!user) return null;

  const styles = {
    default: "bg-[var(--coral)]/12 border-[var(--coral)]/30 text-[var(--coral)]",
    going: "bg-[var(--neon-green)]/12 border-[var(--neon-green)]/30 text-[var(--neon-green)]",
    interested: "bg-[var(--gold)]/12 border-[var(--gold)]/30 text-[var(--gold)]",
  };

  const labels = {
    default: "I'm in",
    going: "Going",
    interested: "Interested",
  };

  return (
    <button
      onClick={handleClick}
      disabled={rsvpMutation.isPending || undoMutation.isPending}
      className={`min-h-[44px] px-3.5 py-2 rounded-lg border font-mono text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5 ${styles[state]} ${className}`}
    >
      {state === "going" && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
      {labels[state]}
    </button>
  );
}
