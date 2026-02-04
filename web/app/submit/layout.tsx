import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Submit to Lost City",
  description: "Submit events, venues, and organizations to Lost City to help grow the Atlanta events community.",
};

export default function SubmitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
