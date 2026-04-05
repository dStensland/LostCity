import type { Metadata } from "next";
import EffectsGallery from "./EffectsGallery";

export const metadata: Metadata = {
  title: "Effects Lab | Lost City",
};

export default function EffectsLabPage() {
  return <EffectsGallery />;
}
