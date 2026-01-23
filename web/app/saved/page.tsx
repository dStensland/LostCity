import { redirect } from "next/navigation";

// Redirect /saved to /dashboard?tab=planning
export default function SavedPage() {
  redirect("/dashboard?tab=planning");
}
