import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

// Redirect /foryou to /dashboard
export default function ForYouPage() {
  redirect("/dashboard");
}
