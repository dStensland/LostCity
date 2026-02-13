import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Controls | Lost City",
  description: "Manage profile visibility and personalization privacy controls on Lost City.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivacySettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
