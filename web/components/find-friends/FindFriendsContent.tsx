"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { FriendSearch } from "@/components/community/FriendSearch";
import { EmailInput } from "./EmailInput";
import { ContactMatchResults, type MatchedProfile } from "./ContactMatchResults";

// Dynamic import QRCodeSVG to reduce initial bundle size
const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })),
  { ssr: false }
);

type Tab = "search" | "import" | "invite";

export function FindFriendsContent() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<Tab>(
    tabParam === "import" || tabParam === "invite" ? tabParam : "search"
  );

  // Import tab state
  const [emailLookupLoading, setEmailLookupLoading] = useState(false);
  const [matchedProfiles, setMatchedProfiles] = useState<MatchedProfile[]>([]);
  const [unmatchedEmails, setUnmatchedEmails] = useState<string[]>([]);
  const [hasResults, setHasResults] = useState(false);

  // Invite tab state
  const [autoFriend, setAutoFriend] = useState(false);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const baseUrl = profile?.username && origin
    ? `${origin}/invite/${profile.username}`
    : "";
  const inviteUrl = autoFriend ? `${baseUrl}?auto=1` : baseUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      showToast("Link copied!", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      showToast("Link copied!", "success");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEmailSubmit = async (emails: string[]) => {
    setEmailLookupLoading(true);
    try {
      const res = await fetch("/api/find-friends/email-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });

      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to look up emails", "error");
        return;
      }

      const data = await res.json();
      setMatchedProfiles(data.matched || []);
      setUnmatchedEmails(data.unmatched || []);
      setHasResults(true);
    } catch {
      showToast("Failed to look up emails", "error");
    } finally {
      setEmailLookupLoading(false);
    }
  };

  const clearResults = () => {
    setMatchedProfiles([]);
    setUnmatchedEmails([]);
    setHasResults(false);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "search",
      label: "Search",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      id: "import",
      label: "Import",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: "invite",
      label: "Invite",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-[var(--cream)] mb-2">Find Friends</h1>
        <p className="text-[var(--muted)] font-mono text-sm">
          Search, import contacts, or share your invite link.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-[var(--dusk)] border border-[var(--twilight)] rounded-lg mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md font-mono text-sm transition-all ${
              activeTab === tab.id
                ? "bg-[var(--coral)] text-[var(--void)] font-medium"
                : "text-[var(--muted)] hover:text-[var(--cream)] hover:bg-[var(--twilight)]/50"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "search" && (
        <FriendSearch />
      )}

      {activeTab === "import" && (
        <div className="space-y-6">
          {/* Email import */}
          <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl p-5">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--soft)] mb-4">
              Email Lookup
            </h3>
            <EmailInput onSubmit={handleEmailSubmit} isLoading={emailLookupLoading} />
          </div>

          {/* Results */}
          {hasResults && (
            <ContactMatchResults
              matched={matchedProfiles}
              unmatched={unmatchedEmails}
              onClear={clearResults}
            />
          )}
        </div>
      )}

      {activeTab === "invite" && (
        <div className="space-y-6">
          {/* QR Code */}
          {inviteUrl && (
            <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl p-6">
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG
                    value={inviteUrl}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>
              <p className="text-center text-[var(--muted)] font-mono text-xs">
                Scan to visit your invite link
              </p>
            </div>
          )}

          {/* URL Display */}
          {inviteUrl && (
            <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl p-4">
              <label className="block text-[var(--muted)] font-mono text-xs uppercase tracking-wider mb-2">
                Your Invite Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="flex-1 bg-[var(--night)] border border-[var(--twilight)] rounded-lg px-3 py-2.5 text-[var(--cream)] font-mono text-sm truncate"
                />
                <button
                  onClick={handleCopy}
                  className="px-4 py-2.5 bg-[var(--twilight)] text-[var(--cream)] rounded-lg font-mono text-sm hover:bg-[var(--twilight)]/80 transition-colors flex-shrink-0"
                >
                  {copied ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Auto-Friend Toggle */}
          <div className="bg-[var(--dusk)] border border-[var(--twilight)] rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="relative flex-shrink-0 mt-0.5">
                <input
                  type="checkbox"
                  checked={autoFriend}
                  onChange={(e) => setAutoFriend(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-6 bg-[var(--twilight)] rounded-full peer-checked:bg-[var(--coral)] transition-colors" />
                <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
              </div>
              <div>
                <span className="block text-[var(--cream)] font-medium text-sm">
                  Automatically add as friend
                </span>
                <span className="block text-[var(--muted)] font-mono text-xs mt-1">
                  Skip the friend request - they&apos;ll be added when they join.
                </span>
              </div>
            </label>
          </div>

          {/* Share button */}
          {inviteUrl && (
            <button
              onClick={handleCopy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--coral)] text-[var(--void)] rounded-xl font-mono text-sm font-medium hover:bg-[var(--rose)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Invite Link
            </button>
          )}
        </div>
      )}
    </div>
  );
}
