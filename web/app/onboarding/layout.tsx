import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started | Lost City",
  description: "Personalize your Lost City experience - choose your favorite categories, neighborhoods, and organizers.",
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
