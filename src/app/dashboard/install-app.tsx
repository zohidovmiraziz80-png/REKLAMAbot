"use client";

import { useEffect, useState } from "react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Service worker'ni ro'yxatdan o'tkazadi va telefonda "Ilovani o'rnatish" taklifini ko'rsatadi */
export function InstallApp() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem("mx-install-dismissed") === "1";
    } catch {
      // saqlash yopiq bo'lishi mumkin
    }
    if (standalone || dismissed) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && window.innerWidth < 900;
    if (isIos) {
      setIos(true);
      setHidden(false);
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      window.localStorage.setItem("mx-install-dismissed", "1");
    } catch {
      // e'tiborsiz
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[#0f2d6b] p-3 text-white shadow-2xl lg:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="size-10 rounded-xl" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">MIXBOT ilovasi</p>
        <p className="text-xs text-white/75">{ios ? "Ulashish ⎋ → «Bosh ekranga qo'shish»" : "Telefoningizga o'rnating — bir bosishda ochiladi"}</p>
      </div>
      {!ios && evt && (
        <button
          type="button"
          onClick={async () => {
            await evt.prompt();
            await evt.userChoice;
            close();
          }}
          className="rounded-lg bg-[#f7821b] px-3 py-2 text-sm font-semibold"
        >
          O&apos;rnatish
        </button>
      )}
      <button type="button" onClick={close} aria-label="Yopish" className="px-1 text-xl text-white/70">
        ×
      </button>
    </div>
  );
}
