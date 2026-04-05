"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

type VolunteerProfileResponse = {
  causes: string[];
  skills: string[];
  commitment_preference: "drop_in" | "ongoing" | "lead_role" | "mixed" | null;
  mobility_constraints: string | null;
  languages: string[];
};

const CAUSE_OPTIONS = [
  { value: "civic_engagement", label: "Civic engagement" },
  { value: "health_wellness", label: "Health and public health" },
  { value: "environment", label: "Environment" },
  { value: "food_security", label: "Food security" },
  { value: "youth_education", label: "Youth education" },
  { value: "family_support", label: "Family support" },
  { value: "education", label: "Education" },
  { value: "housing", label: "Housing" },
  { value: "immigrant_refugee", label: "Immigrant and refugee support" },
  { value: "legal_aid", label: "Legal aid" },
] as const;

const SKILL_OPTIONS = [
  { value: "mentoring", label: "Mentoring" },
  { value: "reading", label: "Reading" },
  { value: "tutoring", label: "Tutoring" },
  { value: "advocacy", label: "Advocacy" },
  { value: "journalism", label: "Journalism" },
  { value: "leadership", label: "Leadership" },
  { value: "outdoors", label: "Outdoors" },
  { value: "food_service", label: "Food service" },
  { value: "community_science", label: "Community science" },
] as const;

const COMMITMENT_OPTIONS = [
  { value: "mixed", label: "Mixed" },
  { value: "ongoing", label: "Ongoing" },
  { value: "lead_role", label: "Lead" },
  { value: "drop_in", label: "Drop-in" },
] as const;

function toggleValue(current: string[], value: string) {
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];
}

export function VolunteerProfilePanel() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [causes, setCauses] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [commitmentPreference, setCommitmentPreference] = useState<string>("mixed");
  const [mobilityConstraints, setMobilityConstraints] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);
  const requiresSignIn = !authLoading && !user;

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    const controller = new AbortController();

    fetch("/api/me/volunteer-profile", {
      signal: controller.signal,
      credentials: "include",
    })
      .then((res) => {
        if (res.status === 401) {
          setStatus("error");
          setMessage("Sign in to personalize volunteer matches.");
          return null;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<VolunteerProfileResponse>;
      })
      .then((json) => {
        if (!json) return;
        setCauses(json.causes || []);
        setSkills(json.skills || []);
        setLanguages(json.languages || []);
        setCommitmentPreference(json.commitment_preference || "mixed");
        setMobilityConstraints(json.mobility_constraints || "");
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
        setMessage("Could not load volunteer preferences.");
      });

    return () => controller.abort();
  }, [authLoading, user]);

  async function saveProfile() {
    setMessage(null);

    if (!user) {
      setMessage("Sign in to save volunteer preferences.");
      return;
    }

    const response = await fetch("/api/me/volunteer-profile", {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        causes,
        skills,
        languages,
        commitment_preference: commitmentPreference,
        mobility_constraints: mobilityConstraints || null,
      }),
    });

    if (response.status === 401) {
      setMessage("Sign in to save volunteer preferences.");
      return;
    }

    if (!response.ok) {
      setMessage("Could not save volunteer preferences.");
      return;
    }

    setMessage("Volunteer fit updated.");
    startTransition(() => {
      router.refresh();
    });
  }

  if (requiresSignIn) {
    return (
      <div className="rounded-3xl border border-[#E5E4E1] bg-white p-6">
        <p className="text-sm text-[#6D6C6A]">Sign in to personalize volunteer matches.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-3xl border border-[#E5E4E1] bg-white p-6">
        <p className="text-sm text-[#6D6C6A]">{message || "Volunteer personalization unavailable."}</p>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-[#E5E4E1] bg-white p-6">
      <p className="text-xs font-mono uppercase tracking-[0.14em] text-[#2D6A4F]">
        Personalize matches
      </p>
      <h2 className="mt-2 text-xl font-semibold text-[#1A1918]">
        Tell HelpATL what kind of volunteer work fits you
      </h2>
      <p className="mt-2 text-sm text-[#6D6C6A]">
        We use this profile to rank commitment roles and explain why they match.
      </p>

      {status === "loading" ? (
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-[#F3F1ED]" />
      ) : (
        <>
          <div className="mt-5">
            <p className="text-sm font-medium text-[#1A1918]">Causes</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CAUSE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCauses((current) => toggleValue(current, option.value))}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    causes.includes(option.value)
                      ? "bg-[#2D6A4F] text-white"
                      : "bg-[#F3F1ED] text-[#4D4B47]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-[#1A1918]">Skills</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSkills((current) => toggleValue(current, option.value))}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    skills.includes(option.value)
                      ? "bg-[#2D6A4F] text-white"
                      : "bg-[#F3F1ED] text-[#4D4B47]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium text-[#1A1918]">Commitment preference</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {COMMITMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCommitmentPreference(option.value)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    commitmentPreference === option.value
                      ? "bg-[#2D6A4F] text-white"
                      : "bg-[#F3F1ED] text-[#4D4B47]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-[#1A1918]">Languages</span>
              <input
                type="text"
                value={languages.join(", ")}
                onChange={(event) =>
                  setLanguages(
                    event.target.value
                      .split(",")
                      .map((item) => item.trim().toLowerCase())
                      .filter(Boolean),
                  )
                }
                placeholder="english, spanish"
                className="mt-2 w-full rounded-xl border border-[#E5E4E1] px-4 py-2.5 text-sm text-[#1A1918] outline-none focus:border-[#2D6A4F]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[#1A1918]">Mobility or access needs</span>
              <input
                type="text"
                value={mobilityConstraints}
                onChange={(event) => setMobilityConstraints(event.target.value)}
                placeholder="Need remote or low-lift roles"
                className="mt-2 w-full rounded-xl border border-[#E5E4E1] px-4 py-2.5 text-sm text-[#1A1918] outline-none focus:border-[#2D6A4F]"
              />
            </label>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={saveProfile}
              disabled={isPending}
              className="rounded-xl bg-[#2D6A4F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#255740] disabled:opacity-70"
            >
              {isPending ? "Saving..." : "Save volunteer fit"}
            </button>
            {message && <p className="text-sm text-[#6D6C6A]">{message}</p>}
          </div>
        </>
      )}
    </section>
  );
}
