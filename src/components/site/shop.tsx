"use client";

import Script from "next/script";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { formatMoney } from "@/lib/shop/format";
import type { PublicProduct, ShopData } from "@/lib/shop/types";

/**
 * Saytdagi jonli do'kon: katalog, savat va buyurtma berish.
 * Telegram Mini App ichida ochilsa, mijoz Telegram orqali tanib olinadi (initData serverda tekshiriladi).
 */

type TgWebApp = {
  initData: string;
  platform?: string;
  initDataUnsafe?: { user?: { first_name?: string; last_name?: string } };
  ready: () => void;
  expand: () => void;
  close: () => void;
  HapticFeedback?: { impactOccurred: (s: string) => void; notificationOccurred: (s: string) => void };
};

/** Telegram ichida ochilganmi (pastki menyu tugmasidan ochilganda initData bo'sh bo'ladi, lekin platform ma'lum) */
function webApp(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  const w = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  return w && (w.initData || (w.platform && w.platform !== "unknown")) ? w : null;
}

/** Bot qo'shgan imzolangan chat parametri (?tgb=&tgc=). Sahifalar orasida yo'qolmasligi uchun sessionStorage'da */
function telegramLink(): { bot: string; chat: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const q = new URLSearchParams(window.location.search);
    const bot = q.get("tgb");
    const chat = q.get("tgc");
    if (bot && chat) {
      window.sessionStorage.setItem("tz-tg", JSON.stringify({ bot, chat }));
      return { bot, chat };
    }
    const saved = window.sessionStorage.getItem("tz-tg");
    return saved ? (JSON.parse(saved) as { bot: string; chat: string }) : null;
  } catch {
    return null;
  }
}

type Cart = Record<string, number>;

type CartStore = { cart: Cart; listeners: Set<() => void>; owners: string[]; loaded: boolean; openRequest: number };
const EMPTY_CART: Cart = {};
const stores = new Map<string, CartStore>();
function getStore(key: string): CartStore {
  let s = stores.get(key);
  if (!s) {
    s = { cart: {}, listeners: new Set(), owners: [], loaded: false, openRequest: 0 };
    stores.set(key, s);
  }
  return s;
}
function notify(s: CartStore) {
  for (const l of [...s.listeners]) l();
}

function loadCart(slug: string): Cart {
  try {
    const raw = window.localStorage.getItem(`tz-cart:${slug}`);
    const v = raw ? (JSON.parse(raw) as unknown) : {};
    return v && typeof v === "object" ? (v as Cart) : {};
  } catch {
    return {};
  }
}

function saveCart(slug: string, cart: Cart) {
  try {
    window.localStorage.setItem(`tz-cart:${slug}`, JSON.stringify(cart));
  } catch {
    // brauzer saqlashga ruxsat bermasa, savat faqat shu sahifada qoladi
  }
}

const btnAccent = "rounded-[var(--s-radius)] bg-[color:var(--s-accent)] font-semibold text-white transition hover:brightness-110 disabled:opacity-50";
const input =
  "w-full rounded-[calc(var(--s-radius)*0.6)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)] px-3 py-2.5 text-[color:var(--s-text)] outline-none focus:border-[color:var(--s-accent)]";
/** Rasm yo'q mahsulot uchun yumshoq fon (aksent rangidan) */
const tint = { background: "color-mix(in srgb, var(--s-accent) 9%, var(--s-bg))" } as const;

function discount(p: Pick<PublicProduct, "price" | "oldPrice">) {
  return p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
}

function ProductImage({ p, className, big = false }: { p: Pick<PublicProduct, "imageUrl" | "emoji" | "name">; className: string; big?: boolean }) {
  if (p.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.imageUrl} alt={p.name} loading="lazy" className={`${className} object-cover`} />;
  }
  return (
    <div className={`${className} grid place-items-center`} style={tint}>
      {p.emoji ? (
        <span className={big ? "text-8xl" : "text-5xl sm:text-6xl"}>{p.emoji}</span>
      ) : (
        <span className={`font-extrabold text-[color:var(--s-accent)] opacity-60 ${big ? "text-8xl" : "text-5xl"}`}>{p.name.trim().charAt(0).toUpperCase() || "•"}</span>
      )}
    </div>
  );
}

