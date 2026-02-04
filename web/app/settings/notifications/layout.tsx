import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notification Settings | Lost City",
  description: "Manage your notification preferences for Lost City.",
};

export default function NotificationSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
