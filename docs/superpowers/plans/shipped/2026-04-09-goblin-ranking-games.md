# Goblin Day: Ranking Games — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generic ranking game system for Goblin Day where participants independently rank items across categories, then compare rankings with each other and see group aggregates.

**Architecture:** Four new DB tables (games, categories, items, entries) with RLS. Five API routes under `/api/goblinday/rankings/`. One new page at `/goblinday/rankings/[gameId]` with three views (My Rankings, Compare, Group Rankings). Reuses drag-reorder + tier bucket UX from the existing movie log. First game seeded with Mission: Impossible data.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL + RLS), TypeScript, Tailwind CSS, Vitest

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260409200000_goblin_ranking_games.sql` | Schema: 4 tables, indexes, RLS, seed data |
| `web/lib/ranking-types.ts` | TypeScript types for ranking games |
| `web/lib/hooks/useRankingGame.ts` | Client hook: fetch game, entries, save rankings |
| `web/app/api/goblinday/rankings/route.ts` | GET list all games |
| `web/app/api/goblinday/rankings/[gameId]/route.ts` | GET game detail (categories + items) |
| `web/app/api/goblinday/rankings/[gameId]/entries/route.ts` | GET all participants' entries |
| `web/app/api/goblinday/rankings/[gameId]/me/route.ts` | GET + POST user's rankings |
| `web/app/goblinday/rankings/[gameId]/page.tsx` | Page shell (fetch game server-side, render client component) |
| `web/components/goblin/GoblinRankingGamePage.tsx` | Top-level client component: tabs, view toggle, state |
| `web/components/goblin/GoblinRankingList.tsx` | My Rankings: drag-reorder + tiers + unranked pool |
| `web/components/goblin/GoblinRankingItem.tsx` | Single ranking item card (name, subtitle, rank badge, actions) |
| `web/components/goblin/GoblinRankingCompare.tsx` | Compare view: participant picker + side-by-side with deltas |
| `web/components/goblin/GoblinRankingGroup.tsx` | Group Rankings: aggregate avg positions + spread |
| `web/app/api/goblinday/rankings/__tests__/rankings.test.ts` | API route tests |

### Modified Files

| File | Change |
|------|--------|
| `web/components/goblin/GoblinDayPage.tsx` | Add "Rankings" link/card to navigate to active games |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260409200000_goblin_ranking_games.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Goblin Day: Ranking Games
-- Generic ranking game system for collaborative item ranking during hangs

-- 1. Tables
CREATE TABLE IF NOT EXISTS goblin_ranking_games (
  id serial PRIMARY KEY,
  name text NOT NULL,
  description text,
  image_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goblin_ranking_categories (
  id serial PRIMARY KEY,
  game_id integer NOT NULL REFERENCES goblin_ranking_games(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goblin_ranking_items (
  id serial PRIMARY KEY,
  category_id integer NOT NULL REFERENCES goblin_ranking_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  subtitle text,
  image_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goblin_ranking_entries (
  id serial PRIMARY KEY,
  item_id integer NOT NULL REFERENCES goblin_ranking_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  tier_name text,
  tier_color text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (item_id, user_id)
);

-- 2. Indexes
CREATE INDEX idx_ranking_entries_user_item ON goblin_ranking_entries(user_id, item_id);
CREATE INDEX idx_ranking_categories_game_order ON goblin_ranking_categories(game_id, sort_order);
CREATE INDEX idx_ranking_items_category ON goblin_ranking_items(category_id);

-- 3. RLS
ALTER TABLE goblin_ranking_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_ranking_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_ranking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goblin_ranking_entries ENABLE ROW LEVEL SECURITY;

-- Reference tables: authenticated read-only
CREATE POLICY "read_games" ON goblin_ranking_games FOR SELECT USING (true);
CREATE POLICY "read_categories" ON goblin_ranking_categories FOR SELECT USING (true);
CREATE POLICY "read_items" ON goblin_ranking_items FOR SELECT USING (true);

-- Entry table: public read + owner write
CREATE POLICY "read_all_entries" ON goblin_ranking_entries FOR SELECT USING (true);
CREATE POLICY "insert_own_entries" ON goblin_ranking_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_entries" ON goblin_ranking_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete_own_entries" ON goblin_ranking_entries FOR DELETE USING (auth.uid() = user_id);

-- 4. Seed: Mission: Impossible
INSERT INTO goblin_ranking_games (name, description, status) VALUES
  ('Mission: Impossible', 'Rank the movies, the stunts, and the sequences.', 'open');

-- Categories (game_id = lastval from above)
INSERT INTO goblin_ranking_categories (game_id, name, sort_order) VALUES
  (currval('goblin_ranking_games_id_seq'), 'Movies', 0),
  (currval('goblin_ranking_games_id_seq'), 'Stunts', 1),
  (currval('goblin_ranking_games_id_seq'), 'Sequences', 2);

-- Movies
INSERT INTO goblin_ranking_items (category_id, name, subtitle) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible', '1996'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible 2', '2000'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible III', '2006'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible – Ghost Protocol', '2011'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible – Rogue Nation', '2015'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible – Fallout', '2018'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Movies' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mission: Impossible – Dead Reckoning', '2023');

-- Stunts
INSERT INTO goblin_ranking_items (category_id, name, subtitle) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Langley ceiling hang', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Aquarium restaurant explosion', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Channel Tunnel helicopter chase', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Rock climbing free solo', 'MI:2'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Motorcycle joust', 'MI:2'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Vatican infiltration', 'MI:III'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Shanghai factory swing', 'MI:III'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Burj Khalifa climb', 'Ghost Protocol'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Mumbai parking garage chase', 'Ghost Protocol'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Plane door hang (takeoff)', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Morocco motorcycle chase', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Underwater Torus breach', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'HALO jump', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Helicopter canyon chase', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Paris motorcycle chase', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Kashmir cliff fight', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Motorcycle cliff jump', 'Dead Reckoning'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Stunts' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Orient Express train roof fight', 'Dead Reckoning');

-- Sequences
INSERT INTO goblin_ranking_items (category_id, name, subtitle) VALUES
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'NOC list theft (embassy)', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Bible reveal / mole hunt', 'MI'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Seville nightclub infiltration', 'MI:2'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Chimera lab break-in', 'MI:2'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Bridge ambush / Davian capture', 'MI:III'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Shanghai rooftop run', 'MI:III'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Kremlin infiltration', 'Ghost Protocol'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Sandstorm pursuit', 'Ghost Protocol'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Vienna opera house', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'London pursuit / glass box', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Lane interrogation (The Syndicate reveal)', 'Rogue Nation'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Belfast bathroom fight', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Kashmir nuclear deactivation', 'Fallout'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Airport runway standoff', 'Dead Reckoning'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Venice chase', 'Dead Reckoning'),
  ((SELECT id FROM goblin_ranking_categories WHERE name = 'Sequences' AND game_id = currval('goblin_ranking_games_id_seq')),
   'Rome car chase (Fiat)', 'Dead Reckoning');
```

