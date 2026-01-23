import { redirect } from "next/navigation";

// Redirect /foryou to /dashboard
export default function ForYouPage() {
  redirect("/dashboard");
}
