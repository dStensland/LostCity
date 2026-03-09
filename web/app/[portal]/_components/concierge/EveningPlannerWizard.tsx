"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useMemo } from "react";
import { EVENING_VIBES, type EveningVibe } from "@/lib/concierge/evening-vibes";

interface EveningPlannerWizardProps {
  onSubmit: (params: { date: string; vibe: EveningVibe; partySize: number }) => void;
}

type Step = "when" | "vibe" | "party_size";

const STEPS: Step[] = ["when", "vibe", "party_size"];

function getTodayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function EveningPlannerWizard({ onSubmit }: EveningPlannerWizardProps) {
  const [step, setStep] = useState<Step>("when");
  const [date, setDate] = useState<string>(getTodayDate());
  const [vibe, setVibe] = useState<EveningVibe | null>(null);
  const [partySize, setPartySize] = useState(2);

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    []
  );
  const tomorrowLabel = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }, []);

  const handleDateSelect = (d: string) => {
    setDate(d);
    setStep("vibe");
  };

  const handleVibeSelect = (v: EveningVibe) => {
    setVibe(v);
    setStep("party_size");
  };

  const handleSubmit = () => {
    if (!vibe) return;
    onSubmit({ date, vibe, partySize });
  };

  const currentStepIndex = STEPS.indexOf(step);

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                step === s
                  ? "bg-[var(--hotel-champagne)] scale-125"
                  : i < currentStepIndex
                  ? "bg-[var(--hotel-charcoal)]"
                  : "bg-[var(--hotel-sand)]"
              }`}
            />
            {i < 2 && (
              <div
                className={`w-10 h-px transition-colors duration-300 ${
                  i < currentStepIndex
                    ? "bg-[var(--hotel-charcoal)]"
                    : "bg-[var(--hotel-sand)]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: When */}
      {step === "when" && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center">
            <h3 className="font-display text-3xl text-[var(--hotel-charcoal)]">When?</h3>
            <p className="text-sm font-body text-[var(--hotel-stone)] mt-1">
              Pick a night for your evening out
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleDateSelect(getTodayDate())}
              className="w-full p-5 rounded-xl border border-[var(--hotel-sand)] bg-white text-left hover:border-[var(--hotel-champagne)] hover:bg-[var(--hotel-champagne)]/5 transition-colors flex items-baseline justify-between"
            >
              <span className="font-body font-medium text-base text-[var(--hotel-charcoal)]">Tonight</span>
              <span className="text-sm font-body text-[var(--hotel-stone)]">{todayLabel}</span>
            </button>

            <button
              onClick={() => handleDateSelect(getTomorrowDate())}
              className="w-full p-5 rounded-xl border border-[var(--hotel-sand)] bg-white text-left hover:border-[var(--hotel-champagne)] hover:bg-[var(--hotel-champagne)]/5 transition-colors flex items-baseline justify-between"
            >
              <span className="font-body font-medium text-base text-[var(--hotel-charcoal)]">Tomorrow</span>
              <span className="text-sm font-body text-[var(--hotel-stone)]">{tomorrowLabel}</span>
            </button>

            <div className="pt-2">
              <label className="text-xs font-body text-[var(--hotel-stone)] uppercase tracking-wider mb-1.5 block">
                Or pick a date
              </label>
              <input
                type="date"
                min={getTodayDate()}
                value={date}
                onChange={(e) => handleDateSelect(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--hotel-sand)] bg-white text-[var(--hotel-charcoal)] font-body text-sm focus:outline-none focus:border-[var(--hotel-champagne)] transition-colors"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Vibe */}
      {step === "vibe" && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center">
            <h3 className="font-display text-3xl text-[var(--hotel-charcoal)]">What vibe?</h3>
            <p className="text-sm font-body text-[var(--hotel-stone)] mt-1">
              Set the tone for your evening
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {EVENING_VIBES.map((v) => {
              const isSelected = vibe === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => handleVibeSelect(v.id)}
                  className={`w-full h-20 rounded-xl overflow-hidden relative text-left transition-all ${
                    isSelected
                      ? "ring-2 ring-[var(--hotel-champagne)] ring-offset-2 ring-offset-[var(--hotel-ivory)]"
                      : "hover:opacity-95"
                  }`}
                >
                  {/* Mood photo */}
                  <img
                    src={v.photoUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
                  {/* Champagne tint overlay on selected */}
                  {isSelected && (
                    <div className="absolute inset-0 bg-[var(--hotel-champagne)]/15" />
                  )}
                  {/* Content */}
                  <div className="relative z-10 h-full flex flex-col justify-center px-4">
                    <span className="font-display text-xl text-white font-semibold leading-tight">
                      {v.label}
                    </span>
                    <span className="font-body text-xs text-white/70 mt-0.5">
                      {v.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setStep("when")}
            className="text-sm font-body text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
          >
            &larr; Back
          </button>
        </div>
      )}

      {/* Step 3: Party size */}
      {step === "party_size" && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center">
            <h3 className="font-display text-3xl text-[var(--hotel-charcoal)]">How many?</h3>
            <p className="text-sm font-body text-[var(--hotel-stone)] mt-1">
              Optional — helps with venue picks
            </p>
          </div>

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setPartySize(Math.max(1, partySize - 1))}
              className="w-14 h-14 rounded-full border border-[var(--hotel-sand)] bg-white flex items-center justify-center text-xl font-body text-[var(--hotel-charcoal)] hover:bg-[var(--hotel-cream)] transition-colors"
            >
              &minus;
            </button>
            <span className="font-display text-5xl text-[var(--hotel-charcoal)] w-16 text-center tabular-nums">
              {partySize}
            </span>
            <button
              onClick={() => setPartySize(Math.min(8, partySize + 1))}
              className="w-14 h-14 rounded-full border border-[var(--hotel-sand)] bg-white flex items-center justify-center text-xl font-body text-[var(--hotel-charcoal)] hover:bg-[var(--hotel-cream)] transition-colors"
            >
              +
            </button>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleSubmit}
              className="w-full py-4 rounded-full bg-[var(--hotel-champagne)] text-[var(--hotel-charcoal)] font-body font-semibold text-base shadow-lg hover:shadow-xl transition-all"
            >
              Build My Evening
            </button>

            <button
              onClick={() => {
                if (vibe) onSubmit({ date, vibe, partySize: 2 });
              }}
              className="w-full py-2 text-sm font-body text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
            >
              Skip this step
            </button>
          </div>

          <button
            onClick={() => setStep("vibe")}
            className="text-sm font-body text-[var(--hotel-stone)] hover:text-[var(--hotel-charcoal)] transition-colors"
          >
            &larr; Back
          </button>
        </div>
      )}
    </div>
  );
}
