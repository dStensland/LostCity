# Goblin Ranking Spy HUD Visual Upgrade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the MI ranking UI from utilitarian list into a cinematic spy-HUD interface with animated entries, glowing rank numbers, corner bracket image frames, and atmospheric scan lines.

**Architecture:** Pure CSS visual upgrade across 5 existing components. No logic changes, no new files, no new dependencies. All animations use `transform`/`opacity` only (compositor-friendly). Responsive image sizing (mobile vs desktop). Accessibility via `prefers-reduced-motion` and `prefers-contrast` queries.

**Tech Stack:** Next.js, React, Tailwind v4, CSS keyframes, SmartImage

**Spec:** `docs/superpowers/specs/2026-04-10-goblin-ranking-visual-upgrade-design.md`

---

## File Map

| File | Responsibility | Changes |
|------|---------------|---------|
| `web/components/goblin/GoblinRankingItem.tsx` (194 lines) | Core ranked item row | Image sizing, HUD brackets, rank glow, threat sidebar, empty placeholder |
| `web/components/goblin/GoblinRankingGamePage.tsx` (278 lines) | Page shell, header, tabs, routing | Header redesign, grid/scanline bg, save animation, glitch transition |
| `web/components/goblin/GoblinRankingList.tsx` (537 lines) | My Rankings view | Staggered entry, drag effects, responsive images in unranked |
| `web/components/goblin/GoblinRankingGroup.tsx` (130 lines) | Group aggregated view | Images, rank spread bar, CONTESTED pulse, entry animation |
| `web/components/goblin/GoblinRankingCompare.tsx` (119 lines) | Compare view | Images, enhanced deltas, DIVERGENT label, entry animation |

---

### Task 1: GoblinRankingItem — Rank Number Glow + Threat Sidebar

The core visual upgrade to every ranked item. This task handles the rank number treatment and the new threat-level sidebar. No image changes yet.

**Files:**
- Modify: `web/components/goblin/GoblinRankingItem.tsx`

- [ ] **Step 1: Add rank tier CSS classes and glow pseudo-element**

Replace the `RANK_NEON` constant and rank badge rendering (lines 26-112) with the new tiered system. The glow pulse for top-3 uses an `::after` pseudo-element with opacity animation — NOT animated `text-shadow`.

In `GoblinRankingItem.tsx`, replace the entire rank badge section:

```tsx
// Replace RANK_NEON constant (lines 26-30) with:
const getRankTier = (rank: number, tierColor?: string | null) => {
  if (tierColor) return { color: tierColor, tier: "custom" as const };
  if (rank <= 3) return { color: "#00f0ff", tier: "hero" as const };
  if (rank <= 10) return { color: "#ff00aa", tier: "mid" as const };
  return { color: "#52525b", tier: "rest" as const };
};
```

- [ ] **Step 2: Update the rank badge JSX**

Replace the rank badge `<div>` (the `w-12 flex items-center justify-center` container, lines 72-113) with:

```tsx
{/* Rank badge */}
<div className="flex-shrink-0 w-14 flex items-center justify-center relative">
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
      className={`font-mono font-black tabular-nums leading-none relative
        ${rankTier.tier === "hero" ? "text-[28px]" : rankTier.tier === "mid" ? "text-xl" : "text-lg"}`}
      style={{ color: rankTier.color }}
      title={readOnly ? undefined : "Tap to jump to rank"}
    >
      {rankTier.tier === "hero" ? String(rank).padStart(2, "0") : rank}
      {/* Glow pulse — compositor-friendly opacity animation on pseudo-element */}
      {rankTier.tier === "hero" && (
        <span
          className="absolute inset-0 rounded-full blur-xl motion-safe:animate-[glowPulse_2s_ease-in-out_infinite] pointer-events-none"
          style={{ background: `radial-gradient(circle, ${rankTier.color}60 0%, transparent 70%)` }}
        />
      )}
    </button>
  )}
</div>
```

