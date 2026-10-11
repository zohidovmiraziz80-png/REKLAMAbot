"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CUSTOMER_STATUS_LABELS, PAY_METHOD_LABELS, formatMoney, type OrderStatus } from "@/lib/shop/format";
import { SHOP_EVENTS, shopEvent, toggleFavorite, useFavorites } from "./favorites";

/**
 * Mijoz kabineti: Telegram bot orqali telefonni tasdiqlab kirish va buyurtmalar ro'yxati.
 * Sessiya tokeni brauzerda (localStorage) saqlanadi; server imzosini tekshiradi.
 */

export type CustomerInfo = { name: string; phone: string };
type Saved = { session: string; customer: CustomerInfo };

const key = (slug: string) => `mx-session:${slug}`;
const pendingKey = (slug: string) => `mx-login:${slug}`;
const listeners = new Set<() => void>();
const cache = new Map<string, Saved | null>();

function read(slug: string): Saved | null {
  if (cache.has(slug)) return cache.get(slug) ?? null;
  let v: Saved | null = null;
  try {
    const raw = window.localStorage.getItem(key(slug));
    v = raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    v = null;
  }
  cache.set(slug, v);
  return v;
}

function write(slug: string, v: Saved | null) {
  cache.set(slug, v);
  try {
    if (v) window.localStorage.setItem(key(slug), JSON.stringify(v));
    else window.localStorage.removeItem(key(slug));
  } catch {
    // brauzer saqlashga ruxsat bermasa — faqat shu sahifada amal qiladi
  }
  listeners.forEach((l) => l());
}

export function useCustomer(slug: string): Saved | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(slug),
    () => null,
  );
}

type Order = {
  id: string;
  number: number;
  status: OrderStatus;
  payment_status: "unpaid" | "paid" | "refunded";
  payment_method: string;
  pay_amount: number | null;
  total: number;
  subtotal?: number;
  delivery_price?: number;
  discount?: number;
  address?: string | null;
  comment?: string | null;
  delivery_method?: string;
  items: { name: string; qty: number; price?: number; image_url?: string | null; emoji?: string }[];
  created_at: string;
};

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: "new", label: "Qabul qilindi" },
  { key: "confirmed", label: "Do'kon qabul qildi" },
  { key: "delivering", label: "Yo'lda" },
  { key: "done", label: "Yetkazildi" },
];

