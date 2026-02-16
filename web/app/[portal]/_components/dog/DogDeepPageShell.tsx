import { Plus_Jakarta_Sans } from "next/font/google";
import { DOG_THEME_SCOPE_CLASS, DOG_THEME_CSS } from "@/lib/dog-art";
import { DogHeader } from "@/components/headers";
import { Suspense } from "react";

const dogFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-dog",
  display: "swap",
});

interface Props {
  portalSlug: string;
  pageTitle: string;
  children: React.ReactNode;
}

export default function DogDeepPageShell({
  portalSlug,
  pageTitle,
  children,
}: Props) {
  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: "#FFFBEB" }}
    >
      <style>{`
        body::before { opacity: 0 !important; }
        body::after { opacity: 0 !important; }
        .ambient-glow { opacity: 0 !important; }
        .rain-overlay { display: none !important; }
        .cursor-glow { display: none !important; }
      `}</style>
      <Suspense fallback={null}>
        <DogHeader
          portalSlug={portalSlug}
          showBackButton
          pageTitle={pageTitle}
        />
      </Suspense>
      <div className={dogFont.variable}>
        <div className={DOG_THEME_SCOPE_CLASS}>
          <style dangerouslySetInnerHTML={{ __html: DOG_THEME_CSS }} />
          <main className="max-w-5xl mx-auto px-4 pb-24 pt-6">{children}</main>
        </div>
      </div>
      <div className="sm:hidden h-20" />
    </div>
  );
}