Note: `rankTier` must be computed at top of component body:

```tsx
const rankTier = getRankTier(rank, tierColor);
```

Remove the old `tier` variable (lines 43-45) and the old `RANK_NEON` usage.

- [ ] **Step 3: Add threat-level sidebar**

Add a new element as the last child inside the outer `<div>`, right before the closing `</div>` of the row (before the remove button, after compare delta). Insert before `{/* Remove button */}`:

```tsx
{/* Threat-level sidebar */}
{rankTier.tier !== "rest" && (
  <div
    className="flex-shrink-0 w-1 self-stretch"
    style={{
      background: `linear-gradient(180deg, ${rankTier.color}, ${rankTier.color}${rankTier.tier === "hero" ? "40" : "20"})`,
    }}
  />
)}
```

- [ ] **Step 4: Update row styling per tier**

Replace the outer div's className (line 65-69):

```tsx
className={`flex items-stretch transition-all duration-150
  ${isDragging ? "opacity-30 scale-95" : ""}
  ${isDragTarget ? "ring-1 ring-cyan-500/50" : ""}
  ${!readOnly ? "cursor-grab active:cursor-grabbing" : ""}
  ${rankTier.tier === "hero"
    ? "bg-zinc-950 border border-cyan-500/20 shadow-[inset_0_0_20px_rgba(0,240,255,0.03)]"
    : rankTier.tier === "mid"
    ? "bg-zinc-950 border border-zinc-800/40"
    : "bg-zinc-950/80 border border-zinc-800/30"}`}
```

- [ ] **Step 5: Add the glowPulse keyframe**

This keyframe needs to be in the Tailwind config or globals.css. Add to `web/app/globals.css` in the `@theme inline` block or as a standalone `@keyframes`:

```css
@keyframes glowPulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add web/components/goblin/GoblinRankingItem.tsx web/app/globals.css
git commit -m "feat(goblin): add rank number glow + threat-level sidebar to ranking items"
```

---

### Task 2: GoblinRankingItem — Image Upgrade + HUD Corner Brackets

Responsive image sizing and the HUD corner bracket overlay for top-3 items.

**Files:**
- Modify: `web/components/goblin/GoblinRankingItem.tsx`

- [ ] **Step 1: Update image container with responsive sizing and corner brackets**

Replace the thumbnail section (lines 116-120):

```tsx
{/* Thumbnail with HUD frame */}
{imageUrl ? (
  <div className={`flex-shrink-0 relative overflow-hidden bg-zinc-900
    ${rankTier.tier === "hero" ? "w-20 sm:w-[100px]" : "w-14 sm:w-[100px]"}
    ${rankTier.tier === "rest" ? "opacity-70" : ""}`}
    style={{ aspectRatio: "16/10" }}
  >
    <SmartImage src={imageUrl} alt="" fill className="object-cover" />
    {/* Corner brackets — top 3 only */}
    {rankTier.tier === "hero" && (
      <>
        <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 pointer-events-none" style={{ borderColor: rankTier.color }} />
        <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 pointer-events-none" style={{ borderColor: rankTier.color }} />
        <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 pointer-events-none" style={{ borderColor: rankTier.color }} />
        <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 pointer-events-none" style={{ borderColor: rankTier.color }} />
      </>
    )}
  </div>
) : (
  /* Empty placeholder with watermark rank */
  <div className={`flex-shrink-0 relative overflow-hidden bg-zinc-900/50
    ${rankTier.tier === "hero" ? "w-20 sm:w-[100px]" : "w-14 sm:w-[100px]"}
    flex items-center justify-center`}
    style={{ aspectRatio: "16/10" }}
  >
    <span className="font-mono text-2xl font-black text-zinc-800/30">{rank}</span>
    {/* Zinc corner brackets on placeholder */}
    <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-zinc-700/40 pointer-events-none" />
    <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-zinc-700/40 pointer-events-none" />
    <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-zinc-700/40 pointer-events-none" />
    <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-zinc-700/40 pointer-events-none" />
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/components/goblin/GoblinRankingItem.tsx
git commit -m "feat(goblin): responsive image sizing with HUD corner brackets on top-3"
```

