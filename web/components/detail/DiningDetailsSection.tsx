"use client";

import { memo } from "react";
import { Clock, CalendarCheck, UsersThree } from "@phosphor-icons/react";
import type { PlaceDiningDetails, PlaceProfile } from "@/lib/types/places";

interface DiningDetailsSectionProps {
  diningData: PlaceDiningDetails;
  placeProfile: PlaceProfile | null;
}

function hasRelevantData(diningData: PlaceDiningDetails): boolean {
  return !!(
    (diningData.cuisine && diningData.cuisine.length > 0) ||
    diningData.accepts_reservations != null
  );
}

function deriveReservationLabel(
  accepts: boolean | null,
  recommended: boolean | null
): string {
  if (accepts === false) return "Walk-in";
  if (accepts === true) return "Required";
  if (recommended === true) return "Recommended";
  return "Walk-in";
}

function deriveReservationSubText(
  accepts: boolean | null,
  recommended: boolean | null
): string | null {
  if (accepts === true) return "Book 2–3 weeks out";
  if (recommended === true) return "Recommended ahead";
  return null;
}

function deriveServiceStyle(serviceStyle: string | null | undefined): string | null {
  if (!serviceStyle) return null;
  // Capitalise first letter, rest as-is
  return serviceStyle.charAt(0).toUpperCase() + serviceStyle.slice(1);
}

function buildServicePills(d: PlaceDiningDetails): string[] {
  const pills: string[] = [];
  if (d.serves_breakfast) pills.push("Breakfast");
  if (d.serves_brunch) pills.push("Brunch");
  if (d.serves_lunch) pills.push("Lunch");
  if (d.serves_dinner) pills.push("Dinner");
  if (d.dine_in) pills.push("Dine-in");
  if (d.takeout) pills.push("Takeout");
  if (d.delivery) pills.push("Delivery");
  if (d.outdoor_seating) pills.push("Outdoor Seating");
  return pills;
}

function buildDietaryPills(d: PlaceDiningDetails): string[] {
  const pills: string[] = [];
  const raw = d.dietary_options;

  // dietary_options is typed as string | null in PlaceDiningDetails
  // but the task spec notes it could be JSONB; handle both gracefully
  if (raw) {
    if (typeof raw === "string") {
      // Could be a comma-separated string or JSON array serialised as string
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          pills.push(...parsed.map(String));
        } else {
          pills.push(...raw.split(",").map((s) => s.trim()).filter(Boolean));
        }
      } catch {
        pills.push(...raw.split(",").map((s) => s.trim()).filter(Boolean));
      }
    } else if (Array.isArray(raw)) {
      pills.push(...(raw as string[]));
    }
  }

  // Boolean fallbacks — avoid duplicating if already in pills
  const lowerPills = pills.map((p) => p.toLowerCase());
  if (d.serves_vegetarian && !lowerPills.includes("vegetarian")) pills.push("Vegetarian");
  if (d.serves_vegan && !lowerPills.includes("vegan")) pills.push("Vegan");
  if (d.diabetic_friendly && !lowerPills.includes("diabetic friendly")) pills.push("Diabetic Friendly");
  if (
    d.heart_healthy_options &&
    !lowerPills.includes("heart healthy") &&
    !lowerPills.includes("heart-healthy")
  )
    pills.push("Heart Healthy");
  if (d.low_sodium_options && !lowerPills.includes("low sodium")) pills.push("Low Sodium");

  // Normalise GF label
  return pills.map((p) =>
    p.toLowerCase() === "gluten-free" || p.toLowerCase() === "gluten free" ? "GF" : p
  );
}

function deriveCapacityVibe(capacity: number): string {
  if (capacity < 50) return "Intimate setting";
  if (capacity < 100) return "Cozy space";
  if (capacity < 200) return "Mid-size venue";
  return "Spacious";
}

