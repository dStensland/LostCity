import { Bebas_Neue, Fraunces, Space_Grotesk } from "next/font/google";
import type { Portal } from "@/lib/portal-context";
import FilmPortalExperience from "../_components/film/FilmPortalExperience";

interface FilmTemplateProps {
  portal: Portal;
}

const filmDisplay = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-film-display",
  display: "swap",
});

const filmEditorial = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-film-editorial",
  display: "swap",
});

const filmBody = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-film-body",
  display: "swap",
});

export async function FilmTemplate({ portal }: FilmTemplateProps) {
  return (
    <div className={`${filmDisplay.variable} ${filmEditorial.variable} ${filmBody.variable}`}>
      <FilmPortalExperience portal={portal} />
    </div>
  );
}

export type { FilmTemplateProps };
