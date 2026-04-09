import type { Metadata } from "next";
import InspirationGallery from "./InspirationGallery";

export const metadata: Metadata = {
  title: "Effects Inspiration | Lost City Lab",
};

export default function InspirationPage() {
  return <InspirationGallery />;
}
