"use client";

import dynamic from "next/dynamic";

const FindView = dynamic(() => import("@/components/find/FindView"), {
  ssr: false,
});

export default function FindViewLazy(props: React.ComponentProps<typeof FindView>) {
  return <FindView {...props} />;
}
