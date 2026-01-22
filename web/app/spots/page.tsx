import { redirect } from "next/navigation";

export default function SpotsRedirect() {
  redirect("/atlanta?view=spots");
}
