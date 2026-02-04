import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Add an Organization | Lost City",
  description: "Add an arts nonprofit, event producer, or community group to Lost City.",
};

export default function SubmitOrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
