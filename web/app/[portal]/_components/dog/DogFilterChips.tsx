"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface FilterOption {
  key: string;
  label: string;
}

interface Props {
  paramName: string;
  options: readonly FilterOption[];
  defaultValue?: string;
}

export default function DogFilterChips({
  paramName,
  options,
  defaultValue = "all",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams?.get(paramName) || defaultValue;

  const setFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams?.toString() || "");
      if (value === defaultValue) {
        params.delete(paramName);
      } else {
        params.set(paramName, value);
      }
      const qs = params.toString();
      router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams, paramName, defaultValue]
  );

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {options.map((opt) => {
        const active = current === opt.key;
        return (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors"
            style={{
              background: active
                ? "var(--dog-orange)"
                : "rgba(253, 232, 138, 0.25)",
              color: active ? "#fff" : "var(--dog-charcoal)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
