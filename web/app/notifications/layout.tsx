import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications | Lost City",
  description: "View your notifications and friend requests on Lost City.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
