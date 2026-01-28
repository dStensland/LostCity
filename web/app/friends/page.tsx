import { redirect } from "next/navigation";

// Redirect /friends to the community view (Your People tab)
export default function FriendsPage() {
  redirect("/atl?view=community");
}
