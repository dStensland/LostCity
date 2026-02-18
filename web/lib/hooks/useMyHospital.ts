"use client";

import { useState, useCallback, useSyncExternalStore } from "react";

export type MyHospitalData = {
  slug: string;
  displayName: string;
  shortName: string;
  savedAt: string;
};

type UseMyHospitalResult = {
  myHospital: MyHospitalData | null;
  loaded: boolean;
  saveMyHospital: (data: Omit<MyHospitalData, "savedAt">) => void;
  clearMyHospital: () => void;
};

function getStorageKey(portalId: string): string {
  return `lostcity_my_hospital_${portalId}`;
}

function readFromStorage(portalId: string): MyHospitalData | null {
  try {
    const stored = localStorage.getItem(getStorageKey(portalId));
    if (stored) {
      const parsed = JSON.parse(stored) as MyHospitalData;
      if (parsed.slug && parsed.displayName) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Track a version counter to trigger re-reads from storage
let storageVersion = 0;
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners() {
  storageVersion++;
  for (const listener of listeners) listener();
}

function getSnapshot() {
  return storageVersion;
}

function getServerSnapshot() {
  return 0;
}

export function useMyHospital(portalId: string): UseMyHospitalResult {
  // Use useSyncExternalStore to avoid setState-in-effect lint issues
  const version = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [loaded, setLoadedState] = useState(false);

  // On first client render, mark as loaded
  // useSyncExternalStore guarantees we're on the client when version > 0 or on mount
  const myHospital = typeof window !== "undefined" ? readFromStorage(portalId) : null;

  // Track loaded state — we're loaded once we've read from storage on the client
  if (typeof window !== "undefined" && !loaded) {
    // Safe: this is a state initialization guard, not a cascading render
    setLoadedState(true);
  }

  // Suppress unused variable warning — version is used to trigger re-render
  void version;

  const saveMyHospital = useCallback(
    (data: Omit<MyHospitalData, "savedAt">) => {
      const record: MyHospitalData = { ...data, savedAt: new Date().toISOString() };
      try {
        localStorage.setItem(getStorageKey(portalId), JSON.stringify(record));
      } catch {
        // Storage full or unavailable
      }
      notifyListeners();
    },
    [portalId],
  );

  const clearMyHospital = useCallback(() => {
    try {
      localStorage.removeItem(getStorageKey(portalId));
    } catch {
      // Ignore
    }
    notifyListeners();
  }, [portalId]);

  return { myHospital, loaded, saveMyHospital, clearMyHospital };
}
