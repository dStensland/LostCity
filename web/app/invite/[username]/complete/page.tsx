"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";

type Props = {
  params: Promise<{ username: string }>;
};

export default function InviteCompletePage({ params }: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "accepted" | "error">("loading");
  const [message, setMessage] = useState("");
  const [inviterName, setInviterName] = useState("");

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
        setInviterName(profileData.profile.display_name || `@${profileData.profile.username}`);

        // Check if same user
        if (profileData.profile.id === user.id) {
          setStatus("error");
          setMessage("This is your own invite link!");
          return;
        }

        // Already friends
        if (profileData.relationship === "friends") {
          setStatus("success");
          setMessage(`You're already friends with ${profileData.profile.display_name || `@${profileData.profile.username}`}!`);
          return;
        }

        // Create friend request
        const response = await fetch("/api/friend-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviter_username: username }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.error === "You are already friends") {
            setStatus("success");
            setMessage(`You're already friends with ${inviterName}!`);
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
          setMessage(`You are now friends with ${inviterName}!`);
        } else {
          setStatus("success");
          setMessage(`Friend request sent to ${inviterName}!`);
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
            <div className="w-16 h-16 bg-[var(--coral)]/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-[var(--coral)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
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
          href="/"
          className="inline-block bg-[var(--coral)] text-[var(--night)] px-6 py-3 rounded font-medium hover:opacity-90"
        >
          Explore Events
        </Link>
      </div>
    </div>
  );
}
