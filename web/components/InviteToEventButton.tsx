"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useFriends, type Profile } from "@/lib/hooks/useFriends";
import { useToast } from "@/components/Toast";
import UserAvatar from "@/components/UserAvatar";

interface InviteToEventButtonProps {
  eventId: number;
  eventTitle: string;
  variant?: "icon" | "button";
}

export default function InviteToEventButton({ eventId, eventTitle, variant = "icon" }: InviteToEventButtonProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="p-2 text-[var(--muted)] hover:text-[var(--coral)] hover:bg-[var(--twilight)]/50 rounded-lg transition-all"
          title="Invite friends"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </button>
        {isOpen && (
          <InviteModal
            eventId={eventId}
            eventTitle={eventTitle}
            onClose={() => setIsOpen(false)}
            showToast={showToast}
          />
        )}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--twilight)] transition-all"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        Invite Friends
      </button>
      {isOpen && (
        <InviteModal
          eventId={eventId}
          eventTitle={eventTitle}
          onClose={() => setIsOpen(false)}
          showToast={showToast}
        />
      )}
    </>
  );
}

interface InviteModalProps {
  eventId: number;
  eventTitle: string;
  onClose: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}

function InviteModal({ eventId, eventTitle, onClose, showToast }: InviteModalProps) {
  const { friends, isLoading } = useFriends();
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Email invite state
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailText, setEmailText] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  const handleInvite = useCallback(async (friend: Profile) => {
    setSendingId(friend.id);
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, inviteeId: friend.id }),
      });

      if (res.ok) {
        setInvitedIds((prev) => new Set(prev).add(friend.id));
        showToast(`Invited ${friend.display_name || friend.username}!`, "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to send invite", "error");
      }
    } catch {
      showToast("Failed to send invite", "error");
    } finally {
      setSendingId(null);
    }
  }, [eventId, showToast]);

  const handleEmailInvite = async () => {
    const emails = emailText
      .split(/[,;\n\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    if (emails.length === 0) {
      showToast("Enter valid email addresses", "error");
      return;
    }

    setEmailSending(true);
    try {
      const res = await fetch("/api/find-friends/send-invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, eventId }),
      });

      if (res.ok) {
        const data = await res.json();
        showToast(`Sent ${data.sent} invite${data.sent !== 1 ? "s" : ""}!`, "success");
        setEmailText("");
        setShowEmailInput(false);
      } else {
        showToast("Failed to send email invites", "error");
      }
    } catch {
      showToast("Failed to send email invites", "error");
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm bg-[var(--card-bg)] border border-[var(--twilight)] rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--twilight)]">
          <h3 className="font-mono text-sm font-bold text-[var(--cream)] truncate pr-2">
            Invite to {eventTitle}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Friends list */}
        <div className="max-h-64 overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[var(--muted)] text-sm font-mono">No friends yet</p>
              <a href="/find-friends" className="text-[var(--coral)] text-xs font-mono hover:underline mt-1 inline-block">
                Find friends
              </a>
            </div>
          ) : (
            friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--dusk)] transition-colors"
              >
                <UserAvatar
                  src={friend.avatar_url}
                  name={friend.display_name || friend.username}
                  size="sm"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--cream)] truncate">
                    {friend.display_name || `@${friend.username}`}
                  </p>
                </div>
                <button
                  onClick={() => handleInvite(friend)}
                  disabled={invitedIds.has(friend.id) || sendingId === friend.id}
                  className={`px-3 py-1 rounded-full font-mono text-xs transition-all ${
                    invitedIds.has(friend.id)
                      ? "bg-[var(--neon-green)]/10 text-[var(--neon-green)] border border-[var(--neon-green)]/30"
                      : "bg-[var(--coral)] text-[var(--void)] hover:bg-[var(--rose)]"
                  } disabled:opacity-50`}
                >
                  {sendingId === friend.id ? (
                    <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : invitedIds.has(friend.id) ? (
                    "Sent"
                  ) : (
                    "Invite"
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        {/* Email invite section */}
        <div className="border-t border-[var(--twilight)] p-3">
          {showEmailInput ? (
            <div className="space-y-2">
              <textarea
                value={emailText}
                onChange={(e) => setEmailText(e.target.value)}
                placeholder="friend@example.com"
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--coral)]/50 font-mono text-xs resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEmailInvite}
                  disabled={emailSending || !emailText.trim()}
                  className="flex-1 px-3 py-1.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-xs font-medium hover:bg-[var(--rose)] disabled:opacity-50 transition-all"
                >
                  {emailSending ? "Sending..." : "Send Email Invite"}
                </button>
                <button
                  onClick={() => setShowEmailInput(false)}
                  className="px-3 py-1.5 text-[var(--muted)] font-mono text-xs hover:text-[var(--cream)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowEmailInput(true)}
              className="w-full text-center text-xs text-[var(--coral)] font-mono hover:text-[var(--rose)] transition-colors"
            >
              Invite by email
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
