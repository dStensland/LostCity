"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import Logo from "@/components/Logo";
import { useAuth } from "@/lib/auth-context";
import { DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";

type InviterProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
};

type Props = {
  params: Promise<{ username: string }>;
};

export default function InvitePage({ params }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [inviter, setInviter] = useState<InviterProfile | null>(null);
  const [relationship, setRelationship] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    async function loadInviter() {
      const { username: u } = await params;
      setUsername(u);

      try {
        const response = await fetch(`/api/users/${u}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError("User not found");
          } else {
            setError("Failed to load profile");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setInviter(data.profile);
        setRelationship(data.relationship);
      } catch {
        setError("Failed to load profile");
      }
      setLoading(false);
    }

    loadInviter();
  }, [params]);

  const handleAddFriend = async () => {
    if (!inviter || !user) return;

    setActionLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/friend-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviter_id: inviter.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send friend request");
        setActionLoading(false);
        return;
      }

      if (data.accepted) {
        setSuccess("You are now friends!");
        setRelationship("friends");
      } else {
        setSuccess("Friend request sent!");
        setRelationship("request_sent");
      }
    } catch {
      setError("Failed to send friend request");
    }
    setActionLoading(false);
  };

  // Get initials for avatar fallback
  const getInitials = (name: string | null, username: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return username.slice(0, 2).toUpperCase();
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[var(--night)] flex items-center justify-center">
        <div className="text-[var(--cream)]">Loading...</div>
      </div>
    );
  }

  if (error && !inviter) {
    return (
      <div className="min-h-screen bg-[var(--night)] flex flex-col items-center justify-center p-4">
        <Logo className="mb-8" />
        <div className="bg-[var(--charcoal)] rounded-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-[var(--cream)] mb-4">
            Invite Not Found
          </h1>
          <p className="text-[var(--clay)] mb-6">
            This invite link is no longer valid or the user doesn&apos;t exist.
          </p>
          <Link
            href={`/${DEFAULT_PORTAL_SLUG}`}
            className="inline-block bg-[var(--coral)] text-[var(--night)] px-6 py-3 rounded font-medium hover:opacity-90"
          >
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  // Logged out view
  if (!user && inviter) {
    return (
      <div className="min-h-screen bg-[var(--night)] flex flex-col items-center justify-center p-4">
        <Logo className="mb-8" />

        <div className="bg-[var(--charcoal)] rounded-lg p-8 max-w-md w-full">
          {/* Inviter Profile */}
          <div className="text-center mb-8">
            {inviter.avatar_url ? (
              <Image
                src={inviter.avatar_url}
                alt={inviter.display_name || inviter.username}
                width={96}
                height={96}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-[var(--coral)] flex items-center justify-center text-[var(--night)] text-2xl font-bold">
                {getInitials(inviter.display_name, inviter.username)}
              </div>
            )}
            <h2 className="text-xl font-bold text-[var(--cream)]">
              {inviter.display_name || `@${inviter.username}`}
            </h2>
            <p className="text-[var(--clay)]">@{inviter.username}</p>
            {inviter.bio && (
              <p className="text-[var(--cream)] text-sm mt-2 opacity-80">
                {inviter.bio}
              </p>
            )}
          </div>

          {/* Invitation Message */}
          <div className="text-center mb-8">
            <p className="text-[var(--cream)] text-lg">
              <span className="font-medium">
                {inviter.display_name || `@${inviter.username}`}
              </span>{" "}
              invited you to join Lost City
            </p>
            <p className="text-[var(--clay)] text-sm mt-2">
              Discover the best events happening in Atlanta
            </p>
          </div>

          {/* Auth Buttons */}
          <div className="space-y-3">
            <Link
              href={`/auth/signup?redirect=/invite/${username}/complete&inviter=${username}`}
              className="block w-full bg-[var(--coral)] text-[var(--night)] py-3 rounded font-medium text-center hover:opacity-90"
            >
              Sign Up
            </Link>
            <Link
              href={`/auth/login?redirect=/invite/${username}/complete&inviter=${username}`}
              className="block w-full bg-transparent border border-[var(--cream)] text-[var(--cream)] py-3 rounded font-medium text-center hover:bg-[var(--cream)]/10"
            >
              Log In
            </Link>
          </div>

          <p className="text-center text-[var(--clay)] text-sm mt-6">
            Already have an account?{" "}
            <Link
              href={`/auth/login?redirect=/invite/${username}/complete&inviter=${username}`}
              className="text-[var(--coral)] hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Logged in view
  if (user && inviter) {
    // Same user
    if (user.id === inviter.id) {
      return (
        <div className="min-h-screen bg-[var(--night)] flex flex-col items-center justify-center p-4">
          <Logo className="mb-8" />
          <div className="bg-[var(--charcoal)] rounded-lg p-8 max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-[var(--cream)] mb-4">
              This is your invite link!
            </h1>
            <p className="text-[var(--clay)] mb-6">
              Share this link with friends to invite them to Lost City.
            </p>
            <Link
              href="/settings"
              className="inline-block bg-[var(--coral)] text-[var(--night)] px-6 py-3 rounded font-medium hover:opacity-90"
            >
              Copy Your Invite Link
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[var(--night)] flex flex-col items-center justify-center p-4">
        <Logo className="mb-8" />

        <div className="bg-[var(--charcoal)] rounded-lg p-8 max-w-md w-full">
          {/* Inviter Profile */}
          <div className="text-center mb-8">
            {inviter.avatar_url ? (
              <Image
                src={inviter.avatar_url}
                alt={inviter.display_name || inviter.username}
                width={96}
                height={96}
                className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto mb-4 bg-[var(--coral)] flex items-center justify-center text-[var(--night)] text-2xl font-bold">
                {getInitials(inviter.display_name, inviter.username)}
              </div>
            )}
            <h2 className="text-xl font-bold text-[var(--cream)]">
              {inviter.display_name || `@${inviter.username}`}
            </h2>
            <p className="text-[var(--clay)]">@{inviter.username}</p>
          </div>

          {/* Status/Action */}
          <div className="text-center">
            {error && (
              <p className="text-red-400 mb-4">{error}</p>
            )}
            {success && (
              <p className="text-green-400 mb-4">{success}</p>
            )}

            {relationship === "friends" && (
              <>
                <p className="text-[var(--cream)] mb-4">
                  You&apos;re already friends with{" "}
                  {inviter.display_name || `@${inviter.username}`}!
                </p>
                <Link
                  href={`/profile/${inviter.username}`}
                  className="inline-block bg-[var(--coral)] text-[var(--night)] px-6 py-3 rounded font-medium hover:opacity-90"
                >
                  View Profile
                </Link>
              </>
            )}

            {relationship === "request_sent" && (
              <>
                <p className="text-[var(--cream)] mb-4">
                  Friend request sent to{" "}
                  {inviter.display_name || `@${inviter.username}`}
                </p>
                <Link
                  href={`/${DEFAULT_PORTAL_SLUG}`}
                  className="inline-block bg-[var(--coral)] text-[var(--night)] px-6 py-3 rounded font-medium hover:opacity-90"
                >
                  Explore Events
                </Link>
              </>
            )}

            {relationship === "request_received" && (
              <>
                <p className="text-[var(--cream)] mb-4">
                  {inviter.display_name || `@${inviter.username}`} wants to be friends!
                </p>
                <button
                  onClick={handleAddFriend}
                  disabled={actionLoading}
                  className="w-full bg-[var(--coral)] text-[var(--night)] py-3 rounded font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading ? "Accepting..." : "Accept Friend Request"}
                </button>
              </>
            )}

            {!relationship && !success && (
              <>
                <p className="text-[var(--cream)] mb-4">
                  {inviter.display_name || `@${inviter.username}`} invited you to be friends
                </p>
                <button
                  onClick={handleAddFriend}
                  disabled={actionLoading}
                  className="w-full bg-[var(--coral)] text-[var(--night)] py-3 rounded font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {actionLoading ? "Sending..." : "Add as Friend"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
