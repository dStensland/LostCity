import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit an Event | Lost City",
  description: "Submit an event to Lost City to help grow the Atlanta events community.",
};

export default function SubmitEventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
