"use client";

import { useSyncExternalStore } from "react";

/**
 * Saralangan mahsulotlar (yurakcha) — brauzerda saqlanadi.
 * Kabinetda ko'rsatish uchun mahsulotning qisqa nusxasi ham saqlanadi.
 */
export type FavItem = { id: string; name: string; price: number; imageUrl: string | null; emoji: string };

type Store = { items: FavItem[]; loaded: boolean; listeners: Set<() => void> };
const stores = new Map<string, Store>();
const EMPTY: FavItem[] = [];

function store(slug: string): Store {
  let s = stores.get(slug);
  if (!s) {
    s = { items: EMPTY, loaded: false, listeners: new Set() };
    stores.set(slug, s);
  }
  if (!s.loaded && typeof window !== "undefined") {
    s.loaded = true;
    try {
      const raw = window.localStorage.getItem(`mx-fav:${slug}`);
      const v = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(v)) s.items = v.filter((x): x is FavItem => !!x && typeof (x as FavItem).id === "string").slice(0, 200);
    } catch {
      // brauzer saqlashga ruxsat bermasa — faqat shu sahifada
    }
  }
  return s;
}

function emit(s: Store) {
  for (const l of [...s.listeners]) l();
}

export function useFavorites(slug: string): FavItem[] {
  const s = store(slug);
  return useSyncExternalStore(
    (cb) => {
      s.listeners.add(cb);
      return () => s.listeners.delete(cb);
    },
    () => store(slug).items,
    () => EMPTY,
  );
}

export function toggleFavorite(slug: string, item: FavItem) {
  const s = store(slug);
  s.items = s.items.some((i) => i.id === item.id) ? s.items.filter((i) => i.id !== item.id) : [item, ...s.items].slice(0, 200);
  try {
    window.localStorage.setItem(`mx-fav:${slug}`, JSON.stringify(s.items));
  } catch {
    // e'tiborsiz
  }
  emit(s);
}

/** Sayt bo'ylab hodisalar (sarlavha ↔ katalog) */
export const SHOP_EVENTS = {
  search: "mx-shop-search",
  category: "mx-shop-category",
  favorites: "mx-shop-fav",
} as const;

export function shopEvent(name: (typeof SHOP_EVENTS)[keyof typeof SHOP_EVENTS], detail = "") {
  window.dispatchEvent(new CustomEvent<string>(name, { detail }));
}
