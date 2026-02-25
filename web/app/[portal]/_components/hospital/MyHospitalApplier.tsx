"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMyHospital } from "@/lib/hooks/useMyHospital";

type Props = {
  portalId: string;
};

export default function MyHospitalApplier({ portalId }: Props) {
  const { myHospital, loaded } = useMyHospital(portalId);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loaded || !myHospital) return;
    if (searchParams.has("hospital")) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("hospital", myHospital.slug);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [loaded, myHospital, searchParams, router]);

  return null;
}
