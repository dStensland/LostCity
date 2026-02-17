import { redirect } from "next/navigation";

export default function TasteProfileSettingsRedirect() {
  redirect("/settings?tab=taste");
}
