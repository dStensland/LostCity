import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Taste Profile | Lost City",
  description: "Refine your event recommendations by rating your preferences and interests.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TasteProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