function Progress({ status, pickup }: { status: OrderStatus; pickup: boolean }) {
  if (status === "cancelled") return <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">❌ Buyurtma bekor qilindi</p>;
  const idx = STEPS.findIndex((s) => s.key === status);
  return (
    <div className="flex items-start gap-1">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex flex-1 flex-col items-center gap-1 text-center">
          <div className={`h-1.5 w-full rounded-full ${i <= idx ? "bg-[color:var(--s-accent)]" : "bg-[color:var(--s-line)]"}`} />
          <span className={`text-[10px] leading-tight ${i === idx ? "font-semibold text-[color:var(--s-text)]" : "text-[color:var(--s-muted)]"}`}>
            {pickup && s.key === "delivering" ? "Tayyor" : pickup && s.key === "done" ? "Olib ketildi" : s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function dateOf(iso: string) {
  const d = new Date(new Date(iso).getTime() + 5 * 3600 * 1000);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

function openTelegram(url: string) {
  const w = (window as unknown as { Telegram?: { WebApp?: { initData?: string; openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
  if (w?.initData && w.openTelegramLink) w.openTelegramLink(url);
  else window.open(url, "_blank", "noopener");
}

const btnAccent = "rounded-[var(--s-radius)] bg-[color:var(--s-accent)] font-semibold text-white transition hover:brightness-110 disabled:opacity-50";

export function AccountButton({ slug, placement = "header", dark = false }: { slug: string; placement?: "header" | "preview"; dark?: boolean }) {
  const saved = useCustomer(slug);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const label = saved ? (saved.customer.name || "Kabinet").split(" ")[0] : "Kirish";
  // Modal sarlavha (backdrop-blur) ichida qolib ketmasligi uchun sayt ildiziga chiqariladi — mavzu ranglari saqlanadi
  const root = open && ref.current ? ((ref.current.closest("[data-site-root]") as HTMLElement | null) ?? document.body) : null;
  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => placement === "header" && setOpen(true)}
        className={`ml-1 flex items-center gap-1.5 rounded-full px-4 py-1.5 font-semibold whitespace-nowrap ${saved ? (dark ? "bg-white/15 text-white" : "bg-[color:var(--s-surface)] text-[color:var(--s-text)]") : "bg-[color:var(--s-accent)] text-white"}`}
      >
        <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
          <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-4.42 0-8 2.24-8 5v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1c0-2.76-3.58-5-8-5z" />
        </svg>
        {label}
      </button>
      {open && root && createPortal(<AccountModal slug={slug} onClose={() => setOpen(false)} />, root)}
    </>
  );
}

function AccountModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const saved = useCustomer(slug);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);
  if (saved) {
    return (
      <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
        <div
          onClick={(e) => e.stopPropagation()}
          className="s-card flex h-full w-full max-w-4xl flex-col overflow-hidden bg-[color:var(--s-bg)] text-[color:var(--s-text)] sm:h-[min(88dvh,760px)] sm:rounded-2xl"
        >
          <Cabinet slug={slug} saved={saved} onClose={onClose} />
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="s-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--s-radius)] bg-[color:var(--s-bg)] p-5 text-[color:var(--s-text)] sm:rounded-[var(--s-radius)]"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Kabinetga kirish</h3>
          <button type="button" onClick={onClose} aria-label="Yopish" className="text-2xl leading-none text-[color:var(--s-muted)]">
            ×
          </button>
        </div>
        <Login slug={slug} />
      </div>
    </div>
  );
}

function Login({ slug }: { slug: string }) {
  const [state, setState] = useState<"idle" | "starting" | "waiting" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function poll(token: string) {
    if (timer.current) clearInterval(timer.current);
    const started = Date.now();
    timer.current = setInterval(async () => {
      if (Date.now() - started > 15 * 60 * 1000) {
        if (timer.current) clearInterval(timer.current);
        setState("error");
        setError("Vaqt tugadi. Qayta urinib ko'ring.");
        return;
      }
      try {
        const res = await fetch(`/api/shop/${slug}/auth?token=${token}`, { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; status?: string; session?: string; customer?: CustomerInfo };
        if (data.status === "confirmed" && data.session && data.customer) {
          if (timer.current) clearInterval(timer.current);
          try {
            window.localStorage.removeItem(pendingKey(slug));
          } catch {
            // saqlash imkoni bo'lmasa e'tiborsiz
          }
          write(slug, { session: data.session, customer: data.customer });
        } else if (data.status === "expired") {
          if (timer.current) clearInterval(timer.current);
          setState("error");
          setError("Havola eskirdi. Qayta urinib ko'ring.");
        }
      } catch {
        // internet uzilsa keyingi safar
      }
    }, 2000);
  }

  useEffect(() => {
    // Sahifa yangilangan bo'lsa — kutishni davom ettiramiz
    try {
      const raw = window.localStorage.getItem(pendingKey(slug));
      if (raw) {
        const p = JSON.parse(raw) as { token: string; url: string; at: number };
        if (Date.now() - p.at < 15 * 60 * 1000) {
          setLink(p.url);
          setState("waiting");
          poll(p.token);
        }
      }
    } catch {
            // saqlash imkoni bo'lmasa e'tiborsiz
          }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function start() {
    setState("starting");
    setError(null);
    try {
      const res = await fetch(`/api/shop/${slug}/auth`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; token?: string; url?: string; error?: string };
      if (!data.ok || !data.token || !data.url) {
        setState("error");
        setError(data.error ?? "Xatolik. Qayta urinib ko'ring.");
        return;
      }
      try {
        window.localStorage.setItem(pendingKey(slug), JSON.stringify({ token: data.token, url: data.url, at: Date.now() }));
      } catch {
            // saqlash imkoni bo'lmasa e'tiborsiz
          }
      setLink(data.url);
      setState("waiting");
      openTelegram(data.url);
      poll(data.token);
    } catch {
      setState("error");
      setError("Internet aloqasini tekshiring.");
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <ol className="space-y-2 text-sm">
        <li>1. «Telegram orqali kirish» tugmasini bosing — bot ochiladi.</li>
        <li>
          2. Botda <b>Start</b> ni bosing.
        </li>
        <li>
          3. <b>«📱 Raqamni yuborish va kirish»</b> tugmasini bosing.
        </li>
        <li>4. Shu sahifaga qayting — kabinet avtomatik ochiladi.</li>
      </ol>
      {state === "waiting" ? (
        <div className="space-y-3 rounded-[calc(var(--s-radius)*0.6)] bg-[color:var(--s-surface)] p-4 text-center text-sm">
          <div className="mx-auto size-6 animate-spin rounded-full border-2 border-[color:var(--s-accent)] border-t-transparent" />
          <p>Telegram&apos;da raqamingiz tasdiqlanishini kutyapmiz…</p>
          {link && (
            <button type="button" onClick={() => openTelegram(link)} className="font-semibold text-[color:var(--s-accent)] underline">
              Botni qayta ochish
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={start} disabled={state === "starting"} className={`${btnAccent} flex w-full items-center justify-center gap-2 py-3`}>
          <svg viewBox="0 0 24 24" className="size-5 fill-current" aria-hidden>
            <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
          </svg>
          {state === "starting" ? "Ochilmoqda…" : "Telegram orqali kirish"}
        </button>
      )}
      {error && <p className="rounded-[calc(var(--s-radius)*0.6)] bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <p className="text-xs text-[color:var(--s-muted)]">Raqamingiz faqat buyurtmalaringizni ko&apos;rsatish va holatini Telegram&apos;da yuborish uchun ishlatiladi.</p>
    </div>
  );
}

type Tab = "orders" | "favorites" | "profile";
const ACTIVE: OrderStatus[] = ["new", "confirmed", "delivering"];

function Cabinet({ slug, saved, onClose }: { slug: string; saved: Saved; onClose: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("orders");
  const [filter, setFilter] = useState<"all" | "active" | "done" | "cancelled">("all");
  const favs = useFavorites(slug);

  useEffect(() => {
    let alive = true;
    fetch(`/api/shop/${slug}/me`, { headers: { "x-mx-session": saved.session }, cache: "no-store" })
      .then(async (r) => {
        const data = (await r.json()) as { ok?: boolean; orders?: Order[]; error?: string };
        if (!alive) return;
        if (r.status === 401) return write(slug, null);
        if (data.ok) setOrders(data.orders ?? []);
        else setError(data.error ?? "Yuklab bo'lmadi");
      })
      .catch(() => alive && setError("Internet aloqasini tekshiring."));
    return () => {
      alive = false;
    };
  }, [slug, saved.session]);

  const list = (orders ?? []).filter((o) =>
    filter === "all" ? true : filter === "active" ? ACTIVE.includes(o.status) : filter === "done" ? o.status === "done" : o.status === "cancelled",
  );
  const tabs: [Tab, string, string, number | null][] = [
    ["orders", "📦", "Buyurtmalarim", orders ? orders.filter((o) => ACTIVE.includes(o.status)).length || null : null],
    ["favorites", "♡", "Saralangan", favs.length || null],
    ["profile", "👤", "Ma'lumotlarim", null],
  ];
  const title = tabs.find((t) => t[0] === tab)?.[2] ?? "";

  return (
    <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <aside className="shrink-0 border-b border-[color:var(--s-line)] bg-[color:var(--s-surface)] sm:w-64 sm:border-r sm:border-b-0">
        <div className="flex items-center gap-3 p-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[color:var(--s-primary)] text-lg font-bold text-white">
            {(saved.customer.name || "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{saved.customer.name || "Mijoz"}</p>
            <p className="truncate text-xs text-[color:var(--s-muted)]">{saved.customer.phone}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Yopish" className="text-2xl leading-none text-[color:var(--s-muted)] sm:hidden">
            ×
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 [scrollbar-width:none] sm:flex-col sm:px-3">
          {tabs.map(([id, icon, label, badge]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                tab === id ? "bg-[color:var(--s-bg)] font-semibold text-[color:var(--s-heading)] shadow-sm" : "text-[color:var(--s-muted)] hover:text-[color:var(--s-text)]"
              }`}
            >
              <span className="w-5 text-center">{icon}</span>
              <span className="flex-1 whitespace-nowrap">{label}</span>
              {badge != null && <span className="rounded-full bg-[color:var(--s-accent)] px-1.5 text-[11px] leading-5 font-bold text-white">{badge}</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => write(slug, null)}
            className="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-[color:var(--s-muted)] hover:text-red-600 sm:mt-2"
          >
            <span className="w-5 text-center">↩</span>
            <span className="whitespace-nowrap">Chiqish</span>
          </button>
        </nav>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <h3 className="text-xl font-bold text-[color:var(--s-heading)]">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Yopish" className="hidden text-2xl leading-none text-[color:var(--s-muted)] sm:block">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          {tab === "orders" && (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-3 [scrollbar-width:none]">
                {(
                  [
                    ["all", "Hammasi"],
                    ["active", "Faol"],
                    ["done", "Yetkazilgan"],
                    ["cancelled", "Bekor qilingan"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFilter(id)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap ${
                      filter === id ? "bg-[color:var(--s-primary)] font-semibold text-white" : "border border-[color:var(--s-line)] text-[color:var(--s-text)]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              {!orders && !error && <p className="text-sm text-[color:var(--s-muted)]">Yuklanmoqda…</p>}
              {orders && list.length === 0 && (
                <div className="mt-8 text-center">
                  <p className="text-4xl">📦</p>
                  <p className="mt-2 text-sm text-[color:var(--s-muted)]">{orders.length === 0 ? "Hali buyurtma yo'q." : "Bu bo'limda buyurtma yo'q."}</p>
                </div>
              )}
              <ul className="space-y-3">
                {list.map((o) => (
                  <OrderCard key={o.id} o={o} />
                ))}
              </ul>
            </>
          )}

          {tab === "favorites" &&
            (favs.length === 0 ? (
              <div className="mt-8 text-center">
                <p className="text-4xl">♡</p>
                <p className="mt-2 text-sm text-[color:var(--s-muted)]">Yoqqan mahsulotlardagi ♡ belgisini bosing — ular shu yerda saqlanadi.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {favs.map((f) => (
                    <div key={f.id} className="relative">
                      {f.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.imageUrl} alt={f.name} loading="lazy" className="aspect-[3/4] w-full rounded-xl object-cover" />
                      ) : (
                        <div className="grid aspect-[3/4] w-full place-items-center rounded-xl bg-[color:var(--s-surface)] text-5xl">{f.emoji || "📦"}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleFavorite(slug, f)}
                        aria-label="Saralangandan olib tashlash"
                        className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-full bg-white/90 text-[color:var(--s-accent)]"
                      >
                        ♥
                      </button>
                      <p className="mt-1.5 text-sm font-bold">{formatMoney(f.price)}</p>
                      <p className="line-clamp-2 text-xs text-[color:var(--s-muted)]">{f.name}</p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    shopEvent(SHOP_EVENTS.favorites);
                  }}
                  className={`${btnAccent} mt-5 w-full py-3`}
                >
                  Katalogda ko&apos;rish va savatga qo&apos;shish
                </button>
              </>
            ))}

          {tab === "profile" && (
            <div className="max-w-md space-y-3">
              {[
                ["Ism", saved.customer.name || "—"],
                ["Telefon", saved.customer.phone],
                ["Tasdiqlash", "✅ Telegram orqali tasdiqlangan"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-[color:var(--s-line)] px-4 py-3">
                  <p className="text-xs text-[color:var(--s-muted)]">{k}</p>
                  <p className="mt-0.5 font-medium">{v}</p>
                </div>
              ))}
              <p className="text-xs text-[color:var(--s-muted)]">Buyurtma holati o&apos;zgarganda Telegram&apos;da xabar olasiz.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function OrderCard({ o }: { o: Order }) {
  const [open, setOpen] = useState(false);
  const items = o.items ?? [];
  const status = o.status === "cancelled" ? "bg-red-50 text-red-700" : o.status === "done" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800";
  return (
    <li className="overflow-hidden rounded-2xl border border-[color:var(--s-line)] text-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="block w-full p-4 text-left" aria-expanded={open}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-bold">Buyurtma №{o.number}</p>
            <p className="text-xs text-[color:var(--s-muted)]">{dateOf(o.created_at)}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status}`}>{CUSTOMER_STATUS_LABELS[o.status] ?? o.status}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {items.slice(0, 5).map((i, idx) =>
            i.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={idx} src={i.image_url} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <span key={idx} className="grid size-12 shrink-0 place-items-center rounded-lg bg-[color:var(--s-surface)] text-lg">
                {i.emoji || "📦"}
              </span>
            ),
          )}
          {items.length > 5 && <span className="text-xs text-[color:var(--s-muted)]">+{items.length - 5}</span>}
          <span className="ml-auto text-right">
            <span className="block text-base font-extrabold">{formatMoney(o.total)}</span>
            <span className="text-xs text-[color:var(--s-accent)]">{open ? "Yopish ▲" : "Batafsil ▼"}</span>
          </span>
        </div>
        <div className="mt-3">
          <Progress status={o.status} pickup={o.delivery_method === "pickup"} />
        </div>
      </button>
      {open && (
        <div className="border-t border-[color:var(--s-line)] px-4 pb-4">
              <ul className="mt-3 space-y-1.5">
            {(o.items ?? []).slice(0, 8).map((i, idx) => (
              <li key={idx} className="flex items-center gap-2.5">
                {i.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.image_url} alt="" loading="lazy" className="size-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[color:var(--s-surface)] text-lg">{i.emoji || "📦"}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{i.name}</span>
                  {i.price != null && (
                    <span className="text-xs text-[color:var(--s-muted)]">
                      {i.qty} × {formatMoney(i.price)}
                    </span>
                  )}
                </span>
                {i.price != null && <span className="shrink-0 text-xs font-medium">{formatMoney(i.price * i.qty)}</span>}
              </li>
            ))}
            {(o.items ?? []).length > 8 && <li className="text-xs text-[color:var(--s-muted)]">yana {(o.items ?? []).length - 8} ta…</li>}
          </ul>

          <dl className="mt-3 space-y-1 border-t border-[color:var(--s-line)] pt-2 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-[color:var(--s-muted)]">Qabul qilish</dt>
              <dd className="text-right">{o.delivery_method === "courier" ? `🚚 Yetkazib berish${o.address ? `: ${o.address}` : ""}` : "🏪 Olib ketish"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[color:var(--s-muted)]">To&apos;lov</dt>
              <dd className="text-right">
                {PAY_METHOD_LABELS[o.payment_method] ?? o.payment_method} ·{" "}
                <span className={o.payment_status === "paid" ? "text-emerald-700" : o.payment_status === "refunded" ? "" : "text-amber-700"}>
                  {o.payment_status === "paid" ? "✅ to'langan" : o.payment_status === "refunded" ? "qaytarilgan" : "⏳ to'lanmagan"}
                </span>
              </dd>
            </div>
            {o.comment && (
              <div className="flex justify-between gap-3">
                <dt className="text-[color:var(--s-muted)]">Izoh</dt>
                <dd className="text-right">{o.comment}</dd>
              </div>
            )}
            {o.subtotal != null && (o.delivery_price || o.discount) ? (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-[color:var(--s-muted)]">Mahsulotlar</dt>
                  <dd>{formatMoney(o.subtotal)}</dd>
                </div>
                {!!o.delivery_price && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[color:var(--s-muted)]">Yetkazish</dt>
                    <dd>{formatMoney(o.delivery_price)}</dd>
                  </div>
                )}
                {!!o.discount && (
                  <div className="flex justify-between gap-3 text-emerald-700">
                    <dt>Chegirma</dt>
                    <dd>−{formatMoney(o.discount)}</dd>
                  </div>
                )}
              </>
            ) : null}
            <div className="flex justify-between gap-3 pt-1 text-sm font-bold">
              <dt>Jami</dt>
              <dd>{formatMoney(o.total)}</dd>
            </div>
          </dl>
          {o.payment_method === "card" && o.payment_status === "unpaid" && o.pay_amount && o.status !== "cancelled" && (
            <p className="mt-2 rounded-lg bg-[color:var(--s-surface)] px-2 py-1.5 text-xs">💳 O&apos;tkazish kerak: aynan {formatMoney(o.pay_amount)}</p>
          )}
        </div>
      )}
    </li>
  );
}
