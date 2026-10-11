"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { SHOP_EVENTS, shopEvent, useFavorites } from "./favorites";
import { openCart, useCartCount } from "./shop";

/**
 * Marketpleys uslubidagi sarlavha:
 * logo · Katalog · katta qidiruv · Kirish · Saralangan · Savat, pastida kategoriyalar qatori.
 */
export function MarketHeader({
  logo,
  account,
  cartKey,
  shopSlug,
  categories = [],
}: {
  logo: ReactNode;
  account: ReactNode;
  cartKey?: string;
  shopSlug?: string;
  categories?: { name: string; count: number }[];
}) {
  const [q, setQ] = useState("");
  const [catalog, setCatalog] = useState(false);
  const [active, setActive] = useState("");
  const count = useCartCount(cartKey ?? "");
  const favs = useFavorites(shopSlug ?? "");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!catalog) return;
    const close = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setCatalog(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setCatalog(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [catalog]);

  const pick = (c: string) => {
    setActive(c);
    setCatalog(false);
    shopEvent(SHOP_EVENTS.category, c);
  };
  const hasShop = !!cartKey;
  const iconBtn = "relative flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1 text-[11px] font-medium text-[color:var(--s-text)] hover:bg-[color:var(--s-surface)] sm:flex-row sm:gap-1.5 sm:py-2 sm:text-sm";

  return (
    <header ref={panelRef} className="sticky top-0 z-20 border-b border-[color:var(--s-line)] bg-[color:var(--s-bg)]/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-5">
        <div className="max-w-[30%] shrink-0 sm:max-w-none">{logo}</div>
        {hasShop && categories.length > 0 && (
          <button
            type="button"
            onClick={() => setCatalog((v) => !v)}
            aria-expanded={catalog}
            className="hidden shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-[color:var(--s-primary)] md:flex"
            style={{ background: "color-mix(in srgb, var(--s-primary) 10%, var(--s-bg))" }}
          >
            <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth={2} aria-hidden>
              {catalog ? <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /> : <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />}
            </svg>
            Katalog
          </button>
        )}
        <form
          role="search"
          className="flex min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-[color:var(--s-line)] bg-[color:var(--s-bg)] focus-within:border-[color:var(--s-primary)]"
          onSubmit={(e) => {
            e.preventDefault();
            setActive("");
            shopEvent(SHOP_EVENTS.search, q);
          }}
        >
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              if (!e.target.value) shopEvent(SHOP_EVENTS.search, "");
            }}
            placeholder="Mahsulot va kategoriyalarni qidirish"
            aria-label="Mahsulot qidirish"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-[color:var(--s-text)] outline-none"
          />
          <button type="submit" aria-label="Qidirish" className="grid h-10 w-11 shrink-0 place-items-center bg-[color:var(--s-surface)] text-[color:var(--s-text)] sm:w-14">
            <svg viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth={2.2} aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </button>
        </form>
        {account && <div className="shrink-0 text-sm [&>button]:ml-0 [&>button]:px-2.5 sm:[&>button]:px-4">{account}</div>}
        {hasShop && (
          <button type="button" onClick={() => shopEvent(SHOP_EVENTS.favorites)} aria-label="Saralangan" className={`${iconBtn} hidden sm:flex`}>
            <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth={1.8} aria-hidden>
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" strokeLinejoin="round" />
            </svg>
            <span className="hidden lg:inline">Saralangan</span>
            {favs.length > 0 && <Badge n={favs.length} />}
          </button>
        )}
        {hasShop && (
          <button type="button" onClick={() => openCart(cartKey!)} aria-label="Savat" className={iconBtn}>
            <svg viewBox="0 0 24 24" className="size-6 fill-none stroke-current" strokeWidth={1.8} aria-hidden>
              <path d="M6 7h12l-1 13H7L6 7z" strokeLinejoin="round" />
              <path d="M9 7a3 3 0 0 1 6 0" />
            </svg>
            <span className="hidden lg:inline">Savat</span>
            {count > 0 && <Badge n={count} />}
          </button>
        )}
      </div>

      {hasShop && categories.length > 0 && (
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2 text-sm [scrollbar-width:none] sm:px-5">
          <button
            type="button"
            onClick={() => setCatalog((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold text-[color:var(--s-primary)] md:hidden"
            style={{ background: "color-mix(in srgb, var(--s-primary) 10%, var(--s-bg))" }}
          >
            ☰ Katalog
          </button>
          {favs.length > 0 && (
            <button
              type="button"
              onClick={() => shopEvent(SHOP_EVENTS.favorites)}
              className="flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 font-medium text-[color:var(--s-text)] hover:bg-[color:var(--s-surface)] sm:hidden"
            >
              ♥ Saralangan
            </button>
          )}
          {categories.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => pick(active === c.name ? "" : c.name)}
              className={`shrink-0 rounded-lg px-3 py-1.5 whitespace-nowrap transition ${
                active === c.name ? "bg-[color:var(--s-surface)] font-semibold text-[color:var(--s-heading)]" : "text-[color:var(--s-muted)] hover:text-[color:var(--s-text)]"
              }`}
            >
              {c.name}
            </button>
          ))}
        </nav>
      )}

      {catalog && (
        <div className="absolute inset-x-0 top-full border-b border-[color:var(--s-line)] bg-[color:var(--s-bg)] shadow-xl">
          <div className="mx-auto max-h-[70dvh] w-full max-w-6xl overflow-y-auto px-4 py-5 sm:px-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-bold text-[color:var(--s-heading)]">Katalog</p>
              <button type="button" onClick={() => pick("")} className="text-sm font-semibold text-[color:var(--s-accent)]">
                Barcha mahsulotlar
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {categories.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => pick(c.name)}
                  className="flex items-center justify-between gap-2 rounded-xl bg-[color:var(--s-surface)] px-3 py-3 text-left text-sm font-medium text-[color:var(--s-text)] transition hover:ring-2 hover:ring-[color:var(--s-primary)]"
                >
                  <span className="line-clamp-2">{c.name}</span>
                  <span className="shrink-0 text-xs text-[color:var(--s-muted)]">{c.count}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="absolute top-0 left-6 min-w-5 rounded-full bg-[color:var(--s-accent)] px-1 text-center text-[11px] leading-5 font-bold text-white sm:left-5">
      {n > 99 ? "99+" : n}
    </span>
  );
}
