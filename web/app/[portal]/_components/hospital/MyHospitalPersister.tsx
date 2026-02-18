"use client";

import { useEffect } from "react";
import { useMyHospital } from "@/lib/hooks/useMyHospital";

type Props = {
  portalId: string;
  hospitalSlug: string;
  displayName: string;
  shortName: string;
};

export default function MyHospitalPersister({ portalId, hospitalSlug, displayName, shortName }: Props) {
  const { saveMyHospital } = useMyHospital(portalId);

  useEffect(() => {
    saveMyHospital({ slug: hospitalSlug, displayName, shortName });
  }, [saveMyHospital, hospitalSlug, displayName, shortName]);

  return null;
}