---

### Task 3: GoblinRankingGamePage — Header + Background

The page shell gets the spy HUD header, tactical grid, scan line overlay, and accessibility queries.

**Files:**
- Modify: `web/components/goblin/GoblinRankingGamePage.tsx`
- Modify: `web/app/globals.css`

- [ ] **Step 1: Add CSS keyframes and utility classes to globals.css**

Add these keyframes to `web/app/globals.css` (after the existing `@keyframes` if any, or at the end of the file before the closing comment):

```css
/* Goblin ranking spy HUD animations */
@keyframes scanSweep {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}

@keyframes typewriter {
  from { width: 0; }
  to { width: 100%; }
}

@keyframes glitchWipe {
  0% { clip-path: inset(0); transform: translateX(0); }
  30% { clip-path: inset(0 0 60% 0); transform: translateX(2px); }
  50% { clip-path: inset(40% 0 0 0); transform: translateX(-2px); }
  100% { clip-path: inset(0); transform: translateX(0); }
}

@keyframes statusPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
```

- [ ] **Step 2: Update the page wrapper and header**

In `GoblinRankingGamePage.tsx`, replace the outer `<div>` and header section (lines 105-189). The new wrapper adds the tactical grid and scan line overlay:

```tsx
return (
  <div className="max-w-3xl mx-auto px-4 py-4 pb-28 relative"
    style={{
      backgroundImage: `linear-gradient(rgba(0,240,255,0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0,240,255,0.02) 1px, transparent 1px)`,
      backgroundSize: "40px 40px",
    }}
  >
    {/* Scan line overlay */}
    <div
      className="fixed inset-0 pointer-events-none motion-safe:block hidden"
      aria-hidden="true"
      style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,240,255,0.015) 2px, rgba(0,240,255,0.015) 4px)",
        contain: "layout style paint",
        zIndex: 50,
      }}
    />

    {/* Header */}
    <div className="mb-6">
      <div
        className="flex items-end justify-between gap-4 pb-4"
        style={{ borderBottom: "1px solid rgba(0,240,255,0.15)" }}
      >
        <div>
          {/* Classification label */}
          <p className="font-mono text-[9px] text-cyan-500/40 tracking-[0.3em] uppercase mb-2">
            {isOpen ? "OPERATION ACTIVE" : "OPERATION CLOSED"} // RANKING PROTOCOL
          </p>
          {!isOpen && (
            <p className="text-2xs text-amber-500 font-mono tracking-[0.3em] uppercase mb-1">
              FINAL RESULTS
            </p>
          )}
          <h1
            className="text-2xl sm:text-3xl font-black text-white uppercase tracking-[0.25em] leading-none"
            style={{ textShadow: "0 0 30px rgba(0,240,255,0.2)" }}
          >
            {game.name}
          </h1>
          {game.description && (
            <p className="text-2xs text-zinc-500 font-mono mt-2 tracking-[0.2em] uppercase">
              {game.description}
            </p>
          )}
          {/* Pulsing status dot + divider */}
          <div className="flex items-center gap-2 mt-3">
            <div
              className="w-1.5 h-1.5 rounded-full motion-safe:animate-[statusPulse_2s_ease-in-out_infinite]"
              style={{ background: "#00f0ff", boxShadow: "0 0 8px #00f0ff, 0 0 16px rgba(0,240,255,0.4)" }}
            />
            <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(0,240,255,0.4), transparent)" }} />
          </div>
        </div>
        <div className="flex-shrink-0">
          {saving && (
            <span className="text-2xs text-cyan-500 font-mono animate-pulse">SAVING...</span>
          )}
          {saveError && !saving && activeCategory && (
            <button
              onClick={() => saveRankings(activeCategory.id, myCategoryEntries)}
              className="text-2xs text-red-400 font-mono hover:text-red-300 transition-colors"
            >
              SAVE FAILED — TAP TO RETRY
            </button>
          )}
          {saved && !saving && !saveError && (
            <span className="text-2xs text-zinc-500 font-mono">SAVED</span>
          )}
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 mt-4 overflow-x-auto scrollbar-hide">
        {game.categories.map((cat, i) => (
          <button
            key={cat.id}
            onClick={() => handleCategorySwitch(i)}
            className={`flex-shrink-0 px-4 py-1.5 font-mono text-xs font-bold tracking-wider uppercase
              border transition-all duration-200 ${
                i === activeCategoryIdx
                  ? "border-cyan-500/40 text-white bg-cyan-500/15"
                  : "border-zinc-800 text-zinc-500 hover:text-cyan-400/70 hover:border-cyan-800/40"
              }`}
            style={i === activeCategoryIdx ? {
              boxShadow: "0 0 12px rgba(0,240,255,0.1), inset 0 0 12px rgba(0,240,255,0.05)",
            } : undefined}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex items-center justify-end gap-1 mt-3">
        {([
          { key: "mine" as View, label: "My Rankings" },
          { key: "compare" as View, label: "Compare" },
          { key: "group" as View, label: "Group" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`px-2 py-0.5 font-mono text-2xs tracking-wider uppercase
              transition-all duration-200 ${
                effectiveView === key
                  ? "text-fuchsia-400 border-b border-fuchsia-500"
                  : "text-zinc-600 hover:text-fuchsia-400/60 border-b border-transparent"
              }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
