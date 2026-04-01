"use client";

import { useAuth } from "@/lib/auth-context";
import { useFriendRequests } from "@/lib/hooks/useFriendRequests";
import { PendingRequests } from "@/components/community/PendingRequests";
import CrewBoard, { useCrewBoardEventIds } from "@/components/your-people/CrewBoard";
import FriendRadarCarousel from "@/components/your-people/FriendRadarCarousel";
import LatelyAccordion from "@/components/your-people/LatelyAccordion";
import FindFriendsSection from "@/components/your-people/FindFriendsSection";
import { useCrewBoard } from "@/lib/hooks/useCrewBoard";
import Link from "next/link";

export default function YourPeoplePage() {
  const { user } = useAuth();
  const { pendingRequests, isLoading: requestsLoading } = useFriendRequests({ type: "received" });
  const { friendCount, isLoading: crewLoading } = useCrewBoard();
  const crewEventIds = useCrewBoardEventIds();

  if (!user) {
    return <UnauthenticatedView />;
  }

  if (requestsLoading || crewLoading) {
    return (
      <div className="space-y-6">
        <PageHeader />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    );
  }

  const isLowFriendCount = friendCount < 3;

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle={friendCount > 0 ? `${friendCount} friend${friendCount !== 1 ? "s" : ""}` : undefined}
      />

      {/* Friend Requests — always first when present */}
      {pendingRequests.length > 0 && <PendingRequests requests={pendingRequests} />}

      {/* Adaptive ordering: low friend count → show Find Friends first */}
      {isLowFriendCount ? (
        <>
          <FindFriendsSection />
          <CrewBoard />
        </>
      ) : (
        <>
          <CrewBoard />
          <FriendRadarCarousel excludeEventIds={crewEventIds} />
          <LatelyAccordion />
          <FindFriendsSection />
        </>
      )}
    </div>
  );
}

function PageHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--cream)] tracking-tight">Your People</h1>
      {subtitle && (
        <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

function UnauthenticatedView() {
  return (
    <div className="space-y-6">
      <PageHeader />
      <div className="relative glass p-6 rounded-xl text-center border border-[var(--twilight)]">
        <h3 className="text-lg font-medium text-[var(--cream)] mb-2">See what your people are up to</h3>
        <p className="text-sm text-[var(--muted)] mb-5 max-w-sm mx-auto">
          Find out where your friends are going and join them in one tap.
        </p>
        <Link
          href="/auth/login?redirect=/your-people"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:brightness-110 transition-all"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
