import { redirect } from "next/navigation";

// Redirect /friends to /dashboard?tab=activity
export default function FriendsPage() {
  redirect("/dashboard?tab=activity");
}