function Stepper({ qty, max, onChange, size = "md" }: { qty: number; max: number; onChange: (q: number) => void; size?: "md" | "lg" }) {
  const pad = size === "lg" ? "px-4 py-2.5 text-xl" : "px-3 py-1.5 text-lg";
  return (
    <div className="flex items-center justify-between overflow-hidden rounded-[var(--s-radius)] font-bold text-[color:var(--s-accent)]" style={tint}>
      <button type="button" aria-label="Kamaytirish" onClick={() => onChange(qty - 1)} className={pad}>
        −
      </button>
      <span className="min-w-8 text-center text-[color:var(--s-text)]">{qty}</span>
      <button type="button" aria-label="Ko'paytirish" disabled={qty >= max} onClick={() => onChange(qty + 1)} className={`${pad} disabled:opacity-30`}>
        +
      </button>
    </div>
  );
}

function AddControl({ p, qty, canOrder, onChange }: { p: PublicProduct; qty: number; canOrder: boolean; onChange: (q: number) => void }) {
  if (!p.inStock) return <p className="py-2 text-center text-sm text-[color:var(--s-muted)]">Tugagan</p>;
  if (!canOrder) return null;
  if (qty > 0) return <Stepper qty={qty} max={p.maxQty} onChange={onChange} />;
  return (
    <button type="button" onClick={() => onChange(1)} className={`${btnAccent} w-full py-2 text-sm`}>
      + Savatga
    </button>
  );
}

/** Katalog blokining ko'rinish sozlamalari (tahrirlovchidan) */
export type ShopLayout = {
  category: string;
  limit: number;
  columns: "2" | "3" | "4";
  mobileColumns: "1" | "2";
  card: "border" | "shadow" | "flat";
  ratio: "square" | "portrait" | "landscape";
  showDescription: boolean;
  showSearch: boolean;
  align: "left" | "center";
};

const DEFAULT_LAYOUT: ShopLayout = {
  category: "",
  limit: 0,
  columns: "4",
  mobileColumns: "2",
  card: "border",
  ratio: "square",
  showDescription: false,
  showSearch: true,
  align: "center",
};

const RATIO = { square: "aspect-square", portrait: "aspect-[4/5]", landscape: "aspect-[4/3]" } as const;
const CARD = {
  border: "border border-[color:var(--s-line)] hover:shadow-lg",
  shadow: "shadow-md hover:shadow-xl",
  flat: "",
} as const;
const GRID: Record<ShopLayout["mobileColumns"], Record<ShopLayout["columns"], string>> = {
  "1": { "2": "grid-cols-1 sm:grid-cols-2", "3": "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", "4": "grid-cols-1 sm:grid-cols-3 lg:grid-cols-4" },
  "2": { "2": "grid-cols-2", "3": "grid-cols-2 lg:grid-cols-3", "4": "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" },
};

