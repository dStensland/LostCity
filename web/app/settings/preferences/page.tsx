import { redirect } from "next/navigation";

export default function PreferencesSettingsRedirect() {
  redirect("/settings?tab=preferences");
}
