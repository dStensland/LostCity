import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Happening Now | Lost City",
  description: "Discover what's happening right now in Atlanta - live events and open spots near you.",
};

export default function HappeningNowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
