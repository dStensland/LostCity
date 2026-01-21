import type { Metadata } from "next";
import { Outfit, Instrument_Serif, JetBrains_Mono, Space_Grotesk, Bebas_Neue } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/Toast";
import DarkHoursTheme from "@/components/DarkHoursTheme";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: "italic",
  variable: "--font-instrument",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lost City - Discover Local Events",
  description: "Discover local events near you. AI-powered event aggregation from 20+ sources.",
  openGraph: {
    title: "Lost City - Discover Local Events",
    description: "Discover local events near you",
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
      <body className={`${outfit.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${bebasNeue.variable} antialiased`}>
        {/* Ambient glow effect */}
        <div className="ambient-glow" aria-hidden="true" />
        <AuthProvider>
          <DarkHoursTheme />
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