```

- [ ] **Step 3: Add glitch wipe state for category switching**

Add state and handler at the top of the component (after existing state declarations around line 29):

```tsx
const [glitching, setGlitching] = useState(false);
const contentRef = useRef<HTMLDivElement>(null);
```

Update `handleCategorySwitch` to trigger glitch:

```tsx
const handleCategorySwitch = useCallback(
  (idx: number) => {
    scrollPositions.current.set(activeCategoryIdx, window.scrollY);
    setGlitching(true);
    setActiveCategoryIdx(idx);
    const savedPos = scrollPositions.current.get(idx);
    if (savedPos != null) {
      requestAnimationFrame(() => window.scrollTo(0, savedPos));
    }
  },
  [activeCategoryIdx]
);
```

Wrap the view content area (everything after the header `</div>`) in a glitch container:

```tsx
{/* View content with glitch transition */}
<div
  ref={contentRef}
  className={glitching ? "motion-safe:animate-[glitchWipe_150ms_ease-out]" : ""}
  style={glitching ? { willChange: "clip-path" } : undefined}
  onAnimationEnd={() => setGlitching(false)}
>
  {/* ... existing sign-in banner + view content JSX ... */}
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/components/goblin/GoblinRankingGamePage.tsx web/app/globals.css
git commit -m "feat(goblin): spy HUD header, tactical grid, scan lines, glitch wipe transition"
```

---

### Task 4: GoblinRankingList — Staggered Entry + Drag Effects

Animate ranked items on load/category switch. Enhance drag-and-drop visuals.

**Files:**
- Modify: `web/components/goblin/GoblinRankingList.tsx`
- Modify: `web/app/globals.css`

- [ ] **Step 1: Add entry animation keyframe to globals.css**

```css
@keyframes rankItemEntry {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes rankItemGlitch {
  0% { opacity: 1; }
  20% { opacity: 0.7; }
  40% { opacity: 1; }
  60% { opacity: 0.8; }
  100% { opacity: 1; }
}
```

- [ ] **Step 2: Add animation key state to GoblinRankingList**

We need a key that changes on category switch to re-trigger animations. Add state near the top of the component (after line 196):

```tsx
const [animKey, setAnimKey] = useState(0);
```

We also need to detect category changes. Add a `useEffect` that watches `categoryId`:

```tsx
const prevCategoryRef = useRef(categoryId);
useEffect(() => {
  if (prevCategoryRef.current !== categoryId) {
    setAnimKey((k) => k + 1);
    prevCategoryRef.current = categoryId;
  }
}, [categoryId]);
```

- [ ] **Step 3: Apply staggered entry to ranked items**

In the ranked item rendering (inside `tierGroups.map`, around line 384), wrap each `GoblinRankingItem` with entry animation. Replace the `<div key={item.id} className="flex items-stretch group">` wrapper:

```tsx
<div
  key={`${item.id}-${animKey}`}
  className="flex items-stretch group motion-safe:animate-[rankItemEntry_300ms_ease-out_backwards]"
  style={{
    animationDelay: globalIdx < 10 ? `${globalIdx * 50}ms` : "0ms",
  }}
>
  {/* Top-3 glitch flicker after entry */}
  {globalIdx < 3 && (
    <style>{`
      @keyframes glitch-${item.id}-${animKey} {
        0%, 100% { opacity: 1; }
      }
    `}</style>
  )}
  <div className={`flex-1 min-w-0 ${globalIdx < 3 ? "motion-safe:animate-[rankItemGlitch_80ms_ease-out_300ms_backwards]" : ""}`}>
    <GoblinRankingItem
      name={item.name}
      subtitle={item.subtitle}
      description={item.description}
      imageUrl={item.image_url}
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
      onEdit={isOpen && onEditItem ? () => setEditingItemId(item.id) : undefined}
      onDelete={isOpen && onDeleteItem ? () => handleDeleteItem(item.id) : undefined}
    />
  </div>
</div>
```

- [ ] **Step 4: Enhance drag visual styling**

Update the `isDragging` and `isDragTarget` classes in `GoblinRankingItem.tsx`. These are already handled by the row styling in Task 1. But we can enhance the drop target indicator. In `GoblinRankingList.tsx`, add a drop indicator line. After the ranked item div, add:

```tsx
{/* Drop insertion line */}
{dragOver === globalIdx && dragFrom !== null && dragFrom !== globalIdx && (
  <div className="h-0.5 bg-cyan-500 shadow-[0_0_8px_rgba(0,240,255,0.4)] motion-safe:animate-pulse" />
)}
```

- [ ] **Step 5: Update unranked items with responsive images**

In the unranked section (around line 454-456), update the image container classes:

```tsx
{item.image_url && (
  <div className="flex-shrink-0 w-14 sm:w-20 relative overflow-hidden bg-zinc-900 opacity-50"
    style={{ aspectRatio: "16/10" }}>
    <SmartImage src={item.image_url} alt="" fill className="object-cover" />
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add web/components/goblin/GoblinRankingList.tsx web/app/globals.css
git commit -m "feat(goblin): staggered entry animations, top-3 glitch flicker, enhanced drag visuals"
```

---

### Task 5: GoblinRankingGroup — Images + Rank Spread Bar + CONTESTED Pulse

Add images to the group aggregated view with the rank distribution visualization.

**Files:**
- Modify: `web/components/goblin/GoblinRankingGroup.tsx`
- Modify: `web/app/globals.css`

- [ ] **Step 1: Add CONTESTED pulse keyframe to globals.css**

```css
@keyframes contestedPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
```

- [ ] **Step 2: Add SmartImage import and animation state**

At the top of `GoblinRankingGroup.tsx`, add import and state:

```tsx
import { useMemo, useState, useRef, useEffect } from "react";
import SmartImage from "@/components/SmartImage";
```

Inside the component, add animation key (same pattern as RankingList):

```tsx
const [animKey, setAnimKey] = useState(0);
const prevItemsRef = useRef(items);
useEffect(() => {
  if (prevItemsRef.current !== items) {
    setAnimKey((k) => k + 1);
    prevItemsRef.current = items;
  }
}, [items]);
```

- [ ] **Step 3: Rewrite the item rendering with images and spread bar**

Replace the `aggregated.map` section (lines 74-128) with:

```tsx
{aggregated.map((agg, i) => {
  const isContested = maxSpread > 0 && agg.spread >= maxSpread * 0.7;
  const isHero = i < 3;
  const isMid = i >= 3 && i < 10;
  const tierColor = isHero ? "#00f0ff" : isMid ? "#ff00aa" : "#52525b";
  const totalItems = items.length || 1;

  return (
    <div
      key={`${agg.item.id}-${animKey}`}
      className={`flex items-stretch transition-colors motion-safe:animate-[rankItemEntry_300ms_ease-out_backwards]
        ${isHero
          ? "bg-zinc-950 border border-cyan-500/20 shadow-[inset_0_0_20px_rgba(0,240,255,0.03)]"
          : isContested
          ? "bg-zinc-950 border border-amber-800/40"
          : "bg-zinc-950 border border-zinc-800/50"}`}
      style={{ animationDelay: i < 10 ? `${i * 50}ms` : "0ms" }}
    >
      {/* Rank number */}
      <div className="flex-shrink-0 w-14 flex items-center justify-center relative">
        <span
          className={`font-mono font-black tabular-nums ${isHero ? "text-[28px]" : isMid ? "text-xl" : "text-lg"}`}
          style={{ color: tierColor }}
        >
          {isHero ? String(i + 1).padStart(2, "0") : i + 1}
        </span>
        {isHero && (
          <span
            className="absolute inset-0 rounded-full blur-xl motion-safe:animate-[glowPulse_2s_ease-in-out_infinite] pointer-events-none"
            style={{ background: `radial-gradient(circle, ${tierColor}60 0%, transparent 70%)` }}
          />
        )}
      </div>

      {/* Image */}
      {agg.item.image_url && (
        <div className={`flex-shrink-0 relative overflow-hidden bg-zinc-900
          ${isHero ? "w-[60px] sm:w-20" : "w-[60px] sm:w-20"}`}
          style={{ aspectRatio: "16/10" }}
        >
          <SmartImage src={agg.item.image_url} alt="" fill className="object-cover" />
          {isHero && (
            <>
              <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 pointer-events-none" style={{ borderColor: tierColor }} />
              <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 pointer-events-none" style={{ borderColor: tierColor }} />
              <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 pointer-events-none" style={{ borderColor: tierColor }} />
              <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 pointer-events-none" style={{ borderColor: tierColor }} />
            </>
          )}
        </div>
      )}

      <div className="flex-1 min-w-0 py-2.5 pr-2">
        <p className="text-sm font-semibold text-white truncate">
          {agg.item.name}
          {isContested && (
            <span className="relative ml-2 text-2xs text-amber-500 font-mono">
              CONTESTED
              <span
                className="absolute inset-0 blur-sm motion-safe:animate-[contestedPulse_1.5s_ease-in-out_infinite] pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(255,217,61,0.4) 0%, transparent 70%)" }}
              />
            </span>
          )}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-2xs text-zinc-500 font-mono">
            avg #{agg.avgPosition.toFixed(1)}
          </span>
          <span className="text-2xs text-zinc-500 font-mono">
            range #{agg.minRank}–#{agg.maxRank}
          </span>
          {agg.item.subtitle && (
            <span className="text-2xs text-zinc-400 font-mono truncate">{agg.item.subtitle}</span>
          )}
        </div>

        {/* Rank distribution bar */}
        {agg.spread > 0 && (
          <div className="relative mt-1.5 h-1 bg-zinc-800 rounded-full overflow-visible">
            {/* Spread range */}
            <div
              className="absolute top-0 h-full rounded-full"
              style={{
                left: `${((agg.minRank - 1) / totalItems) * 100}%`,
                width: `${(agg.spread / totalItems) * 100}%`,
                background: `linear-gradient(90deg, ${tierColor}40, ${tierColor}20)`,
              }}
            />
            {/* User's dot */}
            {agg.myRank !== null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                style={{
                  left: `${((agg.myRank - 1) / totalItems) * 100}%`,
                  background: "#00f0ff",
                  boxShadow: "0 0 4px rgba(0,240,255,0.6)",
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Your rank */}
      {agg.myRank !== null && (
        <div className="flex-shrink-0 flex items-center pr-3">
          <span className="text-2xs text-zinc-600 font-mono">
            You: #{agg.myRank}
          </span>
        </div>
      )}

      {/* Threat sidebar */}
      {isHero && (
        <div className="flex-shrink-0 w-1 self-stretch"
          style={{ background: `linear-gradient(180deg, ${tierColor}, ${tierColor}40)` }}
        />
      )}
    </div>
  );
})}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web/components/goblin/GoblinRankingGroup.tsx web/app/globals.css
git commit -m "feat(goblin): group view images, rank spread bar, CONTESTED pulse animation"
```

---

### Task 6: GoblinRankingCompare — Images + Enhanced Deltas + DIVERGENT

Full spy-HUD treatment for the comparison view.

**Files:**
- Modify: `web/components/goblin/GoblinRankingCompare.tsx`

- [ ] **Step 1: Add animation state and image to comparison items**

Add animation key state (same pattern):

```tsx
const [animKey, setAnimKey] = useState(0);
const prevSelectedRef = useRef(selectedUserId);
useEffect(() => {
  if (prevSelectedRef.current !== selectedUserId) {
    setAnimKey((k) => k + 1);
    prevSelectedRef.current = selectedUserId;
  }
}, [selectedUserId]);
```

Add `useState, useRef, useEffect` to the import from react.

- [ ] **Step 2: Update participant selector with HUD treatment**

Replace the participant button (lines 60-74):

```tsx
<button
  key={p.user_id}
  onClick={() => setSelectedUserId(p.user_id === selectedUserId ? null : p.user_id)}
  className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 font-mono text-2xs font-bold
    tracking-[0.1em] uppercase border transition-all
    ${p.user_id === selectedUserId
      ? "border-cyan-500/40 text-cyan-300 bg-cyan-500/15"
      : "border-zinc-800 text-zinc-500 hover:text-cyan-400/60 hover:border-cyan-800/40"
    }`}
  style={p.user_id === selectedUserId ? {
    boxShadow: "0 0 12px rgba(0,240,255,0.1), inset 0 0 12px rgba(0,240,255,0.05)",
  } : undefined}
>
  {p.avatar_url && (
    <div className="relative">
      <SmartImage src={p.avatar_url} alt="" width={16} height={16} className="rounded-full" />
      {p.user_id === selectedUserId && (
        <>
          <span className="absolute -top-px -left-px w-1.5 h-1.5 border-t border-l border-cyan-500 pointer-events-none" />
          <span className="absolute -top-px -right-px w-1.5 h-1.5 border-t border-r border-cyan-500 pointer-events-none" />
          <span className="absolute -bottom-px -left-px w-1.5 h-1.5 border-b border-l border-cyan-500 pointer-events-none" />
          <span className="absolute -bottom-px -right-px w-1.5 h-1.5 border-b border-r border-cyan-500 pointer-events-none" />
        </>
      )}
    </div>
  )}
  {p.display_name}
  <span className="text-zinc-700">{p.items_ranked}</span>
</button>
```

- [ ] **Step 3: Update comparison item rendering with staggered entry and DIVERGENT label**

Replace the comparison items section (lines 83-99). Wrap each item in an animated container:

```tsx
<div className="space-y-1">
  {selectedEntries.map((entry, idx) => {
    const item = itemMap.get(entry.item_id);
    if (!item) return null;
    const myRank = myRankMap.get(entry.item_id) ?? null;
    const delta = myRank != null ? entry.sort_order - myRank : null;
    const isDivergent = delta != null && Math.abs(delta) >= 5;

    return (
      <div
        key={`${entry.item_id}-${animKey}`}
        className="motion-safe:animate-[rankItemEntry_300ms_ease-out_backwards] relative"
        style={{ animationDelay: idx < 10 ? `${idx * 50}ms` : "0ms" }}
      >
        {isDivergent && (
          <span className="absolute top-1 right-2 text-[9px] font-mono text-amber-500/70 tracking-widest uppercase z-10">
            DIVERGENT
          </span>
        )}
        <GoblinRankingItem
          name={item.name}
          subtitle={item.subtitle}
          description={item.description}
          imageUrl={item.image_url}
          rank={entry.sort_order}
          tierColor={entry.tier_color}
          readOnly
          compareRank={myRank}
        />
      </div>
    );
  })}
</div>
```

- [ ] **Step 4: Enhance the compare delta styling in GoblinRankingItem**

Back in `GoblinRankingItem.tsx`, update the compare delta section (lines 168-179) to add glow:

```tsx
{delta !== null && (
  <div className="flex-shrink-0 flex items-center pr-3">
    <span
      className="font-mono text-xs font-bold relative"
      style={{
        color: delta > 0 ? "#00d9a0" : delta < 0 ? "#ff5a5a" : "#52525b",
      }}
    >
      {delta === 0 ? "=" : delta > 0 ? `+${delta}` : String(delta)}
      {delta !== 0 && (
        <span
          className="absolute inset-0 blur-md pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${delta > 0 ? "rgba(0,217,160,0.4)" : "rgba(255,90,90,0.4)"} 0%, transparent 70%)`,
          }}
        />
      )}
    </span>
  </div>
)}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add web/components/goblin/GoblinRankingCompare.tsx web/components/goblin/GoblinRankingItem.tsx
git commit -m "feat(goblin): compare view HUD treatment, DIVERGENT labels, enhanced delta glow"
```

---

### Task 7: Browser Test + Polish

Verify everything works end-to-end in the browser. Fix any visual issues.

**Files:**
- Potentially any of the 5 modified files for tweaks

- [ ] **Step 1: Start dev server and load the ranking page**

Run: `cd web && npm run dev`
Navigate to: `http://localhost:3000/goblinday/rankings/1`

