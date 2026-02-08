"use client";

import { useState } from "react";
import Link from "next/link";
import UserAvatar from "@/components/UserAvatar";
import FriendButton from "@/components/FriendButton";
import { useToast } from "@/components/Toast";

export type MatchedProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

interface ContactMatchResultsProps {
  matched: MatchedProfile[];
  unmatched: string[];
  onClear: () => void;
}

export function ContactMatchResults({ matched, unmatched, onClear }: ContactMatchResultsProps) {
  const { showToast } = useToast();
  const [inviteSending, setInviteSending] = useState(false);
  const [invitedEmails, setInvitedEmails] = useState<Set<string>>(new Set());

  const handleSendInvites = async () => {
    const emailsToInvite = unmatched.filter((e) => !invitedEmails.has(e));
    if (emailsToInvite.length === 0) return;

    setInviteSending(true);
    try {
      // Send in batches of 10
      let totalSent = 0;
      const allAlreadyInvited: string[] = [];

      for (let i = 0; i < emailsToInvite.length; i += 10) {
        const batch = emailsToInvite.slice(i, i + 10);
        const res = await fetch("/api/find-friends/send-invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails: batch }),
        });

        if (res.ok) {
          const data = await res.json();
          totalSent += data.sent;
          allAlreadyInvited.push(...(data.alreadyInvited || []));
        }
      }

      setInvitedEmails(new Set([...invitedEmails, ...emailsToInvite]));

      if (totalSent > 0) {
        showToast(`Sent ${totalSent} invite${totalSent !== 1 ? "s" : ""}!`, "success");
      }
      if (allAlreadyInvited.length > 0) {
        showToast(`${allAlreadyInvited.length} already invited`, "info");
      }
    } catch {
      showToast("Failed to send invites", "error");
    } finally {
      setInviteSending(false);
    }
  };

  if (matched.length === 0 && unmatched.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header with count and clear button */}
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--soft)]">
          Results
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-[var(--muted)] hover:text-[var(--coral)] font-mono transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Matched users */}
      {matched.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--neon-green)] font-mono">
            {matched.length} friend{matched.length !== 1 ? "s" : ""} found on Lost City
          </p>
          {matched.map((profile) => (
            <div
              key={profile.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-[var(--dusk)] border border-[var(--neon-green)]/20 hover:border-[var(--coral)]/30 transition-all"
            >
              <Link href={`/profile/${profile.username}`} className="flex-shrink-0">
                <UserAvatar
                  src={profile.avatar_url}
                  name={profile.display_name || profile.username}
                  size="md"
                  glow
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/profile/${profile.username}`}
                  className="font-medium text-[var(--cream)] hover:text-[var(--coral)] transition-colors block truncate"
                >
                  {profile.display_name || `@${profile.username}`}
                </Link>
                <p className="text-xs text-[var(--muted)] truncate">@{profile.username}</p>
              </div>
              <FriendButton
                targetUserId={profile.id}
                targetUsername={profile.username}
                size="sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* Unmatched - invite option */}
      {unmatched.length > 0 && (
        <div className="p-4 rounded-lg bg-[var(--dusk)] border border-[var(--twilight)]">
          <p className="text-sm text-[var(--soft)] mb-3">
            {unmatched.length} contact{unmatched.length !== 1 ? "s" : ""} not on Lost City yet.
          </p>
          <button
            onClick={handleSendInvites}
            disabled={inviteSending || unmatched.every((e) => invitedEmails.has(e))}
            className="px-5 py-2 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:bg-[var(--rose)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {inviteSending ? (
              <>
                <span className="w-4 h-4 border-2 border-[var(--void)] border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : unmatched.every((e) => invitedEmails.has(e)) ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Invites Sent
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Send {unmatched.length} Invite{unmatched.length !== 1 ? "s" : ""}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
