// Types for the Goblin Day ranking game system

export interface RankingGame {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  status: "open" | "closed";
  created_at: string;
}

export interface RankingCategory {
  id: number;
  game_id: number;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface RankingItem {
  id: number;
  category_id: number;
  name: string;
  subtitle: string | null;
  description: string | null;
  image_url: string | null;
}

export interface RankingEntry {
  item_id: number;
  sort_order: number;
  tier_name: string | null;
  tier_color: string | null;
}

export interface RankingGameDetail extends RankingGame {
  categories: (RankingCategory & { items: RankingItem[] })[];
}

export interface ParticipantRankings {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  items_ranked: number;
  entries: RankingEntry[];
}

/** Payload for POST /api/goblinday/rankings/[gameId]/me */
export interface SaveRankingsPayload {
  category_id: number;
  entries: RankingEntry[];
}
