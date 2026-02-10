"use client";

import dynamic from "next/dynamic";

const FindView = dynamic(() => import("@/components/find/FindView"), {
  ssr: false,
  loading: () => (
    <div className="py-4 space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 skeleton-shimmer rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    </div>
  ),
});

export default function FindViewLazy(props: React.ComponentProps<typeof FindView>) {
  return <FindView {...props} />;
}
