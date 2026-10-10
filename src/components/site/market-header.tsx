"use client";

import { useState, type ReactNode } from "react";
import { openCart, useCartCount } from "./shop";

/** Marketpleys uslubidagi sarlavha: katta qidiruv maydoni va savat tugmasi */
export function MarketHeader({ logo, account, cartKey }: { logo: ReactNode; account: ReactNode; cartKey?: string }) {
  const [q, setQ] = useState("");
  const count = useCartCount(cartKey ?? "");
  const search = (v: string) => window.dispatchEvent(new CustomEvent<string>("mx-shop-search", { detail: v }));

  return (
    <header className="sticky top-0 z-10 border-b border-[color:var(--s-line)] bg-[color:var(--s-bg)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-5">
        <div className="max-w-[30%] shrink-0 sm:max-w-none">{logo}</div>
        <form
          role="search"
          className="flex min-w-0 flex-1 items-center overflow-hidden rounded-xl border-2 border-[color:var(--s-primary)] bg-[color:var(--s-bg)]"
          onSubmit={(e) => {
            e.preventDefault();
            search(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value) search("");
            }}
            placeholder="Mahsulot qidirish"
            aria-label="Mahsulot qidirish"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-[color:var(--s-text)] outline-none"
          />
          <button type="submit" aria-label="Qidirish" className="grid h-9 w-10 shrink-0 place-items-center bg-[color:var(--s-primary)] text-white sm:w-12">
            <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current" strokeWidth={2.4} aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
        </form>
        {account && <div className="shrink-0 text-sm [&_button]:ml-0 [&_button]:px-2.5 sm:[&_button]:px-4">{account}</div>}
        {cartKey && (
          <button
            type="button"
            onClick={() => openCart(cartKey)}
            aria-label="Savat"
            className="relative flex shrink-0 items-center gap-1.5 rounded-xl px-2 py-2 text-sm font-semibold text-[color:var(--s-text)] hover:bg-[color:var(--s-surface)]"
          >
            <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth={1.8} aria-hidden>
              <path d="M6 7h12l-1 13H7L6 7z" strokeLinejoin="round" />
              <path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
            <span className="hidden md:inline">Savat</span>
            {count > 0 && (
              <span className="absolute top-0.5 left-6 min-w-5 rounded-full bg-[color:var(--s-accent)] px-1 text-center text-[11px] leading-5 font-bold text-white">
                {count}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
