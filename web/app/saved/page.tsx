import type { Metadata } from "next";
import SavedPageClient from "./SavedPageClient";

export const metadata: Metadata = {
  title: "Your Stash - Lost City",
  description: "Your saved events, RSVPs, and invites",
};

export default function SavedPage() {
  return <SavedPageClient />;
}
