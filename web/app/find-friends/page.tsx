import { Suspense } from "react";
import { FindFriendsContent } from "@/components/find-friends/FindFriendsContent";
import PageFooter from "@/components/PageFooter";

export const metadata = {
  title: "Find Friends | Lost City",
  description: "Find and invite your friends to Lost City.",
};

export default function FindFriendsPage() {
  return (
    <>
      <Suspense fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[var(--coral)] border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <FindFriendsContent />
      </Suspense>
      <PageFooter />
    </>
  );
}
