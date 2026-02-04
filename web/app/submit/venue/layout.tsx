import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add a Venue | Lost City",
  description: "Add a new venue, bar, restaurant, gallery, or performance space to Lost City.",
};

export default function SubmitVenueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
