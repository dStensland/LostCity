import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Submissions | Lost City",
  description: "View and manage your event, venue, and organization submissions to Lost City.",
};

export default function SubmissionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
