import { describe, it, expect } from "vitest";
import { enrichItem, type LoaderRow } from "./load-big-stuff-page";

describe("enrichItem", () => {
  const today = "2026-04-18";

  const festivalRow: LoaderRow = {
    kind: "festival",
    id: "f1",
    title: "Inman Park Festival",
    slug: "inman-park-festival",
    startDate: "2026-04-24",
    endDate: "2026-04-26",
    festivalType: "festival",
    category: null,
    description: "A neighborhood arts festival with live music. More details here.",
    imageUrl: "https://example.com/ipf.jpg",
    neighborhood: "Inman Park",
    location: null,
  };

  it("flags isLiveNow for festivals straddling today", () => {
    const row: LoaderRow = { ...festivalRow, startDate: "2026-04-10", endDate: "2026-04-25" };
    const item = enrichItem(row, today, "atlanta");
    expect(item.isLiveNow).toBe(true);
  });

  it("does NOT flag isLiveNow when startDate > today", () => {
    const item = enrichItem(festivalRow, today, "atlanta");
    expect(item.isLiveNow).toBe(false);
  });

  it("derives type=festival for festival_type=festival", () => {
    expect(enrichItem(festivalRow, today, "atlanta").type).toBe("festival");
  });

  it("derives tier=hero for flagship or imaged festival", () => {
    expect(enrichItem(festivalRow, today, "atlanta").tier).toBe("hero");
  });

  it("derives tier=featured when image but not festival", () => {
    const row: LoaderRow = { ...festivalRow, kind: "tentpole", title: "Some Event", festivalType: null };
    expect(enrichItem(row, today, "atlanta").tier).toBe("featured");
  });

  it("derives tier=standard when no image", () => {
    const row: LoaderRow = { ...festivalRow, kind: "tentpole", title: "Some Event", festivalType: null, imageUrl: null };
    expect(enrichItem(row, today, "atlanta").tier).toBe("standard");
  });

  it("extracts teaser from description", () => {
    const item = enrichItem(festivalRow, today, "atlanta");
    expect(item.description).toBe("A neighborhood arts festival with live music.");
  });

  it("uses neighborhood as location when both present", () => {
    const item = enrichItem(festivalRow, today, "atlanta");
    expect(item.location).toBe("Inman Park");
  });

  it("falls back to location field when neighborhood null", () => {
    const row: LoaderRow = { ...festivalRow, neighborhood: null, location: "Decatur" };
    expect(enrichItem(row, today, "atlanta").location).toBe("Decatur");
  });

  it("builds festival href from slug", () => {
    const item = enrichItem(festivalRow, today, "atlanta");
    expect(item.href).toBe("/atlanta/festivals/inman-park-festival");
  });

  it("builds tentpole href with event query", () => {
    const row: LoaderRow = { ...festivalRow, kind: "tentpole", id: 42, slug: null };
    const item = enrichItem(row, today, "atlanta");
    expect(item.href).toBe("/atlanta?event=42");
  });

  it("returns startDate as-is in ISO form", () => {
    expect(enrichItem(festivalRow, today, "atlanta").startDate).toBe("2026-04-24");
  });
});