export function ShopSection({
  shop,
  heading,
  subheading,
  anchor,
  layout: layoutProp,
  headingNode,
  subheadingNode,
}: {
  shop: ShopData;
  heading: string;
  subheading: string;
  anchor: string;
  layout?: ShopLayout;
  /** Tahrirlovchida joyida tahrirlanadigan sarlavha */
  headingNode?: React.ReactNode;
  subheadingNode?: React.ReactNode;
}) {
  const layout = layoutProp ?? DEFAULT_LAYOUT;
  const settings = shop.settings;
  // Blok faqat bitta kategoriyani ko'rsatishi mumkin (masalan "Atirgullar" bo'limi)
  const products = useMemo(() => {
    const list = layout.category ? shop.products.filter((p) => p.category === layout.category) : shop.products;
    return layout.limit > 0 ? list.slice(0, layout.limit) : list;
  }, [shop.products, layout.category, layout.limit]);
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(48);
  const [returnedOrder, setReturnedOrder] = useState<string | null>(null);
  useEffect(() => {
    try {
      const n = new URLSearchParams(window.location.search).get("order");
      if (n && /^\d{1,9}$/.test(n)) setReturnedOrder(n);
    } catch {
      // e'tiborsiz
    }
  }, []);
  const [detail, setDetail] = useState<PublicProduct | null>(null);
  const [open, setOpen] = useState<null | "cart" | "checkout" | "done">(null);
  const [inTelegram, setInTelegram] = useState(false);

  // Savat butun sayt uchun bitta: sahifada bir nechta katalog bloki bo'lsa ham umumiy
  const byId = useMemo(() => new Map(shop.products.map((p) => [p.id, p])), [shop.products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))], [products]);
  const storeKey = shop.embedded ? `embedded:${shop.slug}` : shop.slug;
  const store = getStore(storeKey);
  const cart = useSyncExternalStore(
    (cb) => {
      store.listeners.add(cb);
      return () => store.listeners.delete(cb);
    },
    () => store.cart,
    () => EMPTY_CART,
  );
  // Suzuvchi savat tugmasi va savat oynasini faqat birinchi katalog bloki ko'rsatadi
  const myId = useId();
  const [isOwner, setIsOwner] = useState(false);
  useEffect(() => {
    store.owners.push(myId);
    const check = () => setIsOwner(store.owners[0] === myId);
    store.listeners.add(check);
    notify(store);
    return () => {
      store.owners = store.owners.filter((o) => o !== myId);
      store.listeners.delete(check);
      notify(store);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, myId]);

  // Boshqa katalog blokidagi "Savatga o'tish" tugmasi savatni shu (birinchi) blokda ochadi
  const lastOpen = useRef(store.openRequest);
  useEffect(() => {
    const onRequest = () => {
      if (store.openRequest > lastOpen.current) {
        lastOpen.current = store.openRequest;
        if (store.owners[0] === myId) setOpen("cart");
      }
    };
    store.listeners.add(onRequest);
    return () => {
      store.listeners.delete(onRequest);
    };
  }, [store, myId]);

  useEffect(() => {
    if (shop.embedded || store.loaded) return;
    store.loaded = true;
    telegramLink();
    const stored = loadCart(shop.slug);
    const clean: Cart = {};
    for (const [id, q2] of Object.entries(stored)) {
      const p = byId.get(id);
      if (p && p.inStock && Number.isInteger(q2) && q2 > 0) clean[id] = Math.min(q2, p.maxQty);
    }
    store.cart = clean;
    notify(store);
  }, [shop.slug, shop.embedded, byId, store]);

  function update(id: string, qty: number) {
    const next = { ...store.cart };
    if (qty <= 0) delete next[id];
    else next[id] = Math.min(qty, byId.get(id)?.maxQty ?? 99);
    store.cart = next;
    if (!shop.embedded) saveCart(shop.slug, next);
    notify(store);
    webApp()?.HapticFeedback?.impactOccurred("light");
  }

  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ p: byId.get(id), qty }))
    .filter((l): l is { p: PublicProduct; qty: number } => !!l.p);
  const count = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const q = query.trim().toLowerCase();
  const visible = products.filter((p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q)));
  const showSearch = layout.showSearch && products.length >= 6;
  const showTools = layout.showSearch && (categories.length > 1 || products.length >= 6);
  const left = layout.align === "left";

  function onTelegramLoad() {
    const w = webApp();
    if (!w) return;
    setInTelegram(true);
    try {
      w.ready();
      w.expand();
    } catch {
      // eski Telegram versiyasi
    }
  }

  return (
    <section id={anchor} className="scroll-mt-16 py-12 sm:py-16">
      {!shop.embedded && <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onLoad={onTelegramLoad} />}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-5">
        {(heading || subheading) && (
          <div className={left ? "" : "text-center"}>
            {heading && <h2 className="text-2xl font-bold tracking-tight text-[color:var(--s-heading)] sm:text-3xl">{headingNode ?? heading}</h2>}
            {subheading && <p className={`mt-2 max-w-2xl text-[color:var(--s-muted)] ${left ? "" : "mx-auto"}`}>{subheadingNode ?? subheading}</p>}
          </div>
        )}

        {returnedOrder && (
          <div className="s-card mx-auto mt-6 max-w-md rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)] px-4 py-3 text-center text-sm">
            ✅ Buyurtma №{returnedOrder} qabul qilindi. To&apos;lov tasdiqlangach sizga xabar beramiz.
          </div>
        )}

        {!settings.acceptOrders && (
          <p className="mx-auto mt-6 max-w-md rounded-[var(--s-radius)] border border-[color:var(--s-line)] px-4 py-3 text-center text-sm">
            Hozircha onlayn buyurtma qabul qilinmayapti.
          </p>
        )}

        {showTools && (
          <div className="sticky top-16 z-[5] -mx-4 mt-6 space-y-2 bg-[color:var(--s-bg)]/95 px-4 py-2 backdrop-blur sm:-mx-5 sm:px-5">
            {showSearch && (
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(48);
                }}
                placeholder="🔍 Qidirish…" className={`${input} py-2`} />
            )}
            {categories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                {["", ...categories].map((c) => (
                  <button
                    key={c || "all"}
                    type="button"
                    onClick={() => {
                      setCategory(c);
                      setShown(48);
                    }}
                    className={`rounded-full px-4 py-1.5 text-sm whitespace-nowrap transition ${
                      category === c ? "bg-[color:var(--s-accent)] font-semibold text-white" : "border border-[color:var(--s-line)]"
                    }`}
                  >
                    {c || "Hammasi"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {products.length === 0 ? (
          <p className="mt-10 text-center text-[color:var(--s-muted)]">Mahsulotlar tez orada qo&apos;shiladi.</p>
        ) : visible.length === 0 ? (
          <p className="mt-10 text-center text-[color:var(--s-muted)]">Hech narsa topilmadi</p>
        ) : (
          <div
            className={`mt-6 grid gap-3 sm:gap-5 ${
              visible.length === 1 && !left ? "mx-auto max-w-xs grid-cols-1" : visible.length === 2 && !left ? "mx-auto max-w-xl grid-cols-2" : GRID[layout.mobileColumns][layout.columns]
            }`}
          >
            {visible.slice(0, shown).map((p) => {
              const off = discount(p);
              return (
                <article
                  key={p.id}
                  className={`s-card group flex flex-col overflow-hidden rounded-[var(--s-radius)] bg-[color:var(--s-bg)] transition hover:-translate-y-0.5 ${CARD[layout.card]}`}
                >
                  <button type="button" onClick={() => setDetail(p)} className="relative block text-left" aria-label={p.name}>
                    <ProductImage p={p} className={`${RATIO[layout.ratio]} w-full transition duration-300 group-hover:scale-[1.03] ${p.inStock ? "" : "opacity-50 grayscale"}`} />
                    {off > 0 && (
                      <span className="absolute top-2 left-2 rounded-full bg-[color:var(--s-accent)] px-2 py-0.5 text-xs font-bold text-white">−{off}%</span>
                    )}
                    {!p.inStock && (
                      <span className="absolute inset-x-2 bottom-2 rounded-full bg-black/60 px-2 py-1 text-center text-xs font-semibold text-white">Tugagan</span>
                    )}
                  </button>
                  <div className="flex flex-1 flex-col p-3">
                    <button type="button" onClick={() => setDetail(p)} className="text-left">
                      <h3 className="line-clamp-2 text-[15px] leading-snug font-semibold">{p.name}</h3>
                    </button>
                    {layout.showDescription && p.description && <p className="mt-1 line-clamp-2 text-sm text-[color:var(--s-muted)]">{p.description}</p>}
                    <div className="mt-auto pt-2">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-base font-extrabold text-[color:var(--s-heading)] sm:text-lg">{formatMoney(p.price)}</span>
                        {off > 0 && <span className="text-xs text-[color:var(--s-muted)] line-through">{formatMoney(p.oldPrice)}</span>}
                      </p>
                      <div className="mt-2">
                        <AddControl p={p} qty={cart[p.id] ?? 0} canOrder={settings.acceptOrders} onChange={(q2) => update(p.id, q2)} />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {visible.length > shown && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + 48)}
              className="rounded-[var(--s-radius)] border border-[color:var(--s-line)] px-6 py-2.5 font-semibold hover:border-[color:var(--s-accent)]"
            >
              Ko&apos;proq ko&apos;rsatish ({visible.length - shown})
            </button>
          </div>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setDetail(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="s-card max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[var(--s-radius)] bg-[color:var(--s-bg)] text-[color:var(--s-text)] sm:rounded-[var(--s-radius)]"
          >
            <div className="relative">
              <ProductImage p={detail} big className="aspect-square w-full" />
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Yopish"
                className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-black/50 text-xl text-white"
              >
                ×
              </button>
            </div>
            <div className="space-y-3 p-5">
              {detail.category && <p className="text-xs font-semibold tracking-wide text-[color:var(--s-accent)] uppercase">{detail.category}</p>}
              <h3 className="text-xl font-bold">{detail.name}</h3>
              <p className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-[color:var(--s-heading)]">{formatMoney(detail.price)}</span>
                {discount(detail) > 0 && <span className="text-[color:var(--s-muted)] line-through">{formatMoney(detail.oldPrice)}</span>}
              </p>
              {detail.description && <p className="whitespace-pre-line text-[color:var(--s-muted)]">{detail.description}</p>}
              <div className="pt-2">
                {!detail.inStock ? (
                  <p className="rounded-[var(--s-radius)] border border-[color:var(--s-line)] py-3 text-center text-[color:var(--s-muted)]">Hozircha tugagan</p>
                ) : !settings.acceptOrders ? null : (cart[detail.id] ?? 0) > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Stepper size="lg" qty={cart[detail.id]} max={detail.maxQty} onChange={(q2) => update(detail.id, q2)} />
                    <button
                      type="button"
                      onClick={() => {
                        setDetail(null);
                        if (!shop.embedded) {
                          store.openRequest = Date.now();
                          notify(store);
                        }
                      }}
                      className={`${btnAccent} py-3`}
                    >
                      Savatga o&apos;tish
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => update(detail.id, 1)} className={`${btnAccent} w-full py-3`}>
                    + Savatga qo&apos;shish
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isOwner && count > 0 && open === null && !detail && !shop.embedded && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setOpen("cart")}
            className={`${btnAccent} mx-auto flex w-full max-w-lg items-center justify-between px-5 py-3.5 shadow-xl`}
          >
            <span className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-white/25 text-sm">{count}</span>
              Savatni ko&apos;rish
            </span>
            <span>{formatMoney(subtotal)}</span>
          </button>
        </div>
      )}

      {isOwner && open && !shop.embedded && (
        <CartDrawer
          shop={shop}
          lines={lines}
          subtotal={subtotal}
          step={open}
          inTelegram={inTelegram}
          onStep={setOpen}
          onQty={update}
          onClear={() => {
            store.cart = {};
            saveCart(shop.slug, {});
            notify(store);
          }}
        />
      )}
    </section>
  );
}

function CartDrawer({
  shop,
  lines,
  subtotal,
  step,
  inTelegram,
  onStep,
  onQty,
  onClear,
}: {
  shop: ShopData;
  lines: { p: PublicProduct; qty: number }[];
  subtotal: number;
  step: "cart" | "checkout" | "done";
  inTelegram: boolean;
  onStep: (s: null | "cart" | "checkout" | "done") => void;
  onQty: (id: string, q: number) => void;
  onClear: () => void;
}) {
  const s = shop.settings;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+998 ");
  const [delivery, setDelivery] = useState<"pickup" | "courier">(s.deliveryEnabled && !s.pickupEnabled ? "courier" : "pickup");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const payOptions: ("cash" | "payme" | "click" | "multicard")[] = [...(s.cashEnabled ? (["cash"] as const) : []), ...s.payMethods];
  const [payment, setPayment] = useState<"cash" | "payme" | "click" | "multicard">(payOptions[0] ?? "cash");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ number: number; total: number } | null>(null);

  useEffect(() => {
    const u = webApp()?.initDataUnsafe?.user;
    if (u && !name) setName([u.first_name, u.last_name].filter(Boolean).join(" "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deliveryPrice =
    delivery === "courier" ? (s.freeDeliveryFrom !== null && subtotal >= s.freeDeliveryFrom ? 0 : s.deliveryPrice) : 0;
  const total = subtotal + deliveryPrice;
  const belowMin = subtotal < s.minOrder;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (shop.preview) {
      setError("Bu ko'rib chiqish rejimi — buyurtma yuborilmaydi. Nashr qilingan saytda sinab ko'ring.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/shop/${shop.slug}/order`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ id: l.p.id, qty: l.qty })),
          name,
          phone,
          delivery,
          address,
          comment,
          initData: webApp()?.initData ?? "",
          tgLink: telegramLink(),
          payment,
          returnUrl: window.location.href.split("?")[0],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        number?: number;
        total?: number;
        payUrl?: string | null;
        payError?: string | null;
      };
      if (!data.ok) {
        setError(data.error ?? "Buyurtma yuborilmadi. Qayta urinib ko'ring.");
        webApp()?.HapticFeedback?.notificationOccurred("error");
        return;
      }
      setDone({ number: data.number ?? 0, total: data.total ?? total });
      onClear();
      if (data.payUrl) {
        // To'lov sahifasiga o'tamiz (Telegram ichida ham shu oynada ochiladi)
        window.location.href = data.payUrl;
        return;
      }
      if (data.payError) setError(data.payError);
      onStep("done");
      webApp()?.HapticFeedback?.notificationOccurred("success");
    } catch {
      setError("Internet aloqasini tekshirib, qayta urinib ko'ring.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => step !== "done" && onStep(null)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="s-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--s-radius)] bg-[color:var(--s-bg)] p-5 text-[color:var(--s-text)] sm:rounded-[var(--s-radius)]"
      >
        {step === "done" ? (
          <div className="py-6 text-center">
            <div className="text-5xl">✅</div>
            <h3 className="mt-3 text-xl font-bold">Buyurtma №{done?.number} qabul qilindi</h3>
            <p className="mt-2 text-[color:var(--s-muted)]">
              Jami: <b className="text-[color:var(--s-text)]">{formatMoney(done?.total ?? 0)}</b>
            </p>
            <p className="mt-2 text-sm text-[color:var(--s-muted)]">
              Tez orada siz bilan bog&apos;lanamiz.{inTelegram ? " Buyurtma holati shu botga keladi." : ""}
            </p>
            <button
              type="button"
              onClick={() => {
                const w = webApp();
                if (w) w.close();
                else onStep(null);
              }}
              className={`${btnAccent} mt-6 w-full py-3`}
            >
              {inTelegram ? "Yopish" : "Davom etish"}
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">{step === "cart" ? "Savat" : "Buyurtmani rasmiylashtirish"}</h3>
              <button type="button" onClick={() => onStep(null)} aria-label="Yopish" className="text-2xl leading-none text-[color:var(--s-muted)]">
                ×
              </button>
            </div>

            {step === "cart" && (
              <>
                {lines.length === 0 ? (
                  <p className="py-8 text-center text-[color:var(--s-muted)]">Savat bo&apos;sh</p>
                ) : (
                  <ul className="mt-4 divide-y divide-[color:var(--s-line)]">
                    {lines.map(({ p, qty }) => (
                      <li key={p.id} className="flex items-center gap-3 py-3">
                        <ProductImage p={p} className="size-14 shrink-0 rounded-[calc(var(--s-radius)*0.6)] text-2xl" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-sm text-[color:var(--s-muted)]">{formatMoney(p.price * qty)}</p>
                        </div>
                        <Stepper qty={qty} max={p.maxQty} onChange={(q) => onQty(p.id, q)} />
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-[color:var(--s-line)] pt-4 font-bold">
                  <span>Jami</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                {belowMin && <p className="mt-2 text-sm text-[color:var(--s-muted)]">Minimal buyurtma: {formatMoney(s.minOrder)}</p>}
                <button
                  type="button"
                  disabled={!lines.length || belowMin}
                  onClick={() => onStep("checkout")}
                  className={`${btnAccent} mt-4 w-full py-3`}
                >
                  Rasmiylashtirish →
                </button>
              </>
            )}

            {step === "checkout" && (
              <form onSubmit={submit} className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Ismingiz</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} className={input} autoComplete="name" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Telefon</span>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" maxLength={30} className={input} autoComplete="tel" />
                </label>

                <div>
                  <span className="mb-1 block text-sm font-medium">Qabul qilish usuli</span>
                  <div className="grid grid-cols-2 gap-2">
                    {s.pickupEnabled && (
                      <button
                        type="button"
                        onClick={() => setDelivery("pickup")}
                        className={`rounded-[calc(var(--s-radius)*0.6)] border px-3 py-2.5 text-left text-sm ${delivery === "pickup" ? "border-[color:var(--s-accent)] font-semibold" : "border-[color:var(--s-line)]"}`}
                      >
                        🏪 Olib ketish
                        <span className="block text-xs font-normal text-[color:var(--s-muted)]">Bepul</span>
                      </button>
                    )}
                    {s.deliveryEnabled && (
                      <button
                        type="button"
                        onClick={() => setDelivery("courier")}
                        className={`rounded-[calc(var(--s-radius)*0.6)] border px-3 py-2.5 text-left text-sm ${delivery === "courier" ? "border-[color:var(--s-accent)] font-semibold" : "border-[color:var(--s-line)]"}`}
                      >
                        🚚 Yetkazib berish
                        <span className="block text-xs font-normal text-[color:var(--s-muted)]">
                          {s.deliveryPrice === 0 ? "Bepul" : formatMoney(s.deliveryPrice)}
                          {s.freeDeliveryFrom !== null && s.deliveryPrice > 0 ? ` · ${formatMoney(s.freeDeliveryFrom)} dan bepul` : ""}
                        </span>
                      </button>
                    )}
                  </div>
                  {delivery === "pickup" && s.pickupAddress && <p className="mt-2 text-sm text-[color:var(--s-muted)]">📍 {s.pickupAddress}</p>}
                </div>

                {delivery === "courier" && (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium">Manzil</span>
                    <textarea value={address} onChange={(e) => setAddress(e.target.value)} required minLength={5} maxLength={300} rows={2} className={input} placeholder="Shahar, ko'cha, uy, mo'ljal" />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">Izoh (ixtiyoriy)</span>
                  <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} className={input} />
                </label>

                <div className="space-y-1 rounded-[calc(var(--s-radius)*0.6)] bg-[color:var(--s-surface)] p-3 text-sm">
                  <div className="flex justify-between">
                    <span>Mahsulotlar</span>
                    <span>{formatMoney(subtotal)}</span>
                  </div>
                  {delivery === "courier" && (
                    <div className="flex justify-between">
                      <span>Yetkazish</span>
                      <span>{deliveryPrice === 0 ? "Bepul" : formatMoney(deliveryPrice)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 text-base font-bold">
                    <span>Jami</span>
                    <span>{formatMoney(total)}</span>
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-sm font-medium">To&apos;lov usuli</span>
                  <div className="grid grid-cols-2 gap-2">
                    {payOptions.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayment(m)}
                        className={`rounded-[calc(var(--s-radius)*0.6)] border px-3 py-2.5 text-left text-sm ${payment === m ? "border-[color:var(--s-accent)] font-semibold" : "border-[color:var(--s-line)]"}`}
                      >
                        {m === "cash" ? "💵 Qabul qilganda" : m === "payme" ? "Payme" : m === "click" ? "Click" : "Multicard"}
                        <span className="block text-xs font-normal text-[color:var(--s-muted)]">{m === "cash" ? "Naqd yoki karta" : "Onlayn, karta bilan"}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="rounded-[calc(var(--s-radius)*0.6)] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                <div className="flex gap-2">
                  <button type="button" onClick={() => onStep("cart")} className="rounded-[var(--s-radius)] border border-[color:var(--s-line)] px-4 py-3">
                    ←
                  </button>
                  <button type="submit" disabled={sending} className={`${btnAccent} flex-1 py-3`}>
                    {sending ? "Yuborilmoqda…" : payment === "cash" ? `Buyurtma berish · ${formatMoney(total)}` : `To'lash · ${formatMoney(total)}`}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Tahrirlovchida ko'rinadigan namuna (haqiqiy mahsulotlar nashr qilingan saytda chiqadi) */
export function ShopPlaceholder({ heading, subheading, anchor }: { heading: string; subheading: string; anchor: string }) {
  const sample = [
    { emoji: "👕", name: "Mahsulot 1", price: 120000 },
    { emoji: "👟", name: "Mahsulot 2", price: 350000 },
    { emoji: "🎒", name: "Mahsulot 3", price: 210000 },
  ];
  return (
    <section id={anchor} className="bg-[color:var(--s-surface)] py-14 sm:py-20">
      <div className="mx-auto w-full max-w-5xl px-5">
        {heading && <h2 className="text-center text-2xl font-bold tracking-tight text-[color:var(--s-heading)] sm:text-3xl">{heading}</h2>}
        {subheading && <p className="mx-auto mt-3 max-w-2xl text-center text-[color:var(--s-muted)]">{subheading}</p>}
        <p className="mx-auto mt-4 max-w-md rounded-[var(--s-radius)] border border-dashed border-[color:var(--s-line)] px-4 py-2 text-center text-sm text-[color:var(--s-muted)]">
          Bu yerda &quot;Mahsulotlar&quot; bo&apos;limidagi mahsulotlaringiz savat bilan chiqadi
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 opacity-70 sm:gap-4 lg:grid-cols-3">
          {sample.map((p) => (
            <div key={p.name} className="overflow-hidden rounded-[var(--s-radius)] border border-[color:var(--s-line)] bg-[color:var(--s-bg)]">
              <div className="grid aspect-square place-items-center bg-[color:var(--s-surface)] text-5xl">{p.emoji}</div>
              <div className="p-3">
                <p className="font-semibold">{p.name}</p>
                <p className="mt-2 font-bold text-[color:var(--s-heading)]">{formatMoney(p.price)}</p>
                <div className={`${btnAccent} mt-2 py-2 text-center text-sm`}>Savatga</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
