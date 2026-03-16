"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import UserMenu from "../UserMenu";
import HeaderSearchButton from "../HeaderSearchButton";
import { useAuth } from "@/lib/auth-context";
import { ADV, ADV_FONT } from "@/lib/adventure-tokens";

const PORTAL_SLUG = "yonder";

export default function AdventureHeader() {
  const [isScrolled, setIsScrolled] = useState(false);
  useAuth();

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-[100]"
      style={{ backgroundColor: ADV.CREAM }}
    >
      <div
        className="relative h-14 flex items-center justify-between px-4"
        style={{
          borderBottom: isScrolled ? `2px solid ${ADV.DARK}` : "2px solid transparent",
          transition: "border-color 200ms",
        }}
      >
        {/* Logo */}
        <Link
          href={`/${PORTAL_SLUG}`}
          className="flex items-center gap-2 group"
        >
          <div
            className="px-3 py-1 transition-transform group-hover:scale-105"
            style={{
              backgroundColor: ADV.TERRACOTTA,
              borderRadius: 0,
            }}
          >
            <span
              className="text-lg font-bold text-white"
              style={{
                fontFamily: ADV_FONT,
                letterSpacing: "-0.01em",
              }}
            >
              Lost Track
            </span>
          </div>
        </Link>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <div
            className="flex items-center"
            style={{ color: ADV.DARK }}
          >
            <HeaderSearchButton />
          </div>
          <div
            className="flex items-center"
            style={{ color: ADV.DARK }}
          >
            <UserMenu minimal />
          </div>
        </div>
      </div>
    </header>
  );
}
