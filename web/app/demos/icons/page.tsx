"use client";

import { useState } from "react";
import CategoryIcon, { CATEGORY_CONFIG } from "@/components/CategoryIcon";
import CategoryIconPhosphor from "@/components/CategoryIconPhosphor";

type GlowIntensity = "none" | "subtle" | "default" | "intense" | "pulse";

export default function IconDemoPage() {
  const [glow, setGlow] = useState<GlowIntensity>("default");
  const [size, setSize] = useState(24);
  const [weight, setWeight] = useState<"thin" | "light" | "regular" | "bold">("light");

  const categories = Object.keys(CATEGORY_CONFIG);

  return (
    <div className="min-h-screen bg-[var(--void)] p-8">
      <h1 className="text-2xl font-bold text-[var(--cream)] mb-6">Icon Comparison</h1>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-8 p-4 bg-[var(--night)] rounded-lg border border-[var(--twilight)]">
        <label className="flex items-center gap-2">
          <span className="text-[var(--muted)] text-sm">Size:</span>
          <input
            type="range"
            min="16"
            max="48"
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-[var(--cream)] font-mono text-sm w-8">{size}</span>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-[var(--muted)] text-sm">Glow:</span>
          <select
            value={glow}
            onChange={(e) => setGlow(e.target.value as GlowIntensity)}
            className="bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] rounded px-2 py-1 text-sm"
          >
            <option value="none">None</option>
            <option value="subtle">Subtle</option>
            <option value="default">Default</option>
            <option value="intense">Intense</option>
            <option value="pulse">Pulse</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-[var(--muted)] text-sm">Phosphor Weight:</span>
          <select
            value={weight}
            onChange={(e) => setWeight(e.target.value as typeof weight)}
            className="bg-[var(--dusk)] border border-[var(--twilight)] text-[var(--cream)] rounded px-2 py-1 text-sm"
          >
            <option value="thin">Thin</option>
            <option value="light">Light</option>
            <option value="regular">Regular</option>
            <option value="bold">Bold</option>
          </select>
        </label>
      </div>

      {/* Grid comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((type) => (
          <div
            key={type}
            className="p-4 bg-[var(--night)] rounded-lg border border-[var(--twilight)] hover:border-[var(--coral)]/30 transition-colors"
          >
            <div className="flex items-center gap-4 mb-2">
              {/* Original Custom SVG */}
              <div className="flex flex-col items-center gap-1">
                <CategoryIcon type={type} size={size} glow={glow} />
                <span className="text-[0.6rem] text-[var(--muted)] font-mono">Custom</span>
              </div>

              {/* Phosphor */}
              <div className="flex flex-col items-center gap-1">
                <CategoryIconPhosphor type={type} size={size} glow={glow} weight={weight} />
                <span className="text-[0.6rem] text-[var(--muted)] font-mono">Phosphor</span>
              </div>
            </div>

            <p className="text-xs text-[var(--cream)] font-mono mt-2">{type}</p>
            <p className="text-[0.6rem] text-[var(--muted)]">
              {CATEGORY_CONFIG[type as keyof typeof CATEGORY_CONFIG]?.label}
            </p>
          </div>
        ))}
      </div>

      {/* Big showcase */}
      <div className="mt-12 p-8 bg-[var(--night)] rounded-lg border border-[var(--twilight)]">
        <h2 className="text-lg font-bold text-[var(--cream)] mb-6">Large Preview</h2>
        <div className="flex flex-wrap gap-8 justify-center">
          {["music", "restaurant", "bar", "coffee_shop", "nightlife", "art", "comedy"].map((type) => (
            <div key={type} className="flex flex-col items-center gap-4">
              <div className="flex gap-6">
                <CategoryIcon type={type} size={48} glow="intense" />
                <CategoryIconPhosphor type={type} size={48} glow="intense" weight="thin" />
              </div>
              <span className="text-xs text-[var(--muted)] font-mono">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
