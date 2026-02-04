import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find People | Lost City",
  description: "Search for and connect with people on Lost City to see what events they're attending.",
};

export default function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
