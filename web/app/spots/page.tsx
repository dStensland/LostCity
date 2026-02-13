import { permanentRedirect } from "next/navigation";
import { DEFAULT_PORTAL_SLUG } from "@/lib/constants";

export default function SpotsRedirect() {
  permanentRedirect(`/${DEFAULT_PORTAL_SLUG}?view=spots`);
}
