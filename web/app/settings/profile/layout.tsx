import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Profile | Lost City",
  description: "Edit your Lost City profile - update your username, display name, bio, and avatar.",
};

export default function ProfileSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