- [ ] **Step 2: Visual checklist**

Verify each of these in the browser at both 375px and desktop viewports:

- [ ] Header shows "OPERATION ACTIVE // RANKING PROTOCOL" with grid background
- [ ] Pulsing status dot visible below title
- [ ] Category tabs glow when active
- [ ] Switching categories triggers glitch wipe (brief clip-path flash)
- [ ] Ranked items animate in with stagger (first 10 items, 50ms each)
- [ ] Top-3 items: zero-padded ranks (`01`, `02`, `03`), cyan glow pulse, corner brackets on images
- [ ] Ranks 4-10: magenta rank numbers, no brackets
- [ ] Ranks 11+: zinc numbers, slightly transparent
- [ ] Threat-level sidebar visible on top-3 (cyan) and 4-10 (magenta)
- [ ] Images: 80px/56px on mobile, 100px on desktop
- [ ] Group view: images visible, spread bar renders, CONTESTED items pulse amber
- [ ] Compare view: participant avatars get brackets when selected, DIVERGENT label on large deltas
- [ ] Drag and drop: dragged item lifts, drop zone shows cyan line
- [ ] Scan line overlay visible but subtle (barely perceptible horizontal lines)
- [ ] `prefers-reduced-motion`: all animations disabled when system setting is on

- [ ] **Step 3: Fix any visual issues found**

Apply targeted fixes to whichever files need them.

- [ ] **Step 4: Final TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit any polish fixes**

```bash
git add -A
git commit -m "fix(goblin): visual polish from browser testing"
```
