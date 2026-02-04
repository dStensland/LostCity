import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Taste Profile | Lost City",
  description: "Refine your event recommendations by rating your preferences and interests.",
};

export default function TasteProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
