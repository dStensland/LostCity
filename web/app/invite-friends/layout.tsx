import type { Metadata } from "next";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "Invite Friends | Lost City",
  description: "Invite your friends to join Lost City and discover events together.",
};

export default function InviteFriendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientLayout>{children}</ClientLayout>;
}
