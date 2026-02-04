import type { Metadata } from "next";
import ClientLayout from "./client-layout";

export const metadata: Metadata = {
  title: "My Calendar | Lost City",
  description: "View your event calendar with RSVPs and see what your friends are planning to attend.",
};

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientLayout>{children}</ClientLayout>;
}
