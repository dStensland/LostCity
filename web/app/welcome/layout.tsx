import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome | Lost City",
  description: "Welcome to Lost City - discover the best events happening in Atlanta.",
};

export default function WelcomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
