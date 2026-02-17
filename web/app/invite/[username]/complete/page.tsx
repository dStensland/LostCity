"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import Confetti from "@/components/ui/Confetti";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import PageFooter from "@/components/PageFooter";

type Props = {
  params: Promise<{ username: string }>;
};

export default function InviteCompletePage({ params }: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "accepted" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function completeInvite() {
      if (authLoading) return;

      if (!user) {
        // Not logged in - redirect to invite page
        const { username } = await params;
        router.replace(`/invite/${username}`);
        return;
      }

      const { username } = await params;

      try {
        // Get inviter profile
        const profileResponse = await fetch(`/api/users/${username}`);
        if (!profileResponse.ok) {
          setStatus("error");
          setMessage("Inviter not found");
          return;
        }

        const profileData = await profileResponse.json();
        const displayName = profileData.profile.display_name || `@${profileData.profile.username}`;

        // Check if same user
        if (profileData.profile.id === user.id) {
          setStatus("error");
          setMessage("This is your own invite link!");
          return;
        }

        // Already friends
        if (profileData.relationship === "friends") {
          setStatus("success");
          setMessage(`You're already friends with ${displayName}!`);
          return;
        }

        // Check if auto-friend is enabled (stored in localStorage from invite page)
        const autoFriendInviter = localStorage.getItem("auto_friend_inviter");
        const shouldAutoFriend = autoFriendInviter === username;

        // Clear the localStorage entry
        if (autoFriendInviter) {
          localStorage.removeItem("auto_friend_inviter");
        }

        // Create friend request (with auto_accept if enabled)
        const response = await fetch("/api/friend-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviter_username: username,
            auto_accept: shouldAutoFriend,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.error === "You are already friends") {
            setStatus("success");
            setMessage(`You're already friends with ${displayName}!`);
          } else if (data.error === "Friend request already pending") {
            setStatus("success");
            setMessage("Friend request already sent!");
          } else {
            setStatus("error");
            setMessage(data.error || "Failed to send friend request");
          }
          return;
        }

        if (data.accepted) {
          setStatus("accepted");
          setMessage(`You are now friends with ${displayName}!`);
        } else {
          setStatus("success");
          setMessage(`Friend request sent to ${displayName}!`);
        }
      } catch {
        setStatus("error");
        setMessage("Something went wrong");
      }
    }

    completeInvite();
  }, [user, authLoading, params, router]);

  if (status === "loading" || authLoading) {
    return (
      <div className="min-h-screen bg-[var(--night)] flex items-center justify-center">
        <div className="text-center">
          <Logo className="mb-8 mx-auto" />
          <div className="text-[var(--cream)]">Setting up your connection...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--night)] flex flex-col items-center justify-center p-4">
      <Logo className="mb-8" />

      <div className="bg-[var(--charcoal)] rounded-lg p-8 max-w-md w-full text-center">
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--cream)] mb-2">
              Request Sent!
            </h1>
            <p className="text-[var(--clay)] mb-6">{message}</p>
          </>
        )}

        {status === "accepted" && (
          <>
            <Confetti isActive duration={3000} />
            <div className="flex items-center justify-center -space-x-2 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[var(--coral)] to-[var(--neon-magenta)] rounded-full flex items-center justify-center border-2 border-[var(--dusk)] shadow-lg shadow-[var(--coral)]/20">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="w-16 h-16 bg-gradient-to-br from-[var(--neon-cyan)] to-[var(--coral)] rounded-full flex items-center justify-center border-2 border-[var(--dusk)] shadow-lg shadow-[var(--neon-cyan)]/20">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[var(--cream)] mb-2">
              You&apos;re Friends!
            </h1>
            <p className="text-[var(--clay)] mb-6">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--cream)] mb-2">
              Oops!
            </h1>
            <p className="text-[var(--clay)] mb-6">{message}</p>
          </>
        )}

        <Link
          href={`/${DEFAULT_PORTAL_SLUG}`}
          className="inline-block bg-[var(--coral)] text-[var(--night)] px-6 py-3 rounded font-medium hover:opacity-90"
        >
          Explore Events
        </Link>
      </div>
      <PageFooter />
    </div>
  );
}
