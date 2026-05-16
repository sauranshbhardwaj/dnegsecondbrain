"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { AuthNav } from "@/components/auth-nav";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScrolled = () => {
      setScrolled(window.scrollY > 8);
    };

    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });

    return () => {
      window.removeEventListener("scroll", updateScrolled);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-colors duration-300 ${
        scrolled
          ? "border-b border-[color:var(--color-border)] bg-[rgb(17_17_17_/_0.9)] backdrop-blur"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between px-5 py-10 sm:px-8 lg:px-12">
        <Link href="/" translate="no" className="group flex items-baseline gap-2 self-center rounded-[var(--radius-sm)]">
          <span className="font-display text-[22px] font-semibold leading-none text-[color:var(--color-text-primary)] transition-colors group-hover:text-[color:var(--color-gold)]">
            Kid Poker
          </span>
          <span className="text-[13px] leading-none text-[color:var(--color-text-muted)]" aria-hidden="true">
            ·
          </span>
          <span className="text-[13px] font-normal uppercase leading-none tracking-[0.15em] text-[color:var(--color-text-muted)]">
            Second Brain
          </span>
        </Link>
        <AuthNav />
      </div>
    </header>
  );
}
