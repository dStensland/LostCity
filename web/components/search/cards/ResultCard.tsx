"use client";

import type { RankedCandidate } from "@/lib/search/ranking/types";
import { EventResultCard } from "./EventResultCard";
import { VenueResultCard } from "./VenueResultCard";
import { OrganizerResultCard } from "./OrganizerResultCard";
import { SeriesResultCard } from "./SeriesResultCard";
import { FestivalResultCard } from "./FestivalResultCard";
import { ProgramResultCard } from "./ProgramResultCard";
import { NeighborhoodResultCard } from "./NeighborhoodResultCard";
import { CategoryResultCard } from "./CategoryResultCard";

interface ResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  isSaved?: boolean;
}

export function ResultCard({ candidate, variant, isSaved }: ResultCardProps) {
  switch (candidate.type) {
    case "event":
      return <EventResultCard candidate={candidate} variant={variant} isSaved={isSaved} />;
    case "venue":
      return <VenueResultCard candidate={candidate} variant={variant} />;
    case "organizer":
      return <OrganizerResultCard candidate={candidate} variant={variant} />;
    case "series":
      return <SeriesResultCard candidate={candidate} variant={variant} isSaved={isSaved} />;
    case "festival":
      return <FestivalResultCard candidate={candidate} variant={variant} />;
    case "program":
      return <ProgramResultCard candidate={candidate} variant={variant} />;
    case "neighborhood":
      return <NeighborhoodResultCard candidate={candidate} variant={variant} />;
    case "category":
      return <CategoryResultCard candidate={candidate} variant={variant} />;
    default:
      return null;
  }
}
