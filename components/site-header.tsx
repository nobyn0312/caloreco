"use client";

import Link from "next/link";
import { NavAuth } from "@/components/nav-auth";

export function SiteHeader() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
        <Link
          href="/"
          className="shrink-0 text-base font-semibold tracking-tight text-neutral-900 sm:text-lg"
        >
          Caloreco
        </Link>
        <NavAuth />
      </div>
    </header>
  );
}
