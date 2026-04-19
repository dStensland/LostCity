"use client";

import { use } from "react";
import { usePlan } from "@/lib/hooks/useUserPlans";
import { notFound } from "next/navigation";

type ProfileShape = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
} | null;

type InviteeShape = {
  user_id: string;
  rsvp_status: string;
  profile: ProfileShape;
};

export default function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = usePlan(id);

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-sm text-[var(--muted)]">Loading plan…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-sm text-[var(--coral)]">Something went wrong.</p>
      </main>
    );
  }

  if (!data?.plan) {
    notFound();
  }

  const plan = data.plan;
  const invitees = (data.invitees as InviteeShape[]) ?? [];

  return (
    <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-[var(--cream)]">
          {plan.title ?? "Untitled plan"}
        </h1>
        <p className="text-sm text-[var(--soft)] mt-1 font-mono">
          {new Date(plan.starts_at).toLocaleString()} · {plan.status} · {plan.visibility}
        </p>
        {plan.note && (
          <p className="text-sm text-[var(--soft)] mt-3">{plan.note}</p>
        )}
      </header>

      <section>
        <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          Going ({invitees.filter((i) => i.rsvp_status === "going").length})
        </h2>
        <ul className="mt-2 space-y-1">
          {invitees.map((i) => (
            <li key={i.user_id} className="text-sm text-[var(--cream)]">
              {i.profile?.display_name ?? i.profile?.username ?? "Someone"} ·{" "}
              <span className="text-[var(--muted)] font-mono text-xs">{i.rsvp_status}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