export const DiningDetailsSection = memo(function DiningDetailsSection({
  diningData,
  placeProfile,
}: DiningDetailsSectionProps) {
  if (!hasRelevantData(diningData)) return null;

  const hasDuration =
    diningData.meal_duration_min_minutes != null ||
    diningData.meal_duration_max_minutes != null;

  const hasReservation = diningData.accepts_reservations != null;

  const reservationLabel = deriveReservationLabel(
    diningData.accepts_reservations,
    diningData.reservation_recommended
  );
  const reservationSubText = deriveReservationSubText(
    diningData.accepts_reservations,
    diningData.reservation_recommended
  );
  const serviceStyleLabel = deriveServiceStyle(diningData.service_style);

  const cuisine =
    Array.isArray(diningData.cuisine) && diningData.cuisine.length > 0
      ? diningData.cuisine
      : [];

  const servicePills = buildServicePills(diningData);
  const dietaryPills = buildDietaryPills(diningData);

  const capacity = placeProfile?.capacity ?? null;

  // Normalise menu_highlights — typed as string | null but could be serialised JSON
  let menuHighlights: string | null = null;
  if (diningData.menu_highlights) {
    if (typeof diningData.menu_highlights === "string") {
      try {
        const parsed = JSON.parse(diningData.menu_highlights);
        menuHighlights =
          typeof parsed === "string"
            ? parsed
            : Array.isArray(parsed)
            ? (parsed as string[]).join(", ")
            : JSON.stringify(parsed);
      } catch {
        menuHighlights = diningData.menu_highlights;
      }
    } else if (Array.isArray(diningData.menu_highlights)) {
      menuHighlights = (diningData.menu_highlights as string[]).join(", ");
    }
  }

  const showServiceCards = hasDuration || hasReservation;

  return (
    <div>
      {/* 1. Service info cards (horizontal pair) */}
      {showServiceCards && (
        <div className="flex gap-3 mt-3">
          {hasDuration && (
            <div className="flex-1 flex flex-col gap-1.5 rounded-lg bg-[var(--dusk)] p-3">
              <Clock
                size={16}
                weight="duotone"
                style={{ color: "#FF6B7A" }}
                aria-hidden="true"
              />
              <p className="text-2xs font-semibold text-[var(--cream)] uppercase tracking-[0.1em] font-mono">
                Meal Duration
              </p>
              <p className="text-sm font-medium text-[var(--cream)]">
                {diningData.meal_duration_min_minutes != null &&
                diningData.meal_duration_max_minutes != null
                  ? `${diningData.meal_duration_min_minutes}–${diningData.meal_duration_max_minutes} min`
                  : diningData.meal_duration_min_minutes != null
                  ? `${diningData.meal_duration_min_minutes}+ min`
                  : `Up to ${diningData.meal_duration_max_minutes} min`}
              </p>
              {serviceStyleLabel && (
                <p className="text-xs text-[var(--muted)] leading-snug">
                  {serviceStyleLabel} pace
                </p>
              )}
            </div>
          )}

          {hasReservation && (
            <div className="flex-1 flex flex-col gap-1.5 rounded-lg bg-[var(--dusk)] p-3">
              <CalendarCheck
                size={16}
                weight="duotone"
                style={{ color: "#FF6B7A" }}
                aria-hidden="true"
              />
              <p className="text-2xs font-semibold text-[var(--cream)] uppercase tracking-[0.1em] font-mono">
                Reservations
              </p>
              <p className="text-sm font-medium text-[var(--cream)]">{reservationLabel}</p>
              {reservationSubText && (
                <p className="text-xs text-[var(--muted)] leading-snug">{reservationSubText}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Cuisine chips */}
      {cuisine.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[var(--cream)] mb-2">Cuisine</p>
          <div className="flex flex-wrap gap-1.5">
            {cuisine.map((c) => (
              <span
                key={c}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--dusk)] text-[var(--cream)] border border-[var(--twilight)]/60"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 3. Service pills */}
      {servicePills.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[var(--cream)] mb-2">Service</p>
          <div className="flex flex-wrap gap-1.5">
            {servicePills.map((pill) => (
              <span
                key={pill}
                className="px-2.5 py-1 rounded-full text-xs font-medium border border-[var(--twilight)] text-[var(--soft)]"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 4. Dietary options */}
      {dietaryPills.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[var(--cream)] mb-2">Dietary Options</p>
          <div className="flex flex-wrap gap-1.5">
            {dietaryPills.map((pill) => (
              <span
                key={pill}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: "#00D9A01A",
                  color: "#00D9A0",
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 5. Menu highlights */}
      {menuHighlights && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[var(--cream)] mb-2">Menu Highlights</p>
          <p className="text-sm text-[var(--soft)] leading-relaxed">{menuHighlights}</p>
        </div>
      )}

      {/* 6. Capacity */}
      {capacity != null && (
        <div className="flex items-center gap-2 mt-4">
          <UsersThree
            size={14}
            weight="duotone"
            className="text-[var(--muted)] flex-shrink-0"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--soft)]">
            Capacity: {capacity} seats
            <span className="text-[var(--muted)]">
              {" "}
              · {deriveCapacityVibe(capacity)}
            </span>
          </p>
        </div>
      )}
    </div>
  );
});

export type { DiningDetailsSectionProps };
