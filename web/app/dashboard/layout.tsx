import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Lost City",
  description: "Your personal dashboard for managing events, RSVPs, and saved places on Lost City.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
