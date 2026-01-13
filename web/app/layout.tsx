import type { Metadata } from "next";
import { Righteous, Outfit } from "next/font/google";
import "./globals.css";

const righteous = Righteous({
  weight: "400",
  variable: "--font-righteous",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lost City - Atlanta Events",
  description: "Discover events in Atlanta. AI-powered event aggregation from 20+ sources.",
  openGraph: {
    title: "Lost City - Atlanta Events",
    description: "Discover events in Atlanta",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${righteous.variable} ${outfit.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
