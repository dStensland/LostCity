import { redirect } from "next/navigation";

export default function InviteFriendsPage() {
  redirect("/find-friends?tab=invite");
}