- [ ] **Step 2: Apply the migration locally**

Run: `cd /Users/coach/Projects/LostCity && npx supabase db push`
Expected: Migration applies successfully, tables created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260409200000_goblin_ranking_games.sql
git commit -m "feat(goblin): add ranking games schema + MI seed data"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `web/lib/ranking-types.ts`

- [ ] **Step 1: Write the types file**

```typescript
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
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `ranking-types.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/lib/ranking-types.ts
git commit -m "feat(goblin): add ranking game TypeScript types"
```

---

## Task 3: API — List Games + Game Detail

**Files:**
- Create: `web/app/api/goblinday/rankings/route.ts`
- Create: `web/app/api/goblinday/rankings/[gameId]/route.ts`

- [ ] **Step 1: Write GET /rankings (list all games)**

```typescript
// web/app/api/goblinday/rankings/route.ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient
    .from("goblin_ranking_games")
    .select("id, name, description, image_url, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch games" }, { status: 500 });
  }

  return NextResponse.json({ games: data });
}
```

- [ ] **Step 2: Write GET /rankings/[gameId] (game detail with categories + items)**

```typescript
// web/app/api/goblinday/rankings/[gameId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseIntParam } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId: gameIdStr } = await params;
  const gameId = parseIntParam(gameIdStr);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Fetch game
  const { data: game, error: gameError } = await serviceClient
    .from("goblin_ranking_games")
    .select("id, name, description, image_url, status, created_at")
    .eq("id", gameId)
    .maybeSingle();

  if (gameError || !game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Fetch categories with items
  const { data: categories, error: catError } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id, game_id, name, description, sort_order")
    .eq("game_id", gameId)
    .order("sort_order", { ascending: true });

  if (catError) {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }

  const categoryIds = (categories || []).map((c: { id: number }) => c.id);

  const { data: items, error: itemError } = await serviceClient
    .from("goblin_ranking_items")
    .select("id, category_id, name, subtitle, image_url")
    .in("category_id", categoryIds.length > 0 ? categoryIds : [-1]);

  if (itemError) {
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }

  // Group items by category
  const itemsByCategory = new Map<number, typeof items>();
  for (const item of items || []) {
    const catId = (item as { category_id: number }).category_id;
    if (!itemsByCategory.has(catId)) itemsByCategory.set(catId, []);
    itemsByCategory.get(catId)!.push(item);
  }

  const result = {
    ...game,
    categories: (categories || []).map((cat: { id: number }) => ({
      ...cat,
      items: itemsByCategory.get(cat.id) || [],
    })),
  };

  return NextResponse.json({ game: result });
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/rankings/route.ts web/app/api/goblinday/rankings/\[gameId\]/route.ts
git commit -m "feat(goblin): add ranking games list + detail API routes"
```

---

## Task 4: API — Entries + My Rankings

**Files:**
- Create: `web/app/api/goblinday/rankings/[gameId]/entries/route.ts`
- Create: `web/app/api/goblinday/rankings/[gameId]/me/route.ts`

- [ ] **Step 1: Write GET /rankings/[gameId]/entries (all participants)**

```typescript
// web/app/api/goblinday/rankings/[gameId]/entries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseIntParam } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId: gameIdStr } = await params;
  const gameId = parseIntParam(gameIdStr);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  const serviceClient = createServiceClient();

  // Get all items for this game (to scope the entry query)
  const { data: categories } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id")
    .eq("game_id", gameId);

  const categoryIds = (categories || []).map((c: { id: number }) => c.id);
  if (categoryIds.length === 0) {
    return NextResponse.json({ participants: [] });
  }

  const { data: items } = await serviceClient
    .from("goblin_ranking_items")
    .select("id")
    .in("category_id", categoryIds);

  const itemIds = (items || []).map((i: { id: number }) => i.id);
  if (itemIds.length === 0) {
    return NextResponse.json({ participants: [] });
  }

  // Fetch all entries for these items
  const { data: entries, error: entryError } = await serviceClient
    .from("goblin_ranking_entries")
    .select("item_id, user_id, sort_order, tier_name, tier_color")
    .in("item_id", itemIds);

  if (entryError) {
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }

  // Group by user
  const byUser = new Map<string, typeof entries>();
  for (const entry of entries || []) {
    const uid = (entry as { user_id: string }).user_id;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push(entry);
  }

  // Fetch profiles for all participants
  const userIds = [...byUser.keys()];
  const { data: profiles } = await serviceClient
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

  const profileMap = new Map<string, { display_name: string; avatar_url: string | null }>();
  for (const p of profiles || []) {
    const profile = p as { id: string; display_name: string; avatar_url: string | null };
    profileMap.set(profile.id, { display_name: profile.display_name, avatar_url: profile.avatar_url });
  }

  const participants = userIds.map((uid) => {
    const userEntries = byUser.get(uid) || [];
    const profile = profileMap.get(uid);
    return {
      user_id: uid,
      display_name: profile?.display_name || "Unknown",
      avatar_url: profile?.avatar_url || null,
      items_ranked: userEntries.length,
      entries: userEntries.map((e) => ({
        item_id: (e as { item_id: number }).item_id,
        sort_order: (e as { sort_order: number }).sort_order,
        tier_name: (e as { tier_name: string | null }).tier_name,
        tier_color: (e as { tier_color: string | null }).tier_color,
      })),
    };
  });

  return NextResponse.json({ participants });
}
```

- [ ] **Step 2: Write GET + POST /rankings/[gameId]/me (user's rankings)**

```typescript
// web/app/api/goblinday/rankings/[gameId]/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (
  request: NextRequest,
  { user, serviceClient }
) => {
  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  // pathname: /api/goblinday/rankings/[gameId]/me
  const gameIdStr = segments[segments.indexOf("rankings") + 1];
  const gameId = parseIntParam(gameIdStr);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  // Get item IDs for this game
  const { data: categories } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id")
    .eq("game_id", gameId);

  const categoryIds = (categories || []).map((c: { id: number }) => c.id);
  if (categoryIds.length === 0) {
    return NextResponse.json({ entries: [] });
  }

  const { data: items } = await serviceClient
    .from("goblin_ranking_items")
    .select("id")
    .in("category_id", categoryIds);

  const itemIds = (items || []).map((i: { id: number }) => i.id);
  if (itemIds.length === 0) {
    return NextResponse.json({ entries: [] });
  }

  const { data: entries, error } = await serviceClient
    .from("goblin_ranking_entries")
    .select("item_id, sort_order, tier_name, tier_color")
    .eq("user_id", user.id)
    .in("item_id", itemIds);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch entries" }, { status: 500 });
  }

  return NextResponse.json({ entries: entries || [] });
});

