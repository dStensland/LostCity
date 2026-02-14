import { Playfair_Display, DM_Sans, Space_Grotesk } from "next/font/google";
import type { Portal } from "@/lib/portal-context";
import type { MarketplacePersona } from "@/lib/marketplace-art";
import MarketplacePortalExperience from "../_components/marketplace/MarketplacePortalExperience";

interface MarketplaceTemplateProps {
  portal: Portal;
  persona?: MarketplacePersona;
}

const marketplaceDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const marketplaceBody = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

const marketplaceLabel = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-label",
  display: "swap",
});

export async function MarketplaceTemplate({
  portal,
  persona = "visitor",
}: MarketplaceTemplateProps) {
  return (
    <div
      className={`${marketplaceDisplay.variable} ${marketplaceBody.variable} ${marketplaceLabel.variable}`}
    >
      <MarketplacePortalExperience portal={portal} persona={persona} />
    </div>
  );
}

export type { MarketplaceTemplateProps };
