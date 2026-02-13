import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile Details | Lost City",
  description:
    "Edit your Lost City profile details including display name, bio, location, and website.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ProfileSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
