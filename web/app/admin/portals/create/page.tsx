"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IdentityStep } from "./steps/IdentityStep";
import { AudienceStep } from "./steps/AudienceStep";
import { BrandingStep } from "./steps/BrandingStep";
import { SectionsStep } from "./steps/SectionsStep";
import { ReviewStep } from "./steps/ReviewStep";
import { VerticalId } from "@/lib/vertical-templates";
import { VisualPresetId } from "@/lib/visual-presets";

type PortalDraft = {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  portal_type: "city" | "event" | "business" | "personal";
  vertical?: VerticalId;
  city?: string;
  neighborhoods: string[];
  categories: string[];
  geo_center?: { lat: number; lng: number };
  geo_radius?: number;
  visual_preset: VisualPresetId;
  primary_color?: string;
  logo_url?: string;
  theme_mode: "light" | "dark";
  sections: Array<{
    slug: string;
    title: string;
    description?: string;
    section_type: "auto" | "curated";
    auto_filter?: Record<string, unknown>;
  }>;
};

const STEPS = [
  { id: 1, name: "Identity", description: "Name and type" },
  { id: 2, name: "Audience", description: "Location and focus" },
  { id: 3, name: "Branding", description: "Visual identity" },
  { id: 4, name: "Sections", description: "Content layout" },
  { id: 5, name: "Review", description: "Launch" },
];

export default function CreatePortalWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [portalDraft, setPortalDraft] = useState<PortalDraft>({
    name: "",
    slug: "",
    tagline: "",
    portal_type: "city",
    neighborhoods: [],
    categories: [],
    visual_preset: "default",
    theme_mode: "dark",
    sections: [],
  });
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (updates: Partial<PortalDraft>) => {
    setPortalDraft((prev) => ({ ...prev, ...updates }));
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleCancel = () => {
    if (confirm("Are you sure you want to cancel? All progress will be lost.")) {
      router.push("/admin/portals");
    }
  };

  const handleComplete = async () => {
    try {
      setError(null);

      // Portal should already exist as draft from Step 1
      if (!portalDraft.id) {
        throw new Error("Portal ID missing");
      }

      // Update status to active
      const res = await fetch(`/api/admin/portals/${portalDraft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to launch portal");
      }

      // Redirect to portal settings
      router.push(`/admin/portals/${portalDraft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch portal");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--void)]">
      {/* Progress Bar */}
      <div className="sticky top-0 z-10 bg-[var(--night)] border-b border-[var(--twilight)]">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-mono text-sm text-[var(--muted)] uppercase tracking-wider">
              Create Portal
            </h1>
            <button
              onClick={handleCancel}
              className="font-mono text-xs text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
            >
              Cancel
            </button>
          </div>

          {/* Step Progress */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
                      currentStep > step.id
                        ? "bg-[var(--coral)] border-[var(--coral)] text-[var(--void)]"
                        : currentStep === step.id
                        ? "border-[var(--coral)] text-[var(--coral)]"
                        : "border-[var(--twilight)] text-[var(--muted)]"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span className="font-mono text-xs font-bold">{step.id}</span>
                    )}
                  </div>
                  <div className="hidden sm:block">
                    <div
                      className={`font-mono text-xs font-medium ${
                        currentStep >= step.id ? "text-[var(--cream)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {step.name}
                    </div>
                    <div className="font-mono text-[0.65rem] text-[var(--muted)]">
                      {step.description}
                    </div>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 ${
                      currentStep > step.id ? "bg-[var(--coral)]" : "bg-[var(--twilight)]"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="font-mono text-sm text-red-400">{error}</p>
          </div>
        )}

        {currentStep === 1 && (
          <IdentityStep
            draft={portalDraft}
            updateDraft={updateDraft}
            onNext={handleNext}
          />
        )}

        {currentStep === 2 && (
          <AudienceStep
            draft={portalDraft}
            updateDraft={updateDraft}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 3 && (
          <BrandingStep
            draft={portalDraft}
            updateDraft={updateDraft}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 4 && (
          <SectionsStep
            draft={portalDraft}
            updateDraft={updateDraft}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}

        {currentStep === 5 && (
          <ReviewStep
            draft={portalDraft}
            onBack={handleBack}
            onLaunch={handleComplete}
          />
        )}
      </div>
    </div>
  );
}
