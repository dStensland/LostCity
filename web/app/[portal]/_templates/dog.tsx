import { Plus_Jakarta_Sans } from "next/font/google";
import type { Portal } from "@/lib/portal-context";
import DogPortalExperience from "../_components/dog/DogPortalExperience";

interface DogTemplateProps {
  portal: Portal;
}

const dogFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dog",
  display: "swap",
});

export async function DogTemplate({ portal }: DogTemplateProps) {
  return (
    <div className={dogFont.variable}>
      <DogPortalExperience portal={portal} />
    </div>
  );
}

export type { DogTemplateProps };
