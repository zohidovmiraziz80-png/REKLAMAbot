"use client";

import Script from "next/script";
import { useEffect, useState, type ReactNode } from "react";

/**
 * "Bot" tarifi: sayt faqat Telegram Mini App ichida ochiladi.
 * Oddiy brauzerda — botga o'tish tugmasi ko'rsatiladi.
 */

type TgWindow = { Telegram?: { WebApp?: { initData?: string; platform?: string } } };

function insideTelegram(): boolean {
  const w = (window as unknown as TgWindow).Telegram?.WebApp;
  if (w && (w.initData || (w.platform && w.platform !== "unknown"))) return true;
  try {
    const q = new URLSearchParams(window.location.search);
    if (q.get("tgb") && q.get("tgc")) return true;
    if (window.sessionStorage.getItem("tz-tg")) return true;
  } catch {
    // sessionStorage yopiq bo'lishi mumkin
  }
  return false;
}

export function TelegramGate({ botUsername, siteName, children }: { botUsername: string | null; siteName: string; children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "blocked">("checking");

  useEffect(() => {
    if (insideTelegram()) return setState("ok");
    // Skript yuklanishini biroz kutamiz
    const t = setTimeout(() => setState(insideTelegram() ? "ok" : "blocked"), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="afterInteractive" onLoad={() => insideTelegram() && setState("ok")} />
      {state === "ok" ? (
        children
      ) : state === "checking" ? (
        <div className="grid min-h-dvh place-items-center">
          <div className="size-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
        </div>
      ) : (
        <div className="grid min-h-dvh place-items-center bg-slate-50 px-6 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-sky-500 text-white">
              <svg viewBox="0 0 24 24" className="size-9 fill-current" aria-hidden>
                <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
              </svg>
            </div>
            <h1 className="mt-5 text-2xl font-bold text-slate-900">{siteName}</h1>
            <p className="mt-2 text-slate-600">Bu do&apos;kon Telegram bot ichida ishlaydi. Mahsulotlarni ko&apos;rish va buyurtma berish uchun botni oching.</p>
            {botUsername && (
              <a href={`https://t.me/${botUsername}`} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-600">
                Telegram&apos;da ochish
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
