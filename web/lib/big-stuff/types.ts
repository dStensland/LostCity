import type { BigStuffItem } from "@/lib/city-pulse/loaders/big-stuff-shared";

export type BigStuffType = "festival" | "convention" | "sports" | "community" | "other";

export interface RawBigStuffItem {
  kind: "festival" | "tentpole";
  title: string;
  festivalType: string | null;
  category: string | null;
}

export interface BigStuffPageItem extends BigStuffItem {
  type: BigStuffType;
  isLiveNow: boolean;
  description: string | null;
  imageUrl: string | null;
  tier: "hero" | "featured" | "standard";
}

export interface BigStuffPageData {
  items: BigStuffPageItem[];
}

export const TYPE_ACCENT: Record<BigStuffType, string> = {
  festival: "var(--gold)",
  convention: "var(--vibe)",
  sports: "var(--neon-cyan)",
  community: "var(--neon-green)",
  other: "var(--muted)",
};

export const TYPE_LABEL: Record<BigStuffType, string> = {
  festival: "FESTIVAL",
  convention: "CONVENTION",
  sports: "SPORTS",
  community: "COMMUNITY",
  other: "OTHER",
};
