/**
 * Production ambient effects registry.
 *
 * Exposes the 14 shortlisted effects from the lab gallery by URL-safe slug.
 * Each effect is a Canvas 2D init function: (canvas) => cleanup.
 * Zero external dependencies — pure canvas + math.
 *
 * Usage:
 *   import { ambientEffects, type AmbientEffectSlug } from "@/lib/ambient-effects";
 *   const cleanup = ambientEffects["pollen-season"].init(canvas);
 */

import { effects, type EffectDef } from "@/app/lab/effects/effect-defs";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const PRODUCTION_SET = new Set([
  "Trunk Rings",
  "Aurora",
  "Unknown Pleasures",
  "Mesh Gradient",
  "Moiré Waves",
  "Dot Grid",
  "Noise Terrain",
  "Rain",
  "Electric Arc",
  "Bokeh",
  "Smoke",
  "Cellular",
  "Starfield",
  "Pollen Season",
]);

export type AmbientEffect = {
  name: string;
  slug: string;
  description: string;
  tags: string[];
  init: EffectDef["init"];
};

const registry = new Map<string, AmbientEffect>();

for (const effect of effects) {
  if (!PRODUCTION_SET.has(effect.name)) continue;
  const slug = slugify(effect.name);
  registry.set(slug, {
    name: effect.name,
    slug,
    description: effect.description,
    tags: effect.tags,
    init: effect.init,
  });
}

/** All production-ready ambient effects keyed by slug. */
export const ambientEffects = Object.fromEntries(registry) as Record<
  string,
  AmbientEffect
>;

/** Type-safe slug union for the production set. */
export type AmbientEffectSlug = keyof typeof ambientEffects;

/** Ordered list of all production effects. */
export const ambientEffectList: AmbientEffect[] = [...registry.values()];

/** Get a single effect by slug, or undefined. */
export function getAmbientEffect(slug: string): AmbientEffect | undefined {
  return registry.get(slug);
}