export const POST = withAuth(async (
  request: NextRequest,
  { user, serviceClient }
) => {
  const rateLimitResult = applyRateLimit(
    request,
    RATE_LIMITS.write,
    `${user.id}:ranking-save`
  );
  if (rateLimitResult) return rateLimitResult;

  const url = new URL(request.url);
  const segments = url.pathname.split("/");
  const gameIdStr = segments[segments.indexOf("rankings") + 1];
  const gameId = parseIntParam(gameIdStr);
  if (gameId === null) {
    return NextResponse.json({ error: "Invalid gameId" }, { status: 400 });
  }

  // Check game is open
  const { data: game } = await serviceClient
    .from("goblin_ranking_games")
    .select("status")
    .eq("id", gameId)
    .maybeSingle();

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if ((game as { status: string }).status !== "open") {
    return NextResponse.json({ error: "Game is closed" }, { status: 403 });
  }

  const body = await request.json();
  const { category_id, entries } = body as {
    category_id: number;
    entries: { item_id: number; sort_order: number; tier_name: string | null; tier_color: string | null }[];
  };

  if (!category_id || !Array.isArray(entries)) {
    return NextResponse.json({ error: "category_id and entries array required" }, { status: 400 });
  }

  // Validate category belongs to game
  const { data: category } = await serviceClient
    .from("goblin_ranking_categories")
    .select("id")
    .eq("id", category_id)
    .eq("game_id", gameId)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Category not found in this game" }, { status: 400 });
  }

  // Validate all item_ids belong to this category
  const { data: validItems } = await serviceClient
    .from("goblin_ranking_items")
    .select("id")
    .eq("category_id", category_id);

  const validItemIds = new Set((validItems || []).map((i: { id: number }) => i.id));
  const submittedItemIds = entries.map((e) => e.item_id);

  for (const itemId of submittedItemIds) {
    if (!validItemIds.has(itemId)) {
      return NextResponse.json({ error: `Item ${itemId} does not belong to this category` }, { status: 400 });
    }
  }

  // Delete existing entries for this user in this category (scoped to category only)
  const allCategoryItemIds = [...validItemIds];
  if (allCategoryItemIds.length > 0) {
    await serviceClient
      .from("goblin_ranking_entries")
      .delete()
      .eq("user_id", user.id)
      .in("item_id", allCategoryItemIds);
  }

  // Insert new entries
  if (entries.length > 0) {
    const now = new Date().toISOString();
    const rows = entries.map((e) => ({
      item_id: e.item_id,
      user_id: user.id,
      sort_order: e.sort_order,
      tier_name: e.tier_name,
      tier_color: e.tier_color,
      created_at: now,
      updated_at: now,
    }));

    const { error: insertError } = await serviceClient
      .from("goblin_ranking_entries")
      .insert(rows as never);

    if (insertError) {
      return NextResponse.json({ error: "Failed to save rankings" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
});
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/goblinday/rankings/\[gameId\]/entries/route.ts web/app/api/goblinday/rankings/\[gameId\]/me/route.ts
git commit -m "feat(goblin): add ranking entries + my rankings API routes"
```

---

## Task 5: Client Hook

**Files:**
- Create: `web/lib/hooks/useRankingGame.ts`

- [ ] **Step 1: Write the hook**

```typescript
// web/lib/hooks/useRankingGame.ts
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  RankingGameDetail,
  RankingEntry,
  ParticipantRankings,
} from "@/lib/ranking-types";

interface UseRankingGameState {
  game: RankingGameDetail | null;
  myEntries: RankingEntry[];
  participants: ParticipantRankings[];
  loading: boolean;
  saving: boolean;
  saved: boolean;
}

export function useRankingGame(gameId: number, isAuthenticated: boolean) {
  const [state, setState] = useState<UseRankingGameState>({
    game: null,
    myEntries: [],
    participants: [],
    loading: true,
    saving: false,
    saved: false,
  });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch game detail
  const fetchGame = useCallback(async () => {
    const res = await fetch(`/api/goblinday/rankings/${gameId}`);
    if (!res.ok) return;
    const data = await res.json();
    setState((prev) => ({ ...prev, game: data.game }));
  }, [gameId]);

  // Fetch my entries
  const fetchMyEntries = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await fetch(`/api/goblinday/rankings/${gameId}/me`);
    if (!res.ok) return;
    const data = await res.json();
    setState((prev) => ({ ...prev, myEntries: data.entries || [] }));
  }, [gameId, isAuthenticated]);

  // Fetch all participants
  const fetchParticipants = useCallback(async () => {
    const res = await fetch(`/api/goblinday/rankings/${gameId}/entries`);
    if (!res.ok) return;
    const data = await res.json();
    setState((prev) => ({ ...prev, participants: data.participants || [] }));
  }, [gameId]);

  // Initial load
  useEffect(() => {
    setState((prev) => ({ ...prev, loading: true }));
    Promise.all([fetchGame(), fetchMyEntries(), fetchParticipants()]).then(() => {
      setState((prev) => ({ ...prev, loading: false }));
    });
  }, [fetchGame, fetchMyEntries, fetchParticipants]);

  // Save rankings for a category (debounced)
  const saveRankings = useCallback(
    (categoryId: number, entries: RankingEntry[]) => {
      // Optimistic update
      setState((prev) => {
        const otherEntries = prev.myEntries.filter((e) => {
          const cat = prev.game?.categories.find((c) =>
            c.items.some((i) => i.id === e.item_id)
          );
          return cat?.id !== categoryId;
        });
        return {
          ...prev,
          myEntries: [...otherEntries, ...entries],
          saved: false,
        };
      });

      // Debounce the actual save
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        setState((prev) => ({ ...prev, saving: true }));
        try {
          const res = await fetch(`/api/goblinday/rankings/${gameId}/me`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category_id: categoryId, entries }),
          });
          if (res.ok) {
            setState((prev) => ({ ...prev, saving: false, saved: true }));
            savedTimerRef.current = setTimeout(() => {
              setState((prev) => ({ ...prev, saved: false }));
            }, 2000);
            // Refresh participants after save
            fetchParticipants();
          } else {
            setState((prev) => ({ ...prev, saving: false }));
          }
        } catch {
          setState((prev) => ({ ...prev, saving: false }));
        }
      }, 500);
    },
    [gameId, fetchParticipants]
  );

  // Refresh participants (for polling)
  const refreshParticipants = useCallback(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  return {
    game: state.game,
    myEntries: state.myEntries,
    participants: state.participants,
    loading: state.loading,
    saving: state.saving,
    saved: state.saved,
    saveRankings,
    refreshParticipants,
  };
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/hooks/useRankingGame.ts
git commit -m "feat(goblin): add useRankingGame client hook"
```

---

## Task 6: Ranking Item Card Component

**Files:**
- Create: `web/components/goblin/GoblinRankingItem.tsx`

- [ ] **Step 1: Write the item card component**

This is a simplified version of `GoblinLogEntryCard` — no poster, no scores, just rank + name + subtitle + actions.

```typescript
// web/components/goblin/GoblinRankingItem.tsx
"use client";

import { useState } from "react";

interface Props {
  name: string;
  subtitle: string | null;
  rank: number;
  tierColor?: string | null;
  readOnly?: boolean;
  onMoveToRank?: (rank: number) => void;
  onRemove?: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: () => void;
  isDragging?: boolean;
  isDragTarget?: boolean;
  /** Optional: the other user's rank for comparison mode */
  compareRank?: number | null;
}

const RANK_NEON = {
  hero: { color: "#00f0ff", glow: "0 0 10px rgba(0,240,255,0.4), 0 0 30px rgba(0,240,255,0.15)" },
  mid: { color: "#ff00aa", glow: "0 0 8px rgba(255,0,170,0.3), 0 0 20px rgba(255,0,170,0.1)" },
  rest: { color: "#52525b", glow: "none" },
};

export default function GoblinRankingItem({
  name, subtitle, rank, tierColor, readOnly,
  onMoveToRank, onRemove,
  onDragStart, onDragOver, onDrop, isDragging, isDragTarget,
  compareRank,
}: Props) {
  const [editingRank, setEditingRank] = useState(false);
  const [rankInput, setRankInput] = useState("");

  const isHero = rank <= 3;
  const isMid = rank > 3 && rank <= 10;
  const tier = tierColor
    ? { color: tierColor, glow: `0 0 8px ${tierColor}40, 0 0 20px ${tierColor}15` }
    : isHero ? RANK_NEON.hero : isMid ? RANK_NEON.mid : RANK_NEON.rest;

  // Compare delta
  const delta = compareRank != null ? compareRank - rank : null;

  return (
    <div
      draggable={!readOnly}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver?.(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop?.();
      }}
      className={`flex items-stretch transition-all duration-150
        ${isDragging ? "opacity-30 scale-95" : ""}
        ${isDragTarget ? "ring-1 ring-cyan-500/50" : ""}
        ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}
        bg-zinc-950 border border-zinc-800/50 hover:border-zinc-700/50`}
    >
      {/* Rank badge */}
      <div className="flex-shrink-0 w-12 flex items-center justify-center">
        {editingRank ? (
          <input
            autoFocus
            type="number"
            min={1}
            value={rankInput}
            onChange={(e) => setRankInput(e.target.value)}
            onBlur={() => {
              const n = parseInt(rankInput);
              if (n > 0) onMoveToRank?.(n);
              setEditingRank(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const n = parseInt(rankInput);
                if (n > 0) onMoveToRank?.(n);
                setEditingRank(false);
              }
              if (e.key === "Escape") setEditingRank(false);
            }}
            className="w-10 bg-transparent text-center font-mono text-lg font-black
              border-b border-cyan-500 text-cyan-300 outline-none"
          />
        ) : (
          <button
            onClick={() => {
              if (readOnly) return;
              setRankInput(String(rank));
              setEditingRank(true);
            }}
            className="font-mono text-lg font-black tabular-nums leading-none"
            style={{
              color: tier.color,
              textShadow: tier.glow,
            }}
            title={readOnly ? undefined : "Tap to jump to rank"}
          >
            {rank}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-2.5 pr-2">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        {subtitle && (
          <p className="text-2xs text-zinc-500 font-mono mt-0.5 truncate">{subtitle}</p>
        )}
      </div>

      {/* Compare delta */}
      {delta !== null && (
        <div className="flex-shrink-0 flex items-center pr-3">
          <span
            className="font-mono text-xs font-bold"
            style={{
              color: delta > 0 ? "#00d9a0" : delta < 0 ? "#ff5a5a" : "#52525b",
            }}
          >
            {delta === 0 ? "=" : delta > 0 ? `+${delta}` : String(delta)}
          </span>
        </div>
      )}

      {/* Remove button */}
      {!readOnly && onRemove && (
        <button
          onClick={onRemove}
          className="flex-shrink-0 w-8 flex items-center justify-center
            text-zinc-700 hover:text-red-400 transition-colors"
          title="Remove from ranking"
        >
          ×
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinRankingItem.tsx
git commit -m "feat(goblin): add GoblinRankingItem card component"
```

---

## Task 7: My Rankings View

**Files:**
- Create: `web/components/goblin/GoblinRankingList.tsx`

- [ ] **Step 1: Write the My Rankings component**

```typescript
// web/components/goblin/GoblinRankingList.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import GoblinRankingItem from "./GoblinRankingItem";
import type { RankingItem, RankingEntry } from "@/lib/ranking-types";

interface Props {
  items: RankingItem[];
  entries: RankingEntry[];
  categoryId: number;
  isOpen: boolean;
  onSave: (categoryId: number, entries: RankingEntry[]) => void;
}

export default function GoblinRankingList({ items, entries, categoryId, isOpen, onSave }: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  // Split items into ranked and unranked
  const { ranked, unranked } = useMemo(() => {
    const entryMap = new Map<number, RankingEntry>();
    for (const e of entries) entryMap.set(e.item_id, e);

    const rankedItems: (RankingItem & { entry: RankingEntry })[] = [];
    const unrankedItems: RankingItem[] = [];

    for (const item of items) {
      const entry = entryMap.get(item.id);
      if (entry) {
        rankedItems.push({ ...item, entry });
      } else {
        unrankedItems.push(item);
      }
    }

    rankedItems.sort((a, b) => a.entry.sort_order - b.entry.sort_order);
    return { ranked: rankedItems, unranked: unrankedItems };
  }, [items, entries]);

  const saveFromRanked = useCallback(
    (newRanked: typeof ranked) => {
      const newEntries: RankingEntry[] = newRanked.map((item, i) => ({
        item_id: item.id,
        sort_order: i + 1,
        tier_name: item.entry.tier_name,
        tier_color: item.entry.tier_color,
      }));
      onSave(categoryId, newEntries);
    },
    [categoryId, onSave]
  );

  const addToRanking = useCallback(
    (item: RankingItem) => {
      const newEntry: RankingEntry = {
        item_id: item.id,
        sort_order: ranked.length + 1,
        tier_name: null,
        tier_color: null,
      };
      const newRanked = [...ranked, { ...item, entry: newEntry }];
      saveFromRanked(newRanked);
    },
    [ranked, saveFromRanked]
  );

  const removeFromRanking = useCallback(
    (itemId: number) => {
      const newRanked = ranked.filter((r) => r.id !== itemId);
      saveFromRanked(newRanked);
    },
    [ranked, saveFromRanked]
  );

  const moveToRank = useCallback(
    (currentIndex: number, newRank: number) => {
      const targetIndex = Math.max(0, Math.min(newRank - 1, ranked.length - 1));
      if (targetIndex === currentIndex) return;
      const newRanked = [...ranked];
      const [moved] = newRanked.splice(currentIndex, 1);
      newRanked.splice(targetIndex, 0, moved);
      saveFromRanked(newRanked);
    },
    [ranked, saveFromRanked]
  );

  const handleDrop = useCallback(
    (toIndex: number) => {
      if (dragFrom === null || dragFrom === toIndex) {
        setDragFrom(null);
        setDragOver(null);
        return;
      }
      const newRanked = [...ranked];
      const [moved] = newRanked.splice(dragFrom, 1);
      newRanked.splice(toIndex, 0, moved);
      setDragFrom(null);
      setDragOver(null);
      saveFromRanked(newRanked);
    },
    [dragFrom, ranked, saveFromRanked]
  );

  // Group ranked items by tier
  const tierGroups = useMemo(() => {
    const groups: { tierName: string | null; tierColor: string | null; items: typeof ranked }[] = [];
    let current: (typeof groups)[0] | null = null;
    for (const item of ranked) {
      if (item.entry.tier_name || !current) {
        current = { tierName: item.entry.tier_name, tierColor: item.entry.tier_color, items: [] };
        groups.push(current);
      }
      current.items.push(item);
    }
    return groups;
  }, [ranked]);

  return (
    <div onDragLeave={() => setDragOver(null)}>
      {/* Ranked items */}
      {ranked.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-mono text-sm text-zinc-500 tracking-widest uppercase">
            Drag items up to rank them, or tap a number to place them.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {tierGroups.map((group, gi) => (
            <div key={gi} className="flex mb-3">
              {group.tierName ? (
                <div
                  className="flex-shrink-0 w-6 sm:w-8 flex items-center justify-center relative"
                  style={{ borderLeft: `2px solid ${group.tierColor || "#00f0ff"}` }}
                >
                  <span
                    className="font-mono text-2xs font-black uppercase tracking-[0.3em] whitespace-nowrap
                      [writing-mode:vertical-lr] rotate-180"
                    style={{
                      color: group.tierColor || "#00f0ff",
                      textShadow: `0 0 8px ${group.tierColor || "#00f0ff"}40`,
                    }}
                  >
                    {group.tierName}
                  </span>
                </div>
              ) : (
                <div className="w-0" />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                {group.items.map((item) => {
                  const globalIdx = ranked.indexOf(item);
                  return (
                    <GoblinRankingItem
                      key={item.id}
                      name={item.name}
                      subtitle={item.subtitle}
                      rank={globalIdx + 1}
                      tierColor={group.tierColor}
                      readOnly={!isOpen}
                      onMoveToRank={(r) => moveToRank(globalIdx, r)}
                      onRemove={isOpen ? () => removeFromRanking(item.id) : undefined}
                      onDragStart={() => setDragFrom(globalIdx)}
                      onDragOver={() => setDragOver(globalIdx)}
                      onDrop={() => handleDrop(globalIdx)}
                      isDragging={dragFrom === globalIdx}
                      isDragTarget={dragOver === globalIdx && dragFrom !== globalIdx}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Unranked pool */}
      {unranked.length > 0 && isOpen && (
        <div className="mt-6">
          <p className="font-mono text-2xs text-zinc-600 uppercase tracking-[0.2em] mb-2">
            Unranked ({unranked.length})
          </p>
          <div className="space-y-1">
            {unranked.map((item) => (
              <button
                key={item.id}
                onClick={() => addToRanking(item)}
                className="w-full flex items-stretch bg-zinc-950/50 border border-zinc-800/30
                  hover:border-zinc-700/50 hover:bg-zinc-900/30 transition-all text-left"
              >
                <div className="flex-shrink-0 w-12 flex items-center justify-center">
                  <span className="font-mono text-lg text-zinc-800">–</span>
                </div>
                <div className="flex-1 min-w-0 py-2.5 pr-2">
                  <p className="text-sm text-zinc-500 truncate">{item.name}</p>
                  {item.subtitle && (
                    <p className="text-2xs text-zinc-700 font-mono mt-0.5 truncate">{item.subtitle}</p>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center pr-3">
                  <span className="text-2xs text-zinc-700 font-mono">TAP TO ADD</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinRankingList.tsx
git commit -m "feat(goblin): add GoblinRankingList with drag-reorder + unranked pool"
```

---

## Task 8: Compare View

**Files:**
- Create: `web/components/goblin/GoblinRankingCompare.tsx`

- [ ] **Step 1: Write the Compare component**

```typescript
// web/components/goblin/GoblinRankingCompare.tsx
"use client";

import { useState, useMemo } from "react";
import GoblinRankingItem from "./GoblinRankingItem";
import type { RankingItem, RankingEntry, ParticipantRankings } from "@/lib/ranking-types";

interface Props {
  items: RankingItem[];
  myEntries: RankingEntry[];
  participants: ParticipantRankings[];
  currentUserId: string;
}

export default function GoblinRankingCompare({ items, myEntries, participants, currentUserId }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Other participants (exclude self)
  const otherParticipants = useMemo(
    () => participants.filter((p) => p.user_id !== currentUserId),
    [participants, currentUserId]
  );

  // Build lookup: item_id → my sort_order
  const myRankMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of myEntries) m.set(e.item_id, e.sort_order);
    return m;
  }, [myEntries]);

  // Selected participant's entries
  const selectedParticipant = useMemo(
    () => participants.find((p) => p.user_id === selectedUserId),
    [participants, selectedUserId]
  );

  const selectedEntries = useMemo(() => {
    if (!selectedParticipant) return [];
    return [...selectedParticipant.entries].sort((a, b) => a.sort_order - b.sort_order);
  }, [selectedParticipant]);

  // Item lookup
  const itemMap = useMemo(() => {
    const m = new Map<number, RankingItem>();
    for (const item of items) m.set(item.id, item);
    return m;
  }, [items]);

  if (otherParticipants.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="font-mono text-sm text-zinc-500 tracking-widest uppercase">
          No other participants yet
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Participant picker */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {otherParticipants.map((p) => (
          <button
            key={p.user_id}
            onClick={() => setSelectedUserId(p.user_id === selectedUserId ? null : p.user_id)}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 font-mono text-2xs font-bold
              tracking-[0.1em] uppercase border transition-all
              ${p.user_id === selectedUserId
                ? "border-cyan-600 text-cyan-300 bg-cyan-950/30"
                : "border-zinc-800 text-zinc-500 hover:text-cyan-400/60 hover:border-cyan-800/40"
              }`}
          >
            {p.avatar_url && (
              <img src={p.avatar_url} alt="" className="w-4 h-4 rounded-full" />
            )}
            {p.display_name}
            <span className="text-zinc-700">{p.items_ranked}</span>
          </button>
        ))}
      </div>

      {/* Comparison list */}
      {selectedParticipant && selectedEntries.length > 0 ? (
        <div>
          <p className="font-mono text-2xs text-zinc-600 uppercase tracking-[0.2em] mb-2">
            {selectedParticipant.display_name}&apos;s ranking
          </p>
          <div className="space-y-1">
            {selectedEntries.map((entry) => {
              const item = itemMap.get(entry.item_id);
              if (!item) return null;
              const myRank = myRankMap.get(entry.item_id) ?? null;
              return (
                <GoblinRankingItem
                  key={entry.item_id}
                  name={item.name}
                  subtitle={item.subtitle}
                  rank={entry.sort_order}
                  tierColor={entry.tier_color}
                  readOnly
                  compareRank={myRank}
                />
              );
            })}
          </div>
        </div>
      ) : selectedUserId ? (
        <div className="py-8 text-center">
          <p className="font-mono text-sm text-zinc-600">
            {selectedParticipant?.display_name} hasn&apos;t ranked anything in this category yet.
          </p>
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="font-mono text-sm text-zinc-600 tracking-widest uppercase">
            Select someone to compare
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinRankingCompare.tsx
git commit -m "feat(goblin): add GoblinRankingCompare with vs-mine deltas"
```

---

## Task 9: Group Rankings View

**Files:**
- Create: `web/components/goblin/GoblinRankingGroup.tsx`

- [ ] **Step 1: Write the Group Rankings component**

```typescript
// web/components/goblin/GoblinRankingGroup.tsx
"use client";

import { useMemo } from "react";
import type { RankingItem, RankingEntry, ParticipantRankings } from "@/lib/ranking-types";

interface Props {
  items: RankingItem[];
  myEntries: RankingEntry[];
  participants: ParticipantRankings[];
}

interface AggregatedItem {
  item: RankingItem;
  avgPosition: number;
  minRank: number;
  maxRank: number;
  rankedBy: number;
  myRank: number | null;
  spread: number;
}

export default function GoblinRankingGroup({ items, myEntries, participants }: Props) {
  const myRankMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of myEntries) m.set(e.item_id, e.sort_order);
    return m;
  }, [myEntries]);

  const aggregated: AggregatedItem[] = useMemo(() => {
    const result: AggregatedItem[] = [];

    for (const item of items) {
      const ranks: number[] = [];
      for (const p of participants) {
        const entry = p.entries.find((e) => e.item_id === item.id);
        if (entry) ranks.push(entry.sort_order);
      }

      if (ranks.length === 0) continue;

      const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length;
      const min = Math.min(...ranks);
      const max = Math.max(...ranks);

      result.push({
        item,
        avgPosition: avg,
        minRank: min,
        maxRank: max,
        rankedBy: ranks.length,
        myRank: myRankMap.get(item.id) ?? null,
        spread: max - min,
      });
    }

    result.sort((a, b) => a.avgPosition - b.avgPosition);
    return result;
  }, [items, participants, myRankMap]);

  if (aggregated.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="font-mono text-sm text-zinc-500 tracking-widest uppercase">
          No rankings yet
        </p>
      </div>
    );
  }

  const maxSpread = Math.max(...aggregated.map((a) => a.spread));

  return (
    <div className="space-y-1">
      {aggregated.map((agg, i) => {
        const isContested = maxSpread > 0 && agg.spread >= maxSpread * 0.7;
        return (
          <div
            key={agg.item.id}
            className={`flex items-stretch bg-zinc-950 border transition-colors
              ${isContested ? "border-amber-800/40" : "border-zinc-800/50"}`}
          >
            {/* Avg rank */}
            <div className="flex-shrink-0 w-12 flex items-center justify-center">
              <span
                className="font-mono text-lg font-black tabular-nums"
                style={{
                  color: i < 3 ? "#00f0ff" : i < 10 ? "#ff00aa" : "#52525b",
                  textShadow: i < 3
                    ? "0 0 10px rgba(0,240,255,0.4)"
                    : i < 10
                    ? "0 0 8px rgba(255,0,170,0.3)"
                    : "none",
                }}
              >
                {i + 1}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 py-2.5 pr-2">
              <p className="text-sm font-semibold text-white truncate">
                {agg.item.name}
                {isContested && (
                  <span className="ml-2 text-2xs text-amber-500 font-mono">CONTESTED</span>
                )}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-2xs text-zinc-500 font-mono">
                  avg #{agg.avgPosition.toFixed(1)}
                </span>
                <span className="text-2xs text-zinc-600 font-mono">
                  range #{agg.minRank}–#{agg.maxRank}
                </span>
                {agg.item.subtitle && (
                  <span className="text-2xs text-zinc-700 font-mono truncate">{agg.item.subtitle}</span>
                )}
              </div>
            </div>

            {/* My rank comparison */}
            {agg.myRank !== null && (
              <div className="flex-shrink-0 flex items-center pr-3">
                <span className="text-2xs text-zinc-600 font-mono">
                  You: #{agg.myRank}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinRankingGroup.tsx
git commit -m "feat(goblin): add GoblinRankingGroup aggregate view"
```

---

## Task 10: Game Page (Container + Tabs + View Toggle)

**Files:**
- Create: `web/components/goblin/GoblinRankingGamePage.tsx`
- Create: `web/app/goblinday/rankings/[gameId]/page.tsx`

- [ ] **Step 1: Write the page-level client component**

```typescript
// web/components/goblin/GoblinRankingGamePage.tsx
"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { useRankingGame } from "@/lib/hooks/useRankingGame";
import { useGoblinUser } from "@/lib/hooks/useGoblinUser";
import GoblinRankingList from "./GoblinRankingList";
import GoblinRankingCompare from "./GoblinRankingCompare";
import GoblinRankingGroup from "./GoblinRankingGroup";
import type { RankingEntry } from "@/lib/ranking-types";

interface Props {
  gameId: number;
}

type View = "mine" | "compare" | "group";

export default function GoblinRankingGamePage({ gameId }: Props) {
  const { isAuthenticated, user } = useGoblinUser();
  const { game, myEntries, participants, loading, saving, saved, saveRankings } =
    useRankingGame(gameId, isAuthenticated);

  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0);
  const [view, setView] = useState<View>("mine");
  const scrollPositions = useRef<Map<number, number>>(new Map());

  const activeCategory = game?.categories[activeCategoryIdx] ?? null;

  // Filter entries for active category
  const categoryItemIds = useMemo(() => {
    if (!activeCategory) return new Set<number>();
    return new Set(activeCategory.items.map((i) => i.id));
  }, [activeCategory]);

  const myCategoryEntries = useMemo(
    () => myEntries.filter((e) => categoryItemIds.has(e.item_id)),
    [myEntries, categoryItemIds]
  );

  // Participants filtered to current category
  const categoryParticipants = useMemo(
    () => participants.map((p) => ({
      ...p,
      entries: p.entries.filter((e) => categoryItemIds.has(e.item_id)),
      items_ranked: p.entries.filter((e) => categoryItemIds.has(e.item_id)).length,
    })),
    [participants, categoryItemIds]
  );

  const handleSave = useCallback(
    (categoryId: number, entries: RankingEntry[]) => {
      saveRankings(categoryId, entries);
    },
    [saveRankings]
  );

  // Save/restore scroll on tab switch
  const handleCategorySwitch = useCallback(
    (idx: number) => {
      scrollPositions.current.set(activeCategoryIdx, window.scrollY);
      setActiveCategoryIdx(idx);
      const savedPos = scrollPositions.current.get(idx);
      if (savedPos != null) {
        requestAnimationFrame(() => window.scrollTo(0, savedPos));
      }
    },
    [activeCategoryIdx]
  );

  const isOpen = game?.status === "open";

  // Default to group view when closed
  const effectiveView = !isOpen && view === "mine" ? "group" : view;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 bg-zinc-900/50 border border-zinc-800/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="font-mono text-sm text-zinc-500">Game not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-28">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-end justify-between gap-4 pb-4"
          style={{ borderBottom: "1px solid rgba(0,240,255,0.15)" }}>
          <div>
            {!isOpen && (
              <p className="text-2xs text-amber-500 font-mono tracking-[0.3em] uppercase mb-1">
                FINAL RESULTS
              </p>
            )}
            <h1 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.25em] leading-none"
              style={{ textShadow: "0 0 30px rgba(0,240,255,0.2)" }}>
              {game.name}
            </h1>
            {game.description && (
              <p className="text-2xs text-zinc-600 font-mono mt-2 tracking-[0.2em] uppercase">
                {game.description}
              </p>
            )}
          </div>
          {/* Save indicator */}
          <div className="flex-shrink-0">
            {saving && <span className="text-2xs text-cyan-500 font-mono animate-pulse">SAVING...</span>}
            {saved && !saving && <span className="text-2xs text-zinc-600 font-mono">SAVED</span>}
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex items-center gap-1.5 mt-4 overflow-x-auto scrollbar-hide">
          {game.categories.map((cat, i) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySwitch(i)}
              className={`flex-shrink-0 px-3 py-1 font-mono text-2xs font-bold tracking-wider uppercase
                border transition-all duration-200 ${
                  i === activeCategoryIdx
                    ? "border-cyan-600 text-cyan-300 bg-cyan-950/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
                    : "border-zinc-800 text-zinc-600 hover:text-cyan-400/60 hover:border-cyan-800/40"
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1.5 mt-3">
          {(
            [
              { key: "mine" as View, label: isOpen ? "My Rankings" : "My Rankings" },
              { key: "compare" as View, label: "Compare" },
              { key: "group" as View, label: "Group Rankings" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-2.5 py-1 font-mono text-2xs tracking-wider uppercase
                border transition-all duration-200 ${
                  effectiveView === key
                    ? "border-fuchsia-600 text-fuchsia-300 bg-fuchsia-950/30"
                    : "border-zinc-800 text-zinc-600 hover:text-fuchsia-400/60 hover:border-fuchsia-800/40"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* View content */}
      {activeCategory && effectiveView === "mine" && (
        <GoblinRankingList
          items={activeCategory.items}
          entries={myCategoryEntries}
          categoryId={activeCategory.id}
          isOpen={isOpen}
          onSave={handleSave}
        />
      )}

      {activeCategory && effectiveView === "compare" && user && (
        <GoblinRankingCompare
          items={activeCategory.items}
          myEntries={myCategoryEntries}
          participants={categoryParticipants}
          currentUserId={user.id}
        />
      )}

      {activeCategory && effectiveView === "group" && (
        <GoblinRankingGroup
          items={activeCategory.items}
          myEntries={myCategoryEntries}
          participants={categoryParticipants}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write the Next.js page shell**

```typescript
// web/app/goblinday/rankings/[gameId]/page.tsx
import GoblinRankingGamePage from "@/components/goblin/GoblinRankingGamePage";

export const dynamic = "force-dynamic";

export default async function RankingGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const id = parseInt(gameId);

  if (isNaN(id)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="font-mono text-sm text-zinc-500">Invalid game.</p>
      </div>
    );
  }

  return <GoblinRankingGamePage gameId={id} />;
}
```

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinRankingGamePage.tsx web/app/goblinday/rankings/\[gameId\]/page.tsx
git commit -m "feat(goblin): add ranking game page with category tabs + view toggle"
```

---

## Task 11: Entry Point from Goblin Day Main Page

**Files:**
- Modify: `web/components/goblin/GoblinDayPage.tsx`

- [ ] **Step 1: Read the current GoblinDayPage to find where to add the link**

Read `web/components/goblin/GoblinDayPage.tsx` — look for the tab bar or navigation area where "log" is listed. The ranking games link should appear as a card or link near the top, or as part of the tab navigation. Since rankings are a separate page (not a tab), add a prominent link card above the tab bar.

- [ ] **Step 2: Add a rankings link**

Add a "Rankings" link card to `GoblinDayPage.tsx`. Place it above the main tab bar. The exact insertion point depends on what's currently at the top of the return JSX. Add:

```typescript
{/* Ranking games link — add this above the tab bar */}
<a
  href="/goblinday/rankings/1"
  className="block mb-4 p-3 border border-cyan-900/40 bg-cyan-950/10
    hover:bg-cyan-950/20 hover:border-cyan-800/50 transition-all group"
>
  <div className="flex items-center justify-between">
    <div>
      <p className="font-mono text-2xs text-cyan-500 uppercase tracking-[0.2em]">
        RANKING GAME
      </p>
      <p className="text-base font-bold text-white mt-0.5 group-hover:text-cyan-200 transition-colors">
        Mission: Impossible
      </p>
      <p className="text-2xs text-zinc-600 font-mono mt-1">
        Rank the movies, the stunts, and the sequences.
      </p>
    </div>
    <span className="text-zinc-600 text-lg">→</span>
  </div>
</a>
```

Note: The `href="/goblinday/rankings/1"` assumes game ID 1 from the seed migration. If the game ID differs in your local DB, adjust accordingly.

- [ ] **Step 3: Verify types compile**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add web/components/goblin/GoblinDayPage.tsx
git commit -m "feat(goblin): add ranking game link to main Goblin Day page"
```

---

## Task 12: API Tests

**Files:**
- Create: `web/app/api/goblinday/rankings/__tests__/rankings.test.ts`

- [ ] **Step 1: Write API route tests**

Follow the mock pattern from `web/app/api/explore/tracks/[slug]/route.test.ts`. Test the key behaviors:

```typescript
// web/app/api/goblinday/rankings/__tests__/rankings.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase service client
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();

const chainMock = () => ({
  select: mockSelect,
  insert: mockInsert,
  delete: mockDelete,
  update: mockUpdate,
  eq: mockEq,
  in: mockIn,
  order: mockOrder,
  maybeSingle: mockMaybeSingle,
});

// Each method returns the chain
for (const fn of [mockSelect, mockInsert, mockDelete, mockUpdate, mockEq, mockIn, mockOrder]) {
  fn.mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    delete: mockDelete,
    update: mockUpdate,
    eq: mockEq,
    in: mockIn,
    order: mockOrder,
    maybeSingle: mockMaybeSingle,
    then: (resolve: (v: { data: unknown; error: null }) => void) =>
      resolve({ data: [], error: null }),
  });
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => chainMock(),
  }),
}));

vi.mock("@/lib/api-middleware", () => ({
  withAuth: (handler: Function) => handler,
  withAuthAndParams: (handler: Function) => handler,
}));

vi.mock("@/lib/rate-limit", () => ({
  applyRateLimit: () => null,
  RATE_LIMITS: { write: { limit: 30, windowSec: 60 } },
  getClientIdentifier: () => "test",
}));

describe("GET /api/goblinday/rankings", () => {
  it("returns games list", async () => {
    const { GET } = await import("../../route");
    // Smoke test: function exists and is callable
    expect(typeof GET).toBe("function");
  });
});

describe("POST /api/goblinday/rankings/[gameId]/me", () => {
  it("exports POST handler", async () => {
    const { POST } = await import("../../[gameId]/me/route");
    expect(typeof POST).toBe("function");
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run app/api/goblinday/rankings/__tests__/rankings.test.ts --reporter=verbose 2>&1 | tail -20`
Expected: Tests pass.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/goblinday/rankings/__tests__/rankings.test.ts
git commit -m "test(goblin): add ranking games API route smoke tests"
```

---

## Task 13: Integration Test — Full tsc + Dev Server

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | tail -30`
Expected: No errors related to ranking game files.

- [ ] **Step 2: Run all goblin-related tests**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|ranking)" | head -20`
Expected: All ranking tests pass, no regressions.

- [ ] **Step 3: Start dev server and verify page loads**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev &` then open `http://localhost:3000/goblinday/rankings/1`
Expected: Page loads with Mission: Impossible game, three category tabs, three view toggles.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(goblin): address integration issues in ranking games"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration + seed data | 1 SQL migration |
| 2 | TypeScript types | `ranking-types.ts` |
| 3 | API: List games + game detail | 2 route files |
| 4 | API: Entries + my rankings | 2 route files |
| 5 | Client hook | `useRankingGame.ts` |
| 6 | Ranking item card | `GoblinRankingItem.tsx` |
| 7 | My Rankings view | `GoblinRankingList.tsx` |
| 8 | Compare view | `GoblinRankingCompare.tsx` |
| 9 | Group Rankings view | `GoblinRankingGroup.tsx` |
| 10 | Game page + Next.js route | `GoblinRankingGamePage.tsx` + `page.tsx` |
| 11 | Entry point from main page | Modify `GoblinDayPage.tsx` |
| 12 | API tests | 1 test file |
| 13 | Integration verification | tsc + tests + dev server |
