"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ORDER_STATUS_LABELS, formatMoney, type OrderStatus } from "@/lib/shop/format";

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
  items: { name: string; qty: number }[];
  created_at: string;
};

const PAY_LABEL: Record<string, string> = { cash: "Naqd", card: "Kartaga o'tkazma", payme: "Payme", click: "Click", multicard: "Multicard" };

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

export function AccountButton({ slug, raised }: { slug: string; raised: boolean }) {
  const saved = useCustomer(slug);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed left-3 z-40 flex items-center gap-2 rounded-full border border-[color:var(--s-line)] bg-[color:var(--s-bg)] px-4 py-2.5 text-sm font-semibold text-[color:var(--s-text)] shadow-lg transition-[bottom] ${raised ? "bottom-20" : "bottom-4"}`}
      >
        <span aria-hidden>👤</span>
        {saved ? (saved.customer.name || "Kabinet").split(" ")[0] : "Kirish"}
      </button>
      {open && <AccountModal slug={slug} onClose={() => setOpen(false)} />}
    </>
  );
}

function AccountModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const saved = useCustomer(slug);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="s-card max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[var(--s-radius)] bg-[color:var(--s-bg)] p-5 text-[color:var(--s-text)] sm:rounded-[var(--s-radius)]"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{saved ? "Mening kabinetim" : "Kabinetga kirish"}</h3>
          <button type="button" onClick={onClose} aria-label="Yopish" className="text-2xl leading-none text-[color:var(--s-muted)]">
            ×
          </button>
        </div>
        {saved ? <Cabinet slug={slug} saved={saved} /> : <Login slug={slug} />}
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

function Cabinet({ slug, saved }: { slug: string; saved: Saved }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mt-4 space-y-4">
      <div className="flex items-center gap-3 rounded-[calc(var(--s-radius)*0.6)] bg-[color:var(--s-surface)] p-3">
        <div className="grid size-11 place-items-center rounded-full bg-[color:var(--s-accent)] text-lg font-bold text-white">
          {(saved.customer.name || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{saved.customer.name || "Mijoz"}</p>
          <p className="text-sm text-[color:var(--s-muted)]">{saved.customer.phone} · ✅ tasdiqlangan</p>
        </div>
        <button type="button" onClick={() => write(slug, null)} className="text-sm text-[color:var(--s-muted)] underline">
          Chiqish
        </button>
      </div>

      <div>
        <h4 className="mb-2 font-semibold">Buyurtmalarim</h4>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!orders && !error && <p className="text-sm text-[color:var(--s-muted)]">Yuklanmoqda…</p>}
        {orders && orders.length === 0 && <p className="text-sm text-[color:var(--s-muted)]">Hali buyurtma yo&apos;q.</p>}
        <ul className="space-y-2">
          {orders?.map((o) => (
            <li key={o.id} className="rounded-[calc(var(--s-radius)*0.6)] border border-[color:var(--s-line)] p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <b>№{o.number}</b>
                <span className="text-xs text-[color:var(--s-muted)]">{dateOf(o.created_at)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[color:var(--s-muted)]">{(o.items ?? []).map((i) => `${i.name} × ${i.qty}`).join(", ")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[color:var(--s-surface)] px-2 py-0.5 text-xs font-medium">{ORDER_STATUS_LABELS[o.status] ?? o.status}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${o.payment_status === "paid" ? "bg-emerald-100 text-emerald-800" : o.payment_status === "refunded" ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-800"}`}
                >
                  {o.payment_status === "paid" ? "✅ To'langan" : o.payment_status === "refunded" ? "Qaytarilgan" : "⏳ To'lanmagan"} · {PAY_LABEL[o.payment_method] ?? o.payment_method}
                </span>
                <span className="ml-auto font-semibold">{formatMoney(o.total)}</span>
              </div>
              {o.payment_method === "card" && o.payment_status === "unpaid" && o.pay_amount && o.status !== "cancelled" && (
                <p className="mt-2 text-xs text-[color:var(--s-muted)]">O&apos;tkazish kerak: aynan {formatMoney(o.pay_amount)}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
