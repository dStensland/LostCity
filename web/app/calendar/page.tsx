import { redirect } from "next/navigation";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";

export default function CalendarRedirect() {
  redirect(`/${DEFAULT_PORTAL_SLUG}/plans`);
}
