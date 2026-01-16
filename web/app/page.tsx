import { redirect } from "next/navigation";

// Redirect root to Atlanta portal
// In the future, this can be a landing page about Lost City
export default function Home() {
  redirect("/atlanta");
}
