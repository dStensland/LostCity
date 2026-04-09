import { PlatformHeader } from "@/components/headers";
import PageFooter from "@/components/PageFooter";

export const metadata = {
  title: "Your People | Lost City",
  description: "See what your friends are doing and make plans together",
};

export default function YourPeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PlatformHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-28 space-y-6">
        {children}
      </main>
      <PageFooter />
    </div>
  );
}
